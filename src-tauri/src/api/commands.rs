use crate::core::engine::DownloadEngine;
use crate::core::state::{Download, DownloadPriority, DownloadStatus, SystemStats, UrlAnalysisResult};
use crate::database::{
    delete_download as db_delete, delete_rule as db_delete_rule, get_all_downloads, get_all_rules,
    save_or_update_download, save_or_update_rule as db_save_rule, toggle_rule as db_toggle_rule,
};
use crate::integrity::calculate_checksums;
use crate::rules::types::Rule;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use sysinfo::{Disks, System};
use tauri::State;

pub struct AppState {
    pub engine: DownloadEngine,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateCheckResult {
    pub current_version: String,
    pub latest_version: String,
    pub is_up_to_date: bool,
    pub release_notes: String,
    pub download_url: String,
}

#[tauri::command]
pub async fn analyze_url(
    url: String,
    state: State<'_, AppState>,
) -> Result<UrlAnalysisResult, String> {
    state.engine.analyze_url(&url).await
}

#[tauri::command]
pub async fn add_download(
    url: String,
    save_dir: Option<String>,
    custom_filename: Option<String>,
    connections: Option<u32>,
    priority: Option<DownloadPriority>,
    category: Option<String>,
    tags: Option<Vec<String>>,
    notes: Option<String>,
    auto_start: Option<bool>,
    state: State<'_, AppState>,
) -> Result<Download, String> {
    let download = state
        .engine
        .create_download(
            url,
            save_dir,
            custom_filename,
            connections,
            priority,
            category,
            tags,
            notes,
            None,
        )
        .await?;

    if auto_start.unwrap_or(true) {
        state.engine.start_download(download.clone()).await?;
    }

    Ok(download)
}

#[tauri::command]
pub async fn start_download(id: String, state: State<'_, AppState>) -> Result<(), String> {
    let downloads = get_all_downloads(&state.engine.db)
        .await
        .map_err(|e| e.to_string())?;

    if let Some(mut download) = downloads.into_iter().find(|d| d.id == id) {
        download.status = DownloadStatus::Queued;
        save_or_update_download(&state.engine.db, &download)
            .await
            .map_err(|e| e.to_string())?;
        state.engine.start_download(download).await?;
        Ok(())
    } else {
        Err("Download not found".to_string())
    }
}

#[tauri::command]
pub async fn pause_download(id: String, state: State<'_, AppState>) -> Result<(), String> {
    state.engine.pause_download(&id).await?;
    let downloads = get_all_downloads(&state.engine.db)
        .await
        .map_err(|e| e.to_string())?;

    if let Some(mut download) = downloads.into_iter().find(|d| d.id == id) {
        download.status = DownloadStatus::Paused;
        download.speed = 0;
        download.eta_seconds = None;
        save_or_update_download(&state.engine.db, &download)
            .await
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn resume_download(id: String, state: State<'_, AppState>) -> Result<(), String> {
    start_download(id, state).await
}

#[tauri::command]
pub async fn cancel_download(id: String, state: State<'_, AppState>) -> Result<(), String> {
    state.engine.cancel_download(&id).await?;
    let downloads = get_all_downloads(&state.engine.db)
        .await
        .map_err(|e| e.to_string())?;

    if let Some(mut download) = downloads.into_iter().find(|d| d.id == id) {
        download.status = DownloadStatus::Cancelled;
        download.speed = 0;
        download.eta_seconds = None;
        save_or_update_download(&state.engine.db, &download)
            .await
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn delete_download(
    id: String,
    delete_file: bool,
    state: State<'_, AppState>,
) -> Result<(), String> {
    state.engine.cancel_download(&id).await.ok();

    let downloads = get_all_downloads(&state.engine.db)
        .await
        .map_err(|e| e.to_string())?;

    if let Some(download) = downloads.into_iter().find(|d| d.id == id) {
        if delete_file {
            let path = PathBuf::from(&download.save_location);
            if path.exists() {
                std::fs::remove_file(&path).ok();
            }
            let part_path = crate::filesystem::get_part_file_path(&path);
            if part_path.exists() {
                std::fs::remove_file(&part_path).ok();
            }
        }
    }

    db_delete(&state.engine.db, &id)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn pause_all_downloads(state: State<'_, AppState>) -> Result<(), String> {
    let downloads = get_all_downloads(&state.engine.db)
        .await
        .map_err(|e| e.to_string())?;

    for mut download in downloads {
        if download.status == DownloadStatus::Downloading || download.status == DownloadStatus::Queued {
            state.engine.pause_download(&download.id).await.ok();
            download.status = DownloadStatus::Paused;
            download.speed = 0;
            download.eta_seconds = None;
            save_or_update_download(&state.engine.db, &download).await.ok();
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn resume_all_downloads(state: State<'_, AppState>) -> Result<(), String> {
    let downloads = get_all_downloads(&state.engine.db)
        .await
        .map_err(|e| e.to_string())?;

    for mut download in downloads {
        if download.status == DownloadStatus::Paused || download.status == DownloadStatus::Failed || download.status == DownloadStatus::Cancelled {
            download.status = DownloadStatus::Queued;
            save_or_update_download(&state.engine.db, &download).await.ok();
            state.engine.start_download(download).await.ok();
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn clear_all_downloads(delete_files: bool, state: State<'_, AppState>) -> Result<(), String> {
    let downloads = get_all_downloads(&state.engine.db)
        .await
        .map_err(|e| e.to_string())?;

    for download in downloads {
        state.engine.cancel_download(&download.id).await.ok();
        if delete_files {
            let path = PathBuf::from(&download.save_location);
            if path.exists() {
                std::fs::remove_file(&path).ok();
            }
            let part_path = crate::filesystem::get_part_file_path(&path);
            if part_path.exists() {
                std::fs::remove_file(&part_path).ok();
            }
        }
        db_delete(&state.engine.db, &download.id).await.ok();
    }
    Ok(())
}

#[tauri::command]
pub async fn delete_multiple_downloads(ids: Vec<String>, delete_files: bool, state: State<'_, AppState>) -> Result<(), String> {
    let downloads = get_all_downloads(&state.engine.db)
        .await
        .map_err(|e| e.to_string())?;

    for id in ids {
        state.engine.cancel_download(&id).await.ok();
        if let Some(download) = downloads.iter().find(|d| d.id == id) {
            if delete_files {
                let path = PathBuf::from(&download.save_location);
                if path.exists() {
                    std::fs::remove_file(&path).ok();
                }
                let part_path = crate::filesystem::get_part_file_path(&path);
                if part_path.exists() {
                    std::fs::remove_file(&part_path).ok();
                }
            }
        }
        db_delete(&state.engine.db, &id).await.ok();
    }
    Ok(())
}

#[tauri::command]
pub async fn get_downloads(state: State<'_, AppState>) -> Result<Vec<Download>, String> {
    get_all_downloads(&state.engine.db)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn open_file(path: String) -> Result<(), String> {
    open::that(path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn open_folder(path: String) -> Result<(), String> {
    let p = PathBuf::from(path);
    if let Some(parent) = p.parent() {
        open::that(parent).map_err(|e| e.to_string())
    } else {
        open::that(p).map_err(|e| e.to_string())
    }
}

#[tauri::command]
pub async fn verify_checksum(
    id: String,
    expected_hash: String,
    hash_type: String,
    state: State<'_, AppState>,
) -> Result<bool, String> {
    let downloads = get_all_downloads(&state.engine.db)
        .await
        .map_err(|e| e.to_string())?;

    if let Some(mut download) = downloads.into_iter().find(|d| d.id == id) {
        let checksums = calculate_checksums(&download.save_location).map_err(|e| e.to_string())?;
        download.sha256 = Some(checksums.sha256.clone());
        download.md5 = Some(checksums.md5.clone());
        download.sha1 = Some(checksums.sha1.clone());
        save_or_update_download(&state.engine.db, &download)
            .await
            .map_err(|e| e.to_string())?;

        let matches = match hash_type.to_lowercase().as_str() {
            "sha256" => checksums.sha256.eq_ignore_ascii_case(&expected_hash),
            "md5" => checksums.md5.eq_ignore_ascii_case(&expected_hash),
            "sha1" => checksums.sha1.eq_ignore_ascii_case(&expected_hash),
            _ => false,
        };

        Ok(matches)
    } else {
        Err("Download not found".to_string())
    }
}

#[tauri::command]
pub async fn get_system_stats(state: State<'_, AppState>) -> Result<SystemStats, String> {
    let mut sys = System::new_all();
    sys.refresh_all();

    let disks = Disks::new_with_refreshed_list();
    let (disk_free, disk_total) = disks.iter().fold((0u64, 0u64), |(f, t), d| {
        (f + d.available_space(), t + d.total_space())
    });

    let active_downloads = {
        let active = state.engine.active_tasks.lock().await;
        active.len()
    };

    let downloads = get_all_downloads(&state.engine.db).await.unwrap_or_default();
    let total_speed: u64 = downloads
        .iter()
        .filter(|d| d.status == DownloadStatus::Downloading)
        .map(|d| d.speed)
        .sum();

    Ok(SystemStats {
        cpu_usage: sys.global_cpu_usage(),
        memory_used_mb: sys.used_memory() / (1024 * 1024),
        memory_total_mb: sys.total_memory() / (1024 * 1024),
        disk_free_gb: disk_free / (1024 * 1024 * 1024),
        disk_total_gb: disk_total / (1024 * 1024 * 1024),
        active_downloads,
        total_speed_bytes_sec: total_speed,
    })
}

#[tauri::command]
pub fn get_default_download_dir() -> Result<String, String> {
    let dir = dirs::download_dir().unwrap_or_else(|| PathBuf::from("./downloads"));
    Ok(dir.to_string_lossy().to_string())
}

// ----------------------------------------------------------------------------
// RULES IPC COMMANDS
// ----------------------------------------------------------------------------

#[tauri::command]
pub async fn get_rules(state: State<'_, AppState>) -> Result<Vec<Rule>, String> {
    get_all_rules(&state.engine.db)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn save_rule(rule: Rule, state: State<'_, AppState>) -> Result<(), String> {
    db_save_rule(&state.engine.db, &rule)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_rule(id: String, state: State<'_, AppState>) -> Result<(), String> {
    db_delete_rule(&state.engine.db, &id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn toggle_rule(id: String, state: State<'_, AppState>) -> Result<bool, String> {
    db_toggle_rule(&state.engine.db, &id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn check_for_updates() -> Result<UpdateCheckResult, String> {
    Ok(UpdateCheckResult {
        current_version: "1.1.1".into(),
        latest_version: "1.1.1".into(),
        is_up_to_date: true,
        release_notes: "Orbit Download Manager is running the latest stable release.".into(),
        download_url: "https://github.com/HrshD1eux/Flowgrab_Downlaoder/releases".into(),
    })
}

#[tauri::command]
pub async fn add_batch_downloads(
    urls: Vec<String>,
    save_dir: Option<String>,
    auto_start: Option<bool>,
    state: State<'_, AppState>,
) -> Result<Vec<Download>, String> {
    let mut results = Vec::new();
    for u in urls {
        let trimmed = u.trim();
        if !trimmed.is_empty() && (trimmed.starts_with("http://") || trimmed.starts_with("https://") || trimmed.starts_with("ftp://")) {
            if let Ok(d) = state
                .engine
                .create_download(
                    trimmed.to_string(),
                    save_dir.clone(),
                    None,
                    None,
                    None,
                    None,
                    None,
                    None,
                    None,
                )
                .await
            {
                if auto_start.unwrap_or(true) {
                    state.engine.start_download(d.clone()).await.ok();
                }
                results.push(d);
            }
        }
    }
    Ok(results)
}

#[tauri::command]
pub async fn parse_magnet_link(uri: String) -> Result<crate::core::torrent::MagnetMetadata, String> {
    crate::core::torrent::TorrentEngine::parse_magnet(&uri)
}

#[tauri::command]
pub async fn set_download_speed_limit(
    id: String,
    limit_bytes: Option<u64>,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let downloads = get_all_downloads(&state.engine.db)
        .await
        .map_err(|e| e.to_string())?;

    if let Some(mut download) = downloads.into_iter().find(|d| d.id == id) {
        download.speed_limit_bytes = limit_bytes;
        save_or_update_download(&state.engine.db, &download)
            .await
            .map_err(|e| e.to_string())?;
        Ok(())
    } else {
        Err("Download not found".to_string())
    }
}

