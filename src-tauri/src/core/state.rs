use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum DownloadStatus {
    Queued,
    Starting,
    Connecting,
    Downloading,
    Paused,
    Verifying,
    Completed,
    Failed,
    Cancelled,
    Waiting,
    Retrying,
    Scheduled,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum DownloadPriority {
    Low,
    Normal,
    High,
    Urgent,
}

impl Default for DownloadPriority {
    fn default() -> Self {
        DownloadPriority::Normal
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChunkState {
    pub index: u32,
    pub start_byte: u64,
    pub end_byte: u64,
    pub downloaded_bytes: u64,
    pub speed: u64,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Download {
    pub id: String,
    pub url: String,
    pub headers: HashMap<String, String>,
    pub filename: String,
    pub save_location: String,
    pub category: String,
    pub status: DownloadStatus,
    pub priority: DownloadPriority,
    pub connections: u32,
    pub speed: u64,
    pub average_speed: u64,
    pub peak_speed: u64,
    pub downloaded_bytes: u64,
    pub total_bytes: u64,
    pub remaining_bytes: u64,
    pub eta_seconds: Option<u64>,
    pub created_at: i64,
    pub started_at: Option<i64>,
    pub completed_at: Option<i64>,
    pub retries: u32,
    pub mirror_list: Vec<String>,
    pub etag: Option<String>,
    pub last_modified: Option<String>,
    pub range_supported: bool,
    pub sha256: Option<String>,
    pub md5: Option<String>,
    pub sha1: Option<String>,
    pub tags: Vec<String>,
    pub notes: String,
    pub error_message: Option<String>,
    pub chunks: Vec<ChunkState>,
    pub speed_limit_bytes: Option<u64>,
    pub proxy_url: Option<String>,
    pub scheduled_start: Option<i64>,
    pub post_webhook_command: Option<String>,
    pub audio_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UrlAnalysisResult {
    pub url: String,
    pub filename: String,
    pub file_size: u64,
    pub range_supported: bool,
    pub resume_supported: bool,
    pub content_type: String,
    pub suggested_threads: u32,
    pub response_time_ms: u64,
    pub etag: Option<String>,
    pub last_modified: Option<String>,
    pub category: String,
    pub server: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadProgressEvent {
    pub id: String,
    pub status: DownloadStatus,
    pub downloaded_bytes: u64,
    pub total_bytes: u64,
    pub speed: u64,
    pub eta_seconds: Option<u64>,
    pub chunks: Vec<ChunkState>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemStats {
    pub cpu_usage: f32,
    pub memory_used_mb: u64,
    pub memory_total_mb: u64,
    pub disk_free_gb: u64,
    pub disk_total_gb: u64,
    pub active_downloads: usize,
    pub total_speed_bytes_sec: u64,
}
