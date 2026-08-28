use futures_util::StreamExt;
use reqwest::{Client, StatusCode};
use std::collections::HashMap;
use std::fs::File;
use std::io::{Seek, SeekFrom, Write};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::time::sleep;

pub struct ChunkWorker {
    pub index: u32,
    pub url: String,
    pub headers: HashMap<String, String>,
    pub start_byte: u64,
    pub end_byte: u64,
    pub downloaded: Arc<AtomicU64>,
    pub is_cancelled: Arc<AtomicBool>,
    pub is_paused: Arc<AtomicBool>,
    pub speed_limit_bytes: Option<u64>,
}

impl ChunkWorker {
    pub async fn run(
        self,
        client: Client,
        file: Arc<std::sync::Mutex<File>>,
    ) -> Result<(), String> {
        let max_retries = 3;
        let mut attempt = 0;

        loop {
            let current_offset = self.start_byte + self.downloaded.load(Ordering::Relaxed);
            if current_offset > self.end_byte {
                return Ok(());
            }

            if self.is_cancelled.load(Ordering::Relaxed) {
                return Err("Download cancelled".to_string());
            }
            if self.is_paused.load(Ordering::Relaxed) {
                return Ok(());
            }

            let range_header = format!("bytes={}-{}", current_offset, self.end_byte);
            let mut req_builder = client.get(&self.url).header("Range", range_header);

            for (k, v) in &self.headers {
                req_builder = req_builder.header(k, v);
            }

            let resp_result = req_builder.send().await;

            let resp = match resp_result {
                Ok(r) => r,
                Err(e) => {
                    attempt += 1;
                    if attempt >= max_retries {
                        return Err(format!("Network request failed after {} retries: {}", attempt, e));
                    }
                    sleep(Duration::from_millis(500 * attempt)).await;
                    continue;
                }
            };

            let status = resp.status();

            // Detect IP Rate Limiting (HTTP 429) or temporary server overload (HTTP 503)
            if status == StatusCode::TOO_MANY_REQUESTS || status == StatusCode::SERVICE_UNAVAILABLE {
                attempt += 1;
                if attempt >= max_retries {
                    return Err(format!("Server rate-limited connection (HTTP {}) after {} attempts", status, attempt));
                }
                sleep(Duration::from_millis(1000 * (1 << attempt))).await;
                continue;
            }

            if !status.is_success() && status != StatusCode::PARTIAL_CONTENT {
                return Err(format!("Server returned HTTP status {}", status));
            }

            let mut stream = resp.bytes_stream();
            let mut write_pos = current_offset;
            let mut stream_error = false;

            // Token Bucket Rate Limiter state
            let mut rate_window_start = Instant::now();
            let mut bytes_in_window = 0u64;

            while let Some(chunk_result) = stream.next().await {
                if self.is_cancelled.load(Ordering::Relaxed) {
                    return Err("Download cancelled".to_string());
                }
                if self.is_paused.load(Ordering::Relaxed) {
                    return Ok(());
                }

                let chunk = match chunk_result {
                    Ok(c) => c,
                    Err(e) => {
                        stream_error = true;
                        tracing::warn!("Chunk worker {} stream interrupted: {}. Retrying range...", self.index, e);
                        break;
                    }
                };

                let chunk_len = chunk.len() as u64;

                {
                    let mut guard = file.lock().map_err(|_| "File lock poisoned".to_string())?;
                    guard
                        .seek(SeekFrom::Start(write_pos))
                        .map_err(|e| format!("Seek failed: {}", e))?;
                    guard
                        .write_all(&chunk)
                        .map_err(|e| format!("Write failed: {}", e))?;
                }

                write_pos += chunk_len;
                self.downloaded.fetch_add(chunk_len, Ordering::Relaxed);
                bytes_in_window += chunk_len;

                // Enforce Token Bucket Rate Limiter
                if let Some(limit_per_sec) = self.speed_limit_bytes {
                    if limit_per_sec > 0 {
                        let elapsed = rate_window_start.elapsed().as_secs_f64();
                        let expected_time = bytes_in_window as f64 / limit_per_sec as f64;
                        if expected_time > elapsed {
                            let sleep_dur = Duration::from_secs_f64(expected_time - elapsed);
                            if sleep_dur > Duration::from_millis(5) {
                                sleep(sleep_dur).await;
                            }
                        }

                        if elapsed >= 1.0 {
                            rate_window_start = Instant::now();
                            bytes_in_window = 0;
                        }
                    }
                }
            }

            if stream_error {
                attempt += 1;
                if attempt >= max_retries {
                    return Err(format!("Stream failed after {} retry attempts", attempt));
                }
                sleep(Duration::from_millis(500 * attempt)).await;
                continue;
            }

            return Ok(());
        }
    }
}
