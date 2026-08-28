use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MagnetMetadata {
    pub info_hash: String,
    pub display_name: String,
    pub trackers: Vec<String>,
    pub exact_length: Option<u64>,
}

pub struct TorrentEngine;

impl TorrentEngine {
    pub fn parse_magnet(uri: &str) -> Result<MagnetMetadata, String> {
        if !uri.starts_with("magnet:?") {
            return Err("Not a valid magnet URI".to_string());
        }

        let query = &uri[8..];
        let mut info_hash = String::new();
        let mut display_name = String::new();
        let mut trackers = Vec::new();
        let mut exact_length = None;

        for pair in query.split('&') {
            if let Some((k, v)) = pair.split_once('=') {
                let val = urlencoding::decode(v).unwrap_or_default().to_string();
                match k {
                    "xt" => {
                        if let Some(hash) = val.strip_prefix("urn:btih:") {
                            info_hash = hash.to_lowercase();
                        }
                    }
                    "dn" => {
                        display_name = val;
                    }
                    "tr" => {
                        trackers.push(val);
                    }
                    "xl" => {
                        exact_length = val.parse::<u64>().ok();
                    }
                    _ => {}
                }
            }
        }

        if info_hash.is_empty() {
            return Err("Missing xt (info hash) in magnet link".to_string());
        }

        if display_name.is_empty() {
            display_name = format!("torrent_{}", &info_hash[..8.min(info_hash.len())]);
        }

        Ok(MagnetMetadata {
            info_hash,
            display_name,
            trackers,
            exact_length,
        })
    }
}
