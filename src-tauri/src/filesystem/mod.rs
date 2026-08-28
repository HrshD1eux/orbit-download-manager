use std::fs::File;
use std::io::{Seek, SeekFrom};
use std::path::{Path, PathBuf};

pub fn get_part_file_path<P: AsRef<Path>>(target_path: P) -> PathBuf {
    let mut path = target_path.as_ref().to_path_buf();
    let file_name = path.file_name().unwrap_or_default().to_string_lossy().to_string();
    path.set_file_name(format!("{}.orbit.part", file_name));
    path
}

pub fn preallocate_file<P: AsRef<Path>>(path: P, size: u64) -> Result<File, std::io::Error> {
    if let Some(parent) = path.as_ref().parent() {
        std::fs::create_dir_all(parent)?;
    }

    let mut file = std::fs::OpenOptions::new()
        .read(true)
        .write(true)
        .create(true)
        .truncate(false)
        .open(path)?;

    if size > 0 {
        file.set_len(size)?;
        file.seek(SeekFrom::Start(0))?;
    }

    Ok(file)
}

pub fn finalize_download<P: AsRef<Path>>(part_path: P, final_path: P) -> Result<(), std::io::Error> {
    if final_path.as_ref().exists() {
        std::fs::remove_file(&final_path)?;
    }
    std::fs::rename(part_path, final_path)?;
    Ok(())
}
