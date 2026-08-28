pub mod api;
pub mod core;
pub mod database;
pub mod filesystem;
pub mod integrity;
pub mod queue;
pub mod rules;

use api::commands::{self, AppState};
use api::ipc_server::ExtensionServer;
use core::engine::DownloadEngine;
use database::init_db;
use queue::QueueManager;
use std::path::PathBuf;
use tauri::Manager;

pub fn run() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info")),
        )
        .init();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            let app_handle = app.handle().clone();
            let app_data_dir = app
                .path()
                .app_data_dir()
                .unwrap_or_else(|_| PathBuf::from("./data"));

            let db_path = app_data_dir.join("orbit.db");

            // Block on async DB init during setup
            let db = tauri::async_runtime::block_on(async {
                init_db(&db_path)
                    .await
                    .expect("Failed to initialize SQLite database")
            });

            let engine = DownloadEngine::new(db, Some(app_handle));
            
            // Start queue background scheduler
            let queue_mgr = QueueManager::new(engine.clone(), 3);
            queue_mgr.start_scheduler_loop();

            // Start local browser extension IPC server on 127.0.0.1:41718
            let ext_server = ExtensionServer::new(engine.clone());
            ext_server.start();

            app.manage(AppState { engine });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::analyze_url,
            commands::add_download,
            commands::start_download,
            commands::pause_download,
            commands::resume_download,
            commands::cancel_download,
            commands::delete_download,
            commands::get_downloads,
            commands::open_file,
            commands::open_folder,
            commands::verify_checksum,
            commands::get_system_stats,
            commands::get_default_download_dir,
            commands::get_rules,
            commands::save_rule,
            commands::delete_rule,
            commands::toggle_rule,
            commands::check_for_updates,
            commands::add_batch_downloads,
            commands::parse_magnet_link,
            commands::set_download_speed_limit,
            commands::pause_all_downloads,
            commands::resume_all_downloads,
            commands::clear_all_downloads,
            commands::delete_multiple_downloads,
        ])
        .run(tauri::generate_context!())
        .expect("Error while running Orbit Download Manager");
}
