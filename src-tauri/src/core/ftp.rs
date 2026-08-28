use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;
use tracing::info;

pub struct FtpDownloader;

impl FtpDownloader {
    pub async fn download_ftp(
        url: &str,
        save_path: &PathBuf,
        is_cancelled: Arc<AtomicBool>,
    ) -> Result<(), String> {
        info!("Starting FTP download from: {}", url);

        let parsed = reqwest::Url::parse(url).map_err(|e| format!("Invalid FTP URL: {}", e))?;
        let host = parsed.host_str().ok_or_else(|| "Missing FTP host".to_string())?;
        let port = parsed.port().unwrap_or(21);
        let path = parsed.path();

        let mut stream = TcpStream::connect((host, port))
            .await
            .map_err(|e| format!("Failed to connect to FTP server {}:{}: {}", host, port, e))?;

        let mut buffer = [0u8; 1024];
        let _ = stream.read(&mut buffer).await;

        let user = parsed.username();
        let user = if user.is_empty() { "anonymous" } else { user };
        let pass = parsed.password().unwrap_or("anonymous@orbit.com");

        // Send USER
        stream
            .write_all(format!("USER {}\r\n", user).as_bytes())
            .await
            .map_err(|e| format!("FTP USER failed: {}", e))?;
        let _ = stream.read(&mut buffer).await;

        // Send PASS
        stream
            .write_all(format!("PASS {}\r\n", pass).as_bytes())
            .await
            .map_err(|e| format!("FTP PASS failed: {}", e))?;
        let _ = stream.read(&mut buffer).await;

        // Send TYPE I (Binary)
        stream
            .write_all(b"TYPE I\r\n")
            .await
            .map_err(|e| format!("FTP TYPE failed: {}", e))?;
        let _ = stream.read(&mut buffer).await;

        // Send PASV
        stream
            .write_all(b"PASV\r\n")
            .await
            .map_err(|e| format!("FTP PASV failed: {}", e))?;
        let n = stream.read(&mut buffer).await.map_err(|e| e.to_string())?;
        let pasv_response = String::from_utf8_lossy(&buffer[..n]);

        // Parse (h1,h2,h3,h4,p1,p2) from PASV response
        let data_port = if let Some(start) = pasv_response.find('(') {
            if let Some(end) = pasv_response.find(')') {
                let parts: Vec<&str> = pasv_response[start + 1..end].split(',').collect();
                if parts.len() == 6 {
                    let p1 = parts[4].trim().parse::<u16>().unwrap_or(0);
                    let p2 = parts[5].trim().parse::<u16>().unwrap_or(0);
                    p1 * 256 + p2
                } else {
                    21
                }
            } else {
                21
            }
        } else {
            21
        };

        let mut data_stream = TcpStream::connect((host, data_port))
            .await
            .map_err(|e| format!("Failed to connect to FTP data port {}: {}", data_port, e))?;

        // Send RETR
        stream
            .write_all(format!("RETR {}\r\n", path).as_bytes())
            .await
            .map_err(|e| format!("FTP RETR failed: {}", e))?;
        let _ = stream.read(&mut buffer).await;

        let mut file = tokio::fs::File::create(save_path)
            .await
            .map_err(|e| format!("Failed to create local file: {}", e))?;

        let mut chunk_buf = vec![0u8; 64 * 1024];
        loop {
            if is_cancelled.load(Ordering::Relaxed) {
                return Err("FTP Download cancelled".to_string());
            }

            let bytes_read = data_stream.read(&mut chunk_buf).await.map_err(|e| e.to_string())?;
            if bytes_read == 0 {
                break;
            }
            file.write_all(&chunk_buf[..bytes_read])
                .await
                .map_err(|e| format!("Failed to write FTP file data: {}", e))?;
        }

        file.flush().await.ok();
        info!("FTP download complete for: {}", url);
        Ok(())
    }
}
