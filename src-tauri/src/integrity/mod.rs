use md5::Md5;
use sha1::Sha1;
use sha2::{Digest, Sha256};
use std::fs::File;
use std::io::{BufReader, Read};
use std::path::Path;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ChecksumResult {
    pub sha256: String,
    pub md5: String,
    pub sha1: String,
    pub file_size: u64,
}

pub fn calculate_checksums<P: AsRef<Path>>(file_path: P) -> Result<ChecksumResult, std::io::Error> {
    let file = File::open(file_path)?;
    let mut reader = BufReader::with_capacity(64 * 1024, file);

    let mut sha256_hasher = Sha256::new();
    let mut md5_hasher = Md5::new();
    let mut sha1_hasher = Sha1::new();

    let mut buffer = [0u8; 64 * 1024];
    let mut total_bytes = 0u64;

    loop {
        let count = reader.read(&mut buffer)?;
        if count == 0 {
            break;
        }
        total_bytes += count as u64;
        sha256_hasher.update(&buffer[..count]);
        md5_hasher.update(&buffer[..count]);
        sha1_hasher.update(&buffer[..count]);
    }

    Ok(ChecksumResult {
        sha256: hex::encode(sha256_hasher.finalize()),
        md5: hex::encode(md5_hasher.finalize()),
        sha1: hex::encode(sha1_hasher.finalize()),
        file_size: total_bytes,
    })
}
