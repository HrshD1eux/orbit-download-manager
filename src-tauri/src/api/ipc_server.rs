use crate::core::engine::DownloadEngine;
use serde::Deserialize;
use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};
use tracing::{error, info};

#[derive(Debug, Deserialize)]
struct AddRequest {
    url: String,
    filename: Option<String>,
    headers: Option<HashMap<String, String>>,
}

pub struct ExtensionServer {
    pub engine: DownloadEngine,
}

impl ExtensionServer {
    pub fn new(engine: DownloadEngine) -> Self {
        Self { engine }
    }

    pub fn start(self) {
        tauri::async_runtime::spawn(async move {
            let addr: SocketAddr = "127.0.0.1:41718".parse().unwrap();
            let listener = match TcpListener::bind(addr).await {
                Ok(l) => {
                    info!("Browser Extension IPC server listening on http://127.0.0.1:41718");
                    l
                }
                Err(e) => {
                    error!("Failed to bind Browser Extension IPC server on 41718: {}", e);
                    return;
                }
            };

            let engine = Arc::new(self.engine);

            loop {
                if let Ok((stream, _)) = listener.accept().await {
                    let engine_clone = engine.clone();
                    tauri::async_runtime::spawn(async move {
                        Self::handle_connection(stream, engine_clone).await;
                    });
                }
            }
        });
    }

    async fn handle_connection(mut stream: TcpStream, engine: Arc<DownloadEngine>) {
        let mut buffer = [0u8; 8192];
        let n = match stream.read(&mut buffer).await {
            Ok(n) if n > 0 => n,
            _ => return,
        };

        let request_str = String::from_utf8_lossy(&buffer[..n]);
        let mut lines = request_str.lines();
        let request_line = lines.next().unwrap_or("");
        let mut parts = request_line.split_whitespace();
        let method = parts.next().unwrap_or("");
        let path = parts.next().unwrap_or("");

        let cors_headers = "Access-Control-Allow-Origin: *\r\nAccess-Control-Allow-Methods: GET, POST, OPTIONS\r\nAccess-Control-Allow-Headers: Content-Type\r\n";

        if method == "OPTIONS" {
            let response = format!("HTTP/1.1 204 No Content\r\n{}Connection: close\r\n\r\n", cors_headers);
            let _ = stream.write_all(response.as_bytes()).await;
            return;
        }

        if method == "GET" && path == "/ping" {
            let body = r#"{"status":"ok","version":"1.1.1"}"#;
            let response = format!(
                "HTTP/1.1 200 OK\r\n{}Content-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                cors_headers,
                body.len(),
                body
            );
            let _ = stream.write_all(response.as_bytes()).await;
            return;
        }

        if method == "POST" && path == "/add" {
            // Find body after double newline
            let body_str = if let Some(idx) = request_str.find("\r\n\r\n") {
                &request_str[idx + 4..]
            } else if let Some(idx) = request_str.find("\n\n") {
                &request_str[idx + 2..]
            } else {
                ""
            };

            if let Ok(req) = serde_json::from_str::<AddRequest>(body_str.trim()) {
                if !req.url.is_empty() {
                    match engine
                        .create_download(
                            req.url.clone(),
                            None,
                            req.filename,
                            None,
                            None,
                            None,
                            None,
                            None,
                            req.headers,
                        )
                        .await
                    {
                        Ok(download) => {
                            let _ = engine.start_download(download.clone()).await;
                            let body = format!(r#"{{"status":"ok","id":"{}"}}"#, download.id);
                            let response = format!(
                                "HTTP/1.1 200 OK\r\n{}Content-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                                cors_headers,
                                body.len(),
                                body
                            );
                            let _ = stream.write_all(response.as_bytes()).await;
                            return;
                        }
                        Err(e) => {
                            let body = format!(r#"{{"status":"error","message":"{}"}}"#, e);
                            let response = format!(
                                "HTTP/1.1 400 Bad Request\r\n{}Content-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                                cors_headers,
                                body.len(),
                                body
                            );
                            let _ = stream.write_all(response.as_bytes()).await;
                            return;
                        }
                    }
                }
            }

            let body = r#"{"status":"error","message":"Invalid payload"}"#;
            let response = format!(
                "HTTP/1.1 400 Bad Request\r\n{}Content-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                cors_headers,
                body.len(),
                body
            );
            let _ = stream.write_all(response.as_bytes()).await;
            return;
        }

        let body = r#"{"status":"not_found"}"#;
        let response = format!(
            "HTTP/1.1 404 Not Found\r\n{}Content-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
            cors_headers,
            body.len(),
            body
        );
        let _ = stream.write_all(response.as_bytes()).await;
    }
}
