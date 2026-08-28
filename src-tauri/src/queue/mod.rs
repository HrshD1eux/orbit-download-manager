use crate::core::engine::DownloadEngine;
use crate::core::state::{Download, DownloadPriority, DownloadStatus};
use crate::database::{get_all_downloads, save_or_update_download};
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::Arc;
use std::time::Duration;

pub struct QueueManager {
    pub engine: DownloadEngine,
    pub max_active: Arc<AtomicU32>,
}

impl QueueManager {
    pub fn new(engine: DownloadEngine, max_active: u32) -> Self {
        Self {
            engine,
            max_active: Arc::new(AtomicU32::new(max_active)),
        }
    }

    pub fn set_max_active(&self, max: u32) {
        self.max_active.store(max, Ordering::Relaxed);
    }

    pub fn start_scheduler_loop(&self) {
        let engine = self.engine.clone();
        let max_active = self.max_active.clone();

        tauri::async_runtime::spawn(async move {
            loop {
                tokio::time::sleep(Duration::from_millis(500)).await;

                let now_ms = chrono::Utc::now().timestamp_millis();

                if let Ok(downloads) = get_all_downloads(&engine.db).await {
                    // 1. Process Scheduled Downloads
                    for mut d in downloads.iter().cloned() {
                        if d.status == DownloadStatus::Scheduled {
                            if let Some(target_time) = d.scheduled_start {
                                if now_ms >= target_time {
                                    d.status = DownloadStatus::Queued;
                                    save_or_update_download(&engine.db, &d).await.ok();
                                }
                            }
                        }
                    }

                    // 2. Process Queued Downloads
                    let active_count = {
                        let active = engine.active_tasks.lock().await;
                        active.len()
                    };

                    let limit = max_active.load(Ordering::Relaxed) as usize;
                    if active_count < limit {
                        let mut queued: Vec<Download> = downloads
                            .into_iter()
                            .filter(|d| d.status == DownloadStatus::Queued)
                            .collect();

                        // Sort by priority (Urgent > High > Normal > Low) then created_at
                        queued.sort_by(|a, b| {
                            let p_order = |p: DownloadPriority| match p {
                                DownloadPriority::Urgent => 0,
                                DownloadPriority::High => 1,
                                DownloadPriority::Normal => 2,
                                DownloadPriority::Low => 3,
                            };
                            p_order(a.priority)
                                .cmp(&p_order(b.priority))
                                .then(a.created_at.cmp(&b.created_at))
                        });

                        let slots_available = limit - active_count;
                        for download in queued.into_iter().take(slots_available) {
                            engine.start_download(download).await.ok();
                        }
                    }
                }
            }
        });
    }
}
