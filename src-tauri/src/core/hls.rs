use crate::core::state::{Download, DownloadProgressEvent, DownloadStatus};
use crate::database::save_or_update_download;
use crate::filesystem::finalize_download;
use reqwest::Client;
use std::collections::HashMap;
use std::fs::File;
use std::io::{Read, Write};
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};
use tokio::sync::Semaphore;
use tracing::info;

pub struct HlsSegmentDownloader;

impl HlsSegmentDownloader {
    /// Recursively parses an HLS Master/Media playlist and extracts all TS/M4S chunk URLs
    pub async fn extract_segment_urls(
        client: &Client,
        playlist_url: &str,
        headers: &HashMap<String, String>,
    ) -> Result<Vec<String>, String> {
        let mut req = client.get(playlist_url);
        for (k, v) in headers {
            req = req.header(k, v);
        }

        let resp = req
            .send()
            .await
            .map_err(|e| format!("Failed to fetch HLS playlist: {}", e))?;

        if !resp.status().is_success() {
            return Err(format!("HLS server returned HTTP status {}", resp.status()));
        }

        let text = resp
            .text()
            .await
            .map_err(|e| format!("Failed to read playlist text: {}", e))?;

        if !text.contains("#EXTM3U") {
            return Err("URL is not a valid HLS M3U8 manifest".to_string());
        }

        let base_url = reqwest::Url::parse(playlist_url)
            .map_err(|e| format!("Invalid playlist URL: {}", e))?;

        // 1. Check if Master Playlist (contains sub-playlists)
        if text.contains("#EXT-X-STREAM-INF") {
            let mut highest_bandwidth = 0u64;
            let mut best_sub_url: Option<String> = None;
            let lines: Vec<&str> = text.lines().collect();

            for (i, line) in lines.iter().enumerate() {
                let trimmed = line.trim();
                if trimmed.starts_with("#EXT-X-STREAM-INF:") {
                    let mut bw = 0u64;
                    if let Some(idx) = trimmed.find("BANDWIDTH=") {
                        let rest = &trimmed[idx + 10..];
                        let num_str: String = rest.chars().take_while(|c| c.is_ascii_digit()).collect();
                        bw = num_str.parse::<u64>().unwrap_or(0);
                    }

                    if i + 1 < lines.len() {
                        let sub_line = lines[i + 1].trim();
                        if !sub_line.starts_with('#') && !sub_line.is_empty() {
                            if bw >= highest_bandwidth || best_sub_url.is_none() {
                                highest_bandwidth = bw;
                                let resolved = base_url
                                    .join(sub_line)
                                    .map(|u| u.to_string())
                                    .unwrap_or_else(|_| sub_line.to_string());
                                best_sub_url = Some(resolved);
                            }
                        }
                    }
                }
            }

            if let Some(best_url) = best_sub_url {
                return Box::pin(Self::extract_segment_urls(client, &best_url, headers)).await;
            }
        }

        // 2. Parse Media Playlist Segment URLs
        let mut segments = Vec::new();
        for line in text.lines() {
            let trimmed = line.trim();
            if trimmed.is_empty() || trimmed.starts_with('#') {
                continue;
            }

            let resolved = base_url
                .join(trimmed)
                .map(|u| u.to_string())
                .unwrap_or_else(|_| trimmed.to_string());
            segments.push(resolved);
        }

        if segments.is_empty() {
            return Err("No media segments found in HLS playlist".to_string());
        }

        Ok(segments)
    }

    /// Downloads all HLS chunks concurrently with 16 worker threads, stitches them in exact sequence into a single playable MP4/TS file
    pub async fn run_hls_download(
        mut download: Download,
        client: Client,
        db: crate::database::DbPool,
        app_handle: Option<AppHandle>,
        is_cancelled: Arc<AtomicBool>,
        is_paused: Arc<AtomicBool>,
    ) -> Result<(), String> {
        info!("Starting Parallel HLS Stream Assembly for: {}", download.filename);

        let segments = Self::extract_segment_urls(&client, &download.url, &download.headers).await?;
        let total_segments = segments.len();
        info!("HLS Playlist contains {} segments", total_segments);

        let target_path = PathBuf::from(&download.save_location);
        let part_path = PathBuf::from(format!("{}.orbit.hls.part", download.save_location));

        // Create temporary directory for chunks
        let chunks_dir = PathBuf::from(format!("{}.orbit.chunks", download.save_location));
        std::fs::create_dir_all(&chunks_dir)
            .map_err(|e| format!("Failed to create chunks dir: {}", e))?;

        let downloaded_bytes = Arc::new(AtomicU64::new(0));
        let completed_chunks = Arc::new(AtomicU64::new(0));

        let concurrency_limit = 16;
        let semaphore = Arc::new(Semaphore::new(concurrency_limit));

        let mut segment_tasks = Vec::new();

        for (idx, seg_url) in segments.iter().enumerate() {
            let sem = semaphore.clone();
            let c_client = client.clone();
            let s_url = seg_url.clone();
            let s_headers = download.headers.clone();
            let chunk_file = chunks_dir.join(format!("chunk_{:06}.ts", idx));
            let dl_bytes = downloaded_bytes.clone();
            let comp_chunks = completed_chunks.clone();
            let cancel_flag = is_cancelled.clone();
            let pause_flag = is_paused.clone();

            let task = tokio::spawn(async move {
                let _permit = sem.acquire().await.map_err(|e| e.to_string())?;

                if cancel_flag.load(Ordering::Relaxed) || pause_flag.load(Ordering::Relaxed) {
                    return Ok(());
                }

                // If chunk already exists (resume support), tally size and skip
                if chunk_file.exists() {
                    if let Ok(meta) = chunk_file.metadata() {
                        if meta.len() > 0 {
                            dl_bytes.fetch_add(meta.len(), Ordering::Relaxed);
                            comp_chunks.fetch_add(1, Ordering::Relaxed);
                            return Ok(());
                        }
                    }
                }

                let max_retries = 3;
                let mut attempt = 0;

                loop {
                    let mut req = c_client.get(&s_url);
                    for (k, v) in &s_headers {
                        req = req.header(k, v);
                    }

                    match req.send().await {
                        Ok(resp) if resp.status().is_success() => {
                            let bytes = resp.bytes().await.map_err(|e| e.to_string())?;
                            let len = bytes.len() as u64;

                            let mut file = File::create(&chunk_file)
                                .map_err(|e| format!("Failed to write chunk {}: {}", idx, e))?;
                            file.write_all(&bytes)
                                .map_err(|e| format!("Failed to write chunk bytes: {}", e))?;

                            dl_bytes.fetch_add(len, Ordering::Relaxed);
                            comp_chunks.fetch_add(1, Ordering::Relaxed);
                            return Ok(());
                        }
                        _ => {
                            attempt += 1;
                            if attempt >= max_retries {
                                return Err(format!("Failed to download HLS segment {} after {} retries", idx, attempt));
                            }
                            tokio::time::sleep(Duration::from_millis(500 * attempt)).await;
                        }
                    }
                }
            });

            segment_tasks.push(task);
        }

        // Live Telemetry Loop (10Hz)
        let mut last_tick = Instant::now();
        let mut last_dl = 0u64;
        let mut peak_speed = 0u64;
        let start_time = Instant::now();

        loop {
            tokio::time::sleep(Duration::from_millis(100)).await;

            if is_cancelled.load(Ordering::Relaxed) {
                download.status = DownloadStatus::Cancelled;
                save_or_update_download(&db, &download).await.ok();
                std::fs::remove_dir_all(&chunks_dir).ok();
                return Ok(());
            }

            if is_paused.load(Ordering::Relaxed) {
                download.status = DownloadStatus::Paused;
                save_or_update_download(&db, &download).await.ok();
                return Ok(());
            }

            let done = completed_chunks.load(Ordering::Relaxed) as usize;
            let current_dl = downloaded_bytes.load(Ordering::Relaxed);
            let elapsed_tick = last_tick.elapsed().as_secs_f64();

            if elapsed_tick >= 0.1 {
                let bytes_diff = current_dl.saturating_sub(last_dl);
                let current_speed = (bytes_diff as f64 / elapsed_tick) as u64;
                if current_speed > peak_speed {
                    peak_speed = current_speed;
                }

                let total_elapsed = start_time.elapsed().as_secs_f64();
                let avg_speed = if total_elapsed > 0.0 {
                    (current_dl as f64 / total_elapsed) as u64
                } else {
                    0
                };

                let estimated_total = if done > 0 {
                    (current_dl / done as u64) * total_segments as u64
                } else {
                    current_dl
                };

                let remaining = estimated_total.saturating_sub(current_dl);
                let eta = if current_speed > 0 {
                    Some(remaining / current_speed)
                } else {
                    None
                };

                download.downloaded_bytes = current_dl;
                download.total_bytes = estimated_total;
                download.remaining_bytes = remaining;
                download.speed = current_speed;
                download.peak_speed = peak_speed;
                download.average_speed = avg_speed;
                download.eta_seconds = eta;

                last_tick = Instant::now();
                last_dl = current_dl;

                if let Some(ref handle) = app_handle {
                    handle
                        .emit(
                            "download-progress",
                            DownloadProgressEvent {
                                id: download.id.clone(),
                                status: DownloadStatus::Downloading,
                                downloaded_bytes: current_dl,
                                total_bytes: estimated_total,
                                speed: current_speed,
                                eta_seconds: eta,
                                chunks: vec![],
                            },
                        )
                        .ok();
                }
            }

            if done >= total_segments {
                break;
            }
        }

        // Wait for all download tasks
        for task in segment_tasks {
            task.await.map_err(|e| e.to_string())??;
        }

        info!("All {} HLS segments downloaded. Stitching into final video file...", total_segments);

        // Stitch sequential chunks into final output file
        let mut final_file = File::create(&part_path)
            .map_err(|e| format!("Failed to create final stitched video file: {}", e))?;

        let mut stitch_buffer = vec![0u8; 64 * 1024];

        for idx in 0..total_segments {
            let chunk_file = chunks_dir.join(format!("chunk_{:06}.ts", idx));
            if let Ok(mut c_file) = File::open(&chunk_file) {
                loop {
                    let n = c_file
                        .read(&mut stitch_buffer)
                        .map_err(|e| format!("Failed to read chunk {}: {}", idx, e))?;
                    if n == 0 {
                        break;
                    }
                    final_file
                        .write_all(&stitch_buffer[..n])
                        .map_err(|e| format!("Failed to write stitched stream: {}", e))?;
                }
            }
        }

        final_file.flush().ok();
        drop(final_file);

        // Move part to final target
        finalize_download(&part_path, &target_path).ok();

        // Clean up temporary chunks directory
        std::fs::remove_dir_all(&chunks_dir).ok();

        download.status = DownloadStatus::Completed;
        download.completed_at = Some(chrono::Utc::now().timestamp_millis());
        download.speed = 0;
        download.eta_seconds = None;

        if let Some(ref handle) = app_handle {
            handle.emit("download-completed", download.clone()).ok();
        }

        save_or_update_download(&db, &download).await.ok();
        info!("Parallel HLS Stream Assembly complete for {}", download.filename);

        Ok(())
    }
}
