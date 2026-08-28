use crate::core::state::{
    ChunkState, Download, DownloadPriority, DownloadProgressEvent, DownloadStatus, UrlAnalysisResult,
};
use crate::core::worker::ChunkWorker;
use crate::database::{get_all_rules, save_or_update_download, DbPool};
use crate::filesystem::{finalize_download, get_part_file_path, preallocate_file};
use crate::integrity::calculate_checksums;
use crate::rules::RuleEvaluator;
use reqwest::header::{ACCEPT_RANGES, CONTENT_DISPOSITION, CONTENT_LENGTH, CONTENT_TYPE, ETAG, LAST_MODIFIED};
use reqwest::{Client, Proxy};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};
use tokio::sync::Mutex as TokioMutex;
use tracing::info;
use uuid::Uuid;

pub struct ActiveDownloadTask {
    pub is_cancelled: Arc<AtomicBool>,
    pub is_paused: Arc<AtomicBool>,
    pub chunk_counters: Vec<Arc<AtomicU64>>,
}

#[derive(Clone)]
pub struct DownloadEngine {
    pub client: Client,
    pub db: DbPool,
    pub active_tasks: Arc<TokioMutex<HashMap<String, ActiveDownloadTask>>>,
    pub app_handle: Option<AppHandle>,
}

impl DownloadEngine {
    pub fn new(db: DbPool, app_handle: Option<AppHandle>) -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(30))
            .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36")
            .build()
            .unwrap_or_default();

        Self {
            client,
            db,
            active_tasks: Arc::new(TokioMutex::new(HashMap::new())),
            app_handle,
        }
    }

    pub fn set_app_handle(&mut self, handle: AppHandle) {
        self.app_handle = Some(handle);
    }

    pub async fn analyze_url(&self, url: &str) -> Result<UrlAnalysisResult, String> {
        self.analyze_url_with_headers(url, None).await
    }

    pub async fn analyze_url_with_headers(
        &self,
        url: &str,
        custom_headers: Option<&HashMap<String, String>>,
    ) -> Result<UrlAnalysisResult, String> {
        let start_time = Instant::now();

        // 1. Try HEAD request with custom session headers
        let mut head_req = self.client.head(url);
        if let Some(hdrs) = custom_headers {
            for (k, v) in hdrs {
                head_req = head_req.header(k, v);
            }
        }
        let head_resp = head_req.send().await;

        let resp = match head_resp {
            Ok(r) if r.status().is_success() => r,
            _ => {
                // Fallback to GET with Range: bytes=0-0 for CDNs that reject HEAD requests
                let mut get_req = self.client.get(url).header("Range", "bytes=0-0");
                if let Some(hdrs) = custom_headers {
                    for (k, v) in hdrs {
                        get_req = get_req.header(k, v);
                    }
                }
                get_req
                    .send()
                    .await
                    .map_err(|e| format!("Failed to inspect URL: {}", e))?
            }
        };

        let response_time_ms = start_time.elapsed().as_millis() as u64;
        let headers = resp.headers();

        let mut file_size = headers
            .get(CONTENT_LENGTH)
            .and_then(|v| v.to_str().ok())
            .and_then(|v| v.parse::<u64>().ok())
            .unwrap_or(0);

        // Check Content-Range for actual full length if 206 Partial Content
        if let Some(cr) = headers.get("content-range").and_then(|v| v.to_str().ok()) {
            if let Some(total_str) = cr.split('/').last() {
                if let Ok(total) = total_str.trim().parse::<u64>() {
                    file_size = total;
                }
            }
        }

        let range_supported = headers
            .get(ACCEPT_RANGES)
            .and_then(|v| v.to_str().ok())
            .map(|v| v.to_lowercase().contains("bytes"))
            .unwrap_or(file_size > 0);

        let content_type = headers
            .get(CONTENT_TYPE)
            .and_then(|v| v.to_str().ok())
            .unwrap_or("application/octet-stream")
            .to_string();

        let etag = headers
            .get(ETAG)
            .and_then(|v| v.to_str().ok())
            .map(|s| s.to_string());

        let last_modified = headers
            .get(LAST_MODIFIED)
            .and_then(|v| v.to_str().ok())
            .map(|s| s.to_string());

        let server = headers
            .get("server")
            .and_then(|v| v.to_str().ok())
            .map(|s| s.to_string());

        let mut filename = String::new();
        if let Some(cd) = headers.get(CONTENT_DISPOSITION).and_then(|v| v.to_str().ok()) {
            if let Some(idx) = cd.find("filename=") {
                let name = &cd[idx + 9..];
                filename = name.trim_matches('"').trim_matches('\'').trim().to_string();
            }
        }

        if filename.is_empty() {
            if let Ok(parsed_url) = reqwest::Url::parse(url) {
                if let Some(segments) = parsed_url.path_segments() {
                    if let Some(last) = segments.last() {
                        let decoded = urlencoding::decode(last).unwrap_or_default().to_string();
                        if !decoded.is_empty() && decoded.contains('.') {
                            filename = decoded;
                        }
                    }
                }
            }
        }

        if filename.is_empty() {
            let ext = if content_type.contains("video") || url.contains(".mp4") || url.contains(".ts") {
                "mp4"
            } else if content_type.contains("audio") || url.contains(".mp3") || url.contains(".m4a") {
                "mp3"
            } else {
                "bin"
            };
            filename = format!("download_{}.{}", Uuid::new_v4().to_string().chars().take(8).collect::<String>(), ext);
        }

        let category = Self::detect_category(&filename);
        let suggested_threads = if range_supported && file_size > 10 * 1024 * 1024 {
            16
        } else if range_supported && file_size > 2 * 1024 * 1024 {
            8
        } else {
            1
        };

        Ok(UrlAnalysisResult {
            url: url.to_string(),
            filename,
            file_size,
            range_supported,
            resume_supported: range_supported,
            content_type,
            suggested_threads,
            response_time_ms,
            etag,
            last_modified,
            category,
            server,
        })
    }

    pub fn detect_category(filename: &str) -> String {
        let ext = Path::new(filename)
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_lowercase();

        match ext.as_str() {
            "exe" | "msi" | "dmg" | "pkg" | "deb" | "rpm" | "apk" => "Software".to_string(),
            "zip" | "rar" | "7z" | "tar" | "gz" | "bz2" | "xz" => "Archives".to_string(),
            "pdf" | "doc" | "docx" | "xls" | "xlsx" | "ppt" | "pptx" | "txt" | "epub" => {
                "Documents".to_string()
            }
            "mp4" | "mkv" | "avi" | "mov" | "wmv" | "flv" | "webm" | "m4s" | "ts" => "Videos".to_string(),
            "mp3" | "flac" | "wav" | "aac" | "ogg" | "m4a" | "opus" => "Music".to_string(),
            "png" | "jpg" | "jpeg" | "gif" | "svg" | "webp" | "psd" | "ai" => "Images".to_string(),
            "iso" | "img" | "vmdk" | "qcow2" => "ISOs".to_string(),
            "rs" | "js" | "py" | "cpp" | "c" | "go" | "java" | "html" | "css" | "json" | "yaml" => {
                "Programming".to_string()
            }
            "pak" | "obb" | "rom" => "Games".to_string(),
            "inf" | "sys" | "dll" => "Drivers".to_string(),
            _ => "Unknown".to_string(),
        }
    }

    pub async fn create_download(
        &self,
        url: String,
        save_dir: Option<String>,
        custom_filename: Option<String>,
        connections: Option<u32>,
        priority: Option<DownloadPriority>,
        category: Option<String>,
        tags: Option<Vec<String>>,
        notes: Option<String>,
        custom_headers: Option<HashMap<String, String>>,
    ) -> Result<Download, String> {
        let analysis_res = self.analyze_url_with_headers(&url, custom_headers.as_ref()).await;

        let (analysis_size, analysis_range, analysis_category, default_filename, analysis_etag, analysis_last_modified) = match analysis_res {
            Ok(ref a) => (a.file_size, a.range_supported, a.category.clone(), a.filename.clone(), a.etag.clone(), a.last_modified.clone()),
            Err(_) => (0, false, "Unknown".to_string(), "download.bin".to_string(), None, None),
        };

        // Always honor custom_filename if provided
        let filename = custom_filename.unwrap_or(default_filename);
        let save_location = if let Some(dir) = save_dir {
            PathBuf::from(dir).join(&filename).to_string_lossy().to_string()
        } else {
            let default_dir = dirs::download_dir().unwrap_or_else(|| PathBuf::from("./downloads"));
            default_dir.join(&filename).to_string_lossy().to_string()
        };

        let conn_count = connections.unwrap_or(if analysis_range { 16 } else { 1 }).clamp(1, 32);
        let num_connections = if analysis_range && analysis_size > 1024 * 1024 {
            conn_count
        } else {
            1
        };

        let mut chunks = Vec::new();
        if analysis_size > 0 && num_connections > 1 {
            let chunk_size = analysis_size / (num_connections as u64);
            for i in 0..num_connections {
                let start = (i as u64) * chunk_size;
                let end = if i == num_connections - 1 {
                    analysis_size - 1
                } else {
                    ((i + 1) as u64) * chunk_size - 1
                };

                chunks.push(ChunkState {
                    index: i,
                    start_byte: start,
                    end_byte: end,
                    downloaded_bytes: 0,
                    speed: 0,
                    status: "pending".to_string(),
                });
            }
        } else {
            chunks.push(ChunkState {
                index: 0,
                start_byte: 0,
                end_byte: if analysis_size > 0 { analysis_size - 1 } else { 0 },
                downloaded_bytes: 0,
                speed: 0,
                status: "pending".to_string(),
            });
        }

        let mut download = Download {
            id: Uuid::new_v4().to_string(),
            url,
            headers: custom_headers.unwrap_or_default(),
            filename,
            save_location,
            category: category.unwrap_or(analysis_category),
            status: DownloadStatus::Queued,
            priority: priority.unwrap_or(DownloadPriority::Normal),
            connections: num_connections,
            speed: 0,
            average_speed: 0,
            peak_speed: 0,
            downloaded_bytes: 0,
            total_bytes: analysis_size,
            remaining_bytes: analysis_size,
            eta_seconds: None,
            created_at: chrono::Utc::now().timestamp_millis(),
            started_at: None,
            completed_at: None,
            retries: 0,
            mirror_list: Vec::new(),
            etag: analysis_etag,
            last_modified: analysis_last_modified,
            range_supported: analysis_range,
            sha256: None,
            md5: None,
            sha1: None,
            tags: tags.unwrap_or_default(),
            notes: notes.unwrap_or_default(),
            error_message: None,
            chunks,
            speed_limit_bytes: None,
            proxy_url: None,
            scheduled_start: None,
            post_webhook_command: None,
            audio_url: None,
        };

        // Apply Visual Rules Evaluation
        if let Ok(rules) = get_all_rules(&self.db).await {
            RuleEvaluator::evaluate_and_apply(&rules, &mut download);
        }

        save_or_update_download(&self.db, &download)
            .await
            .map_err(|e| format!("Failed to save download: {}", e))?;

        Ok(download)
    }

    pub async fn start_download(&self, mut download: Download) -> Result<(), String> {
        let download_id = download.id.clone();

        // Check if already active
        {
            let active = self.active_tasks.lock().await;
            if active.contains_key(&download_id) {
                return Ok(());
            }
        }

        let is_cancelled = Arc::new(AtomicBool::new(false));
        let is_paused = Arc::new(AtomicBool::new(false));
        let mut chunk_counters = Vec::new();

        for chunk in &download.chunks {
            chunk_counters.push(Arc::new(AtomicU64::new(chunk.downloaded_bytes)));
        }

        {
            let mut active = self.active_tasks.lock().await;
            active.insert(
                download_id.clone(),
                ActiveDownloadTask {
                    is_cancelled: is_cancelled.clone(),
                    is_paused: is_paused.clone(),
                    chunk_counters: chunk_counters.clone(),
                },
            );
        }

        download.status = DownloadStatus::Downloading;
        download.started_at = Some(chrono::Utc::now().timestamp_millis());
        save_or_update_download(&self.db, &download).await.ok();

        let engine = self.clone();
        let target_path = PathBuf::from(&download.save_location);
        let part_path = get_part_file_path(&target_path);

        // Auto-detect HLS streams (.m3u8) and run parallel chunk stitching
        if download.url.contains(".m3u8") || download.filename.ends_with(".m3u8") {
            let engine_clone = engine.clone();
            let is_cancelled_clone = is_cancelled.clone();
            let is_paused_clone = is_paused.clone();
            tauri::async_runtime::spawn(async move {
                let _ = crate::core::hls::HlsSegmentDownloader::run_hls_download(
                    download,
                    engine_clone.client.clone(),
                    engine_clone.db.clone(),
                    engine_clone.app_handle.clone(),
                    is_cancelled_clone,
                    is_paused_clone,
                )
                .await;
                let mut active = engine_clone.active_tasks.lock().await;
                active.remove(&download_id);
            });
            return Ok(());
        }

        tauri::async_runtime::spawn(async move {
            let file_result = preallocate_file(&part_path, download.total_bytes);
            let file = match file_result {
                Ok(f) => Arc::new(std::sync::Mutex::new(f)),
                Err(e) => {
                    download.status = DownloadStatus::Failed;
                    download.error_message = Some(format!("Failed to prepare file: {}", e));
                    save_or_update_download(&engine.db, &download).await.ok();
                    let mut active = engine.active_tasks.lock().await;
                    active.remove(&download_id);
                    return;
                }
            };

            // Prepare Proxy Client if configured
            let worker_client = if let Some(ref proxy_addr) = download.proxy_url {
                if let Ok(proxy) = Proxy::all(proxy_addr) {
                    Client::builder()
                        .proxy(proxy)
                        .timeout(Duration::from_secs(30))
                        .build()
                        .unwrap_or_else(|_| engine.client.clone())
                } else {
                    engine.client.clone()
                }
            } else {
                engine.client.clone()
            };

            // Multi-Source Mirror Swarming: Distribute chunks across mirror list if available
            let mirror_count = download.mirror_list.len();

            for (idx, chunk) in download.chunks.iter().enumerate() {
                let chunk_target_url = if mirror_count > 0 {
                    download.mirror_list[idx % mirror_count].clone()
                } else {
                    download.url.clone()
                };

                let worker = ChunkWorker {
                    index: chunk.index,
                    url: chunk_target_url,
                    headers: download.headers.clone(),
                    start_byte: chunk.start_byte,
                    end_byte: chunk.end_byte,
                    downloaded: chunk_counters[idx].clone(),
                    is_cancelled: is_cancelled.clone(),
                    is_paused: is_paused.clone(),
                    speed_limit_bytes: download.speed_limit_bytes,
                };

                let client_clone = worker_client.clone();
                let file_clone = file.clone();
                tauri::async_runtime::spawn(async move {
                    worker.run(client_clone, file_clone).await
                });
            }

            // Throttled Telemetry Dispatcher & Dynamic Tail-Chunk Watcher (100ms / 10Hz)
            let mut last_tick = Instant::now();
            let mut last_total_downloaded = download.downloaded_bytes;
            let mut peak_speed = download.peak_speed;
            let start_instant = Instant::now();

            loop {
                tokio::time::sleep(Duration::from_millis(100)).await;

                if is_cancelled.load(Ordering::Relaxed) {
                    download.status = DownloadStatus::Cancelled;
                    break;
                }
                if is_paused.load(Ordering::Relaxed) {
                    download.status = DownloadStatus::Paused;
                    break;
                }

                let elapsed_tick = last_tick.elapsed().as_secs_f64();
                if elapsed_tick >= 0.1 {
                    let mut current_total = 0u64;
                    let mut updated_chunks = download.chunks.clone();

                    for (idx, counter) in chunk_counters.iter().enumerate() {
                        let dl = counter.load(Ordering::Relaxed);
                        current_total += dl;
                        if idx < updated_chunks.len() {
                            updated_chunks[idx].downloaded_bytes = dl;
                            let chunk_size = updated_chunks[idx].end_byte.saturating_sub(updated_chunks[idx].start_byte) + 1;
                            if dl >= chunk_size {
                                updated_chunks[idx].status = "completed".to_string();
                            } else {
                                updated_chunks[idx].status = "downloading".to_string();
                            }
                        }
                    }

                    let bytes_since_tick = current_total.saturating_sub(last_total_downloaded);
                    let current_speed = (bytes_since_tick as f64 / elapsed_tick) as u64;
                    if current_speed > peak_speed {
                        peak_speed = current_speed;
                    }

                    let total_elapsed = start_instant.elapsed().as_secs_f64();
                    let average_speed = if total_elapsed > 0.0 {
                        (current_total as f64 / total_elapsed) as u64
                    } else {
                        0
                    };

                    let remaining = download.total_bytes.saturating_sub(current_total);
                    let eta = if current_speed > 0 {
                        Some(remaining / current_speed)
                    } else {
                        None
                    };

                    download.downloaded_bytes = current_total;
                    download.remaining_bytes = remaining;
                    download.speed = current_speed;
                    download.peak_speed = peak_speed;
                    download.average_speed = average_speed;
                    download.eta_seconds = eta;
                    download.chunks = updated_chunks.clone();

                    last_tick = Instant::now();
                    last_total_downloaded = current_total;

                    let all_chunks_completed = updated_chunks.iter().all(|c| c.status == "completed");

                    if let Some(ref handle) = engine.app_handle {
                        handle
                            .emit(
                                "download-progress",
                                DownloadProgressEvent {
                                    id: download.id.clone(),
                                    status: download.status,
                                    downloaded_bytes: current_total,
                                    total_bytes: download.total_bytes,
                                    speed: current_speed,
                                    eta_seconds: eta,
                                    chunks: updated_chunks.clone(),
                                },
                            )
                            .ok();
                    }

                    // Check if complete
                    if (download.total_bytes > 0 && current_total >= download.total_bytes) || all_chunks_completed {
                        download.status = DownloadStatus::Completed;
                        break;
                    }
                }
            }

            // Cleanup & Post-processing
            {
                let mut active = engine.active_tasks.lock().await;
                active.remove(&download_id);
            }

            if download.status == DownloadStatus::Completed {
                download.completed_at = Some(chrono::Utc::now().timestamp_millis());
                download.speed = 0;
                download.eta_seconds = None;

                // Move .orbit.part to final filename
                finalize_download(&part_path, &target_path).ok();

                // Compute Checksums
                if let Ok(checksum) = calculate_checksums(&target_path) {
                    download.sha256 = Some(checksum.sha256);
                    download.md5 = Some(checksum.md5);
                    download.sha1 = Some(checksum.sha1);
                }

                // Execute Post-Download Shell Webhook if configured
                if let Some(ref cmd_template) = download.post_webhook_command {
                    let cmd_str = cmd_template
                        .replace("{FILE}", &download.save_location)
                        .replace("{DIR}", &target_path.parent().map(|p| p.to_string_lossy().to_string()).unwrap_or_default())
                        .replace("{SIZE}", &download.total_bytes.to_string())
                        .replace("{NAME}", &download.filename);

                    info!("Executing post-download webhook command: {}", cmd_str);
                    #[cfg(target_os = "windows")]
                    let _ = Command::new("cmd").args(["/C", &cmd_str]).spawn();
                    #[cfg(not(target_os = "windows"))]
                    let _ = Command::new("sh").args(["-c", &cmd_str]).spawn();
                }

                if let Some(ref handle) = engine.app_handle {
                    handle.emit("download-completed", download.clone()).ok();
                }
            }

            save_or_update_download(&engine.db, &download).await.ok();
        });

        Ok(())
    }

    pub async fn pause_download(&self, id: &str) -> Result<(), String> {
        let active = self.active_tasks.lock().await;
        if let Some(task) = active.get(id) {
            task.is_paused.store(true, Ordering::Relaxed);
        }
        Ok(())
    }

    pub async fn cancel_download(&self, id: &str) -> Result<(), String> {
        let active = self.active_tasks.lock().await;
        if let Some(task) = active.get(id) {
            task.is_cancelled.store(true, Ordering::Relaxed);
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_detect_category() {
        assert_eq!(DownloadEngine::detect_category("installer.exe"), "Software");
        assert_eq!(DownloadEngine::detect_category("archive.tar.gz"), "Archives");
        assert_eq!(DownloadEngine::detect_category("report.pdf"), "Documents");
        assert_eq!(DownloadEngine::detect_category("movie.mp4"), "Videos");
        assert_eq!(DownloadEngine::detect_category("track.flac"), "Music");
        assert_eq!(DownloadEngine::detect_category("photo.png"), "Images");
        assert_eq!(DownloadEngine::detect_category("ubuntu.iso"), "ISOs");
        assert_eq!(DownloadEngine::detect_category("main.rs"), "Programming");
    }

    #[test]
    fn test_chunk_splitting_boundaries() {
        let file_size = 100_000_000u64; // 100 MB
        let num_connections = 8u32;
        let chunk_size = file_size / (num_connections as u64);

        let mut chunks = Vec::new();
        for i in 0..num_connections {
            let start = (i as u64) * chunk_size;
            let end = if i == num_connections - 1 {
                file_size - 1
            } else {
                ((i + 1) as u64) * chunk_size - 1
            };
            chunks.push((start, end));
        }

        assert_eq!(chunks.len(), 8);
        assert_eq!(chunks[0].0, 0);
        assert_eq!(chunks[7].1, file_size - 1);

        // Ensure contiguous without gaps
        for i in 0..chunks.len() - 1 {
            assert_eq!(chunks[i].1 + 1, chunks[i + 1].0);
        }
    }
}
