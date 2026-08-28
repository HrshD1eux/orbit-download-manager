use crate::core::state::{Download, DownloadPriority, DownloadStatus};
use crate::rules::types::Rule;
use sqlx::{sqlite::SqlitePoolOptions, Pool, Row, Sqlite};
use std::collections::HashMap;
use std::path::Path;

pub type DbPool = Pool<Sqlite>;

pub async fn init_db<P: AsRef<Path>>(db_path: P) -> Result<DbPool, sqlx::Error> {
    if let Some(parent) = db_path.as_ref().parent() {
        std::fs::create_dir_all(parent).ok();
    }

    let conn_str = format!("sqlite://{}?mode=rwc", db_path.as_ref().to_string_lossy());
    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect(&conn_str)
        .await?;

    // Performance optimizations for SQLite
    sqlx::query("PRAGMA journal_mode = WAL;").execute(&pool).await?;
    sqlx::query("PRAGMA synchronous = NORMAL;").execute(&pool).await?;
    sqlx::query("PRAGMA busy_timeout = 5000;").execute(&pool).await?;

    // Create tables
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS downloads (
            id TEXT PRIMARY KEY,
            url TEXT NOT NULL,
            headers TEXT NOT NULL,
            filename TEXT NOT NULL,
            save_location TEXT NOT NULL,
            category TEXT NOT NULL,
            status TEXT NOT NULL,
            priority TEXT NOT NULL,
            connections INTEGER NOT NULL,
            speed INTEGER NOT NULL,
            average_speed INTEGER NOT NULL,
            peak_speed INTEGER NOT NULL,
            downloaded_bytes INTEGER NOT NULL,
            total_bytes INTEGER NOT NULL,
            remaining_bytes INTEGER NOT NULL,
            eta_seconds INTEGER,
            created_at INTEGER NOT NULL,
            started_at INTEGER,
            completed_at INTEGER,
            retries INTEGER NOT NULL,
            mirror_list TEXT NOT NULL,
            etag TEXT,
            last_modified TEXT,
            range_supported INTEGER NOT NULL,
            sha256 TEXT,
            md5 TEXT,
            sha1 TEXT,
            tags TEXT NOT NULL,
            notes TEXT NOT NULL,
            error_message TEXT,
            chunks TEXT NOT NULL,
            speed_limit_bytes INTEGER,
            proxy_url TEXT,
            scheduled_start INTEGER,
            post_webhook_command TEXT,
            audio_url TEXT
        );
        "#,
    )
    .execute(&pool)
    .await?;

    // Run schema migrations for new columns if table already existed
    let _ = sqlx::query("ALTER TABLE downloads ADD COLUMN speed_limit_bytes INTEGER;").execute(&pool).await;
    let _ = sqlx::query("ALTER TABLE downloads ADD COLUMN proxy_url TEXT;").execute(&pool).await;
    let _ = sqlx::query("ALTER TABLE downloads ADD COLUMN scheduled_start INTEGER;").execute(&pool).await;
    let _ = sqlx::query("ALTER TABLE downloads ADD COLUMN post_webhook_command TEXT;").execute(&pool).await;
    let _ = sqlx::query("ALTER TABLE downloads ADD COLUMN audio_url TEXT;").execute(&pool).await;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS categories (
            name TEXT PRIMARY KEY,
            extensions TEXT NOT NULL,
            color TEXT NOT NULL,
            icon TEXT NOT NULL
        );
        "#,
    )
    .execute(&pool)
    .await?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS rules (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            enabled INTEGER NOT NULL,
            priority_order INTEGER NOT NULL,
            conditions TEXT NOT NULL,
            actions TEXT NOT NULL,
            created_at INTEGER NOT NULL
        );
        "#,
    )
    .execute(&pool)
    .await?;

    // Seed default categories if empty
    let cat_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM categories;")
        .fetch_one(&pool)
        .await
        .unwrap_or(0);

    if cat_count == 0 {
        let default_cats = vec![
            ("Software", "exe,msi,dmg,pkg,deb,rpm,apk", "#1677ff", "Cpu"),
            ("Archives", "zip,rar,7z,tar,gz,bz2,xz,iso", "#fa8c16", "Archive"),
            ("Documents", "pdf,doc,docx,xls,xlsx,ppt,pptx,txt,epub", "#52c41a", "FileText"),
            ("Videos", "mp4,mkv,avi,mov,wmv,flv,webm,ts,m4s", "#722ed1", "Video"),
            ("Music", "mp3,flac,wav,aac,ogg,m4a,opus", "#eb2f96", "Music"),
            ("Images", "png,jpg,jpeg,gif,svg,webp,psd,ai", "#13c2c2", "Image"),
            ("ISOs", "iso,img,bin,vmdk,qcow2", "#fa541c", "Disc"),
            ("Programming", "rs,ts,js,py,cpp,c,go,java,html,css,json,yaml", "#2f54eb", "Code"),
            ("Games", "pak,obb,rom", "#faad14", "Gamepad2"),
            ("Drivers", "inf,sys,dll", "#8c8c8c", "HardDrive"),
            ("Unknown", "", "#bfbfbf", "File"),
        ];

        for (name, exts, color, icon) in default_cats {
            sqlx::query("INSERT INTO categories (name, extensions, color, icon) VALUES (?, ?, ?, ?);")
                .bind(name)
                .bind(exts)
                .bind(color)
                .bind(icon)
                .execute(&pool)
                .await?;
        }
    }

    Ok(pool)
}

pub async fn save_or_update_download(pool: &DbPool, d: &Download) -> Result<(), sqlx::Error> {
    let headers_json = serde_json::to_string(&d.headers).unwrap_or_default();
    let mirrors_json = serde_json::to_string(&d.mirror_list).unwrap_or_default();
    let tags_json = serde_json::to_string(&d.tags).unwrap_or_default();
    let chunks_json = serde_json::to_string(&d.chunks).unwrap_or_default();
    let status_str = serde_json::to_string(&d.status).unwrap_or_default().trim_matches('"').to_string();
    let priority_str = serde_json::to_string(&d.priority).unwrap_or_default().trim_matches('"').to_string();

    sqlx::query(
        r#"
        INSERT INTO downloads (
            id, url, headers, filename, save_location, category, status, priority,
            connections, speed, average_speed, peak_speed, downloaded_bytes, total_bytes,
            remaining_bytes, eta_seconds, created_at, started_at, completed_at, retries,
            mirror_list, etag, last_modified, range_supported, sha256, md5, sha1,
            tags, notes, error_message, chunks, speed_limit_bytes, proxy_url, scheduled_start,
            post_webhook_command, audio_url
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            status = excluded.status,
            priority = excluded.priority,
            speed = excluded.speed,
            average_speed = excluded.average_speed,
            peak_speed = excluded.peak_speed,
            downloaded_bytes = excluded.downloaded_bytes,
            total_bytes = excluded.total_bytes,
            remaining_bytes = excluded.remaining_bytes,
            eta_seconds = excluded.eta_seconds,
            started_at = excluded.started_at,
            completed_at = excluded.completed_at,
            retries = excluded.retries,
            etag = excluded.etag,
            last_modified = excluded.last_modified,
            sha256 = excluded.sha256,
            md5 = excluded.md5,
            sha1 = excluded.sha1,
            error_message = excluded.error_message,
            chunks = excluded.chunks,
            speed_limit_bytes = excluded.speed_limit_bytes,
            proxy_url = excluded.proxy_url,
            scheduled_start = excluded.scheduled_start,
            post_webhook_command = excluded.post_webhook_command,
            audio_url = excluded.audio_url;
        "#,
    )
    .bind(&d.id)
    .bind(&d.url)
    .bind(&headers_json)
    .bind(&d.filename)
    .bind(&d.save_location)
    .bind(&d.category)
    .bind(&status_str)
    .bind(&priority_str)
    .bind(d.connections as i64)
    .bind(d.speed as i64)
    .bind(d.average_speed as i64)
    .bind(d.peak_speed as i64)
    .bind(d.downloaded_bytes as i64)
    .bind(d.total_bytes as i64)
    .bind(d.remaining_bytes as i64)
    .bind(d.eta_seconds.map(|e| e as i64))
    .bind(d.created_at)
    .bind(d.started_at)
    .bind(d.completed_at)
    .bind(d.retries as i64)
    .bind(&mirrors_json)
    .bind(&d.etag)
    .bind(&d.last_modified)
    .bind(if d.range_supported { 1i64 } else { 0i64 })
    .bind(&d.sha256)
    .bind(&d.md5)
    .bind(&d.sha1)
    .bind(&tags_json)
    .bind(&d.notes)
    .bind(&d.error_message)
    .bind(&chunks_json)
    .bind(d.speed_limit_bytes.map(|s| s as i64))
    .bind(&d.proxy_url)
    .bind(d.scheduled_start)
    .bind(&d.post_webhook_command)
    .bind(&d.audio_url)
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn get_all_downloads(pool: &DbPool) -> Result<Vec<Download>, sqlx::Error> {
    let rows = sqlx::query("SELECT * FROM downloads ORDER BY created_at DESC;")
        .fetch_all(pool)
        .await?;

    let mut list = Vec::with_capacity(rows.len());
    for row in rows {
        let headers_str: String = row.get("headers");
        let mirrors_str: String = row.get("mirror_list");
        let tags_str: String = row.get("tags");
        let chunks_str: String = row.get("chunks");
        let status_str: String = row.get("status");
        let priority_str: String = row.get("priority");
        let range_int: i64 = row.get("range_supported");

        let headers: HashMap<String, String> = serde_json::from_str(&headers_str).unwrap_or_default();
        let mirror_list: Vec<String> = serde_json::from_str(&mirrors_str).unwrap_or_default();
        let tags: Vec<String> = serde_json::from_str(&tags_str).unwrap_or_default();
        let chunks = serde_json::from_str(&chunks_str).unwrap_or_default();
        let status = serde_json::from_str(&format!("\"{}\"", status_str)).unwrap_or(DownloadStatus::Queued);
        let priority = serde_json::from_str(&format!("\"{}\"", priority_str)).unwrap_or(DownloadPriority::Normal);

        list.push(Download {
            id: row.get("id"),
            url: row.get("url"),
            headers,
            filename: row.get("filename"),
            save_location: row.get("save_location"),
            category: row.get("category"),
            status,
            priority,
            connections: row.get::<i64, _>("connections") as u32,
            speed: row.get::<i64, _>("speed") as u64,
            average_speed: row.get::<i64, _>("average_speed") as u64,
            peak_speed: row.get::<i64, _>("peak_speed") as u64,
            downloaded_bytes: row.get::<i64, _>("downloaded_bytes") as u64,
            total_bytes: row.get::<i64, _>("total_bytes") as u64,
            remaining_bytes: row.get::<i64, _>("remaining_bytes") as u64,
            eta_seconds: row.get::<Option<i64>, _>("eta_seconds").map(|e| e as u64),
            created_at: row.get("created_at"),
            started_at: row.get("started_at"),
            completed_at: row.get("completed_at"),
            retries: row.get::<i64, _>("retries") as u32,
            mirror_list,
            etag: row.get("etag"),
            last_modified: row.get("last_modified"),
            range_supported: range_int != 0,
            sha256: row.get("sha256"),
            md5: row.get("md5"),
            sha1: row.get("sha1"),
            tags,
            notes: row.get("notes"),
            error_message: row.get("error_message"),
            chunks,
            speed_limit_bytes: row.get::<Option<i64>, _>("speed_limit_bytes").map(|s| s as u64),
            proxy_url: row.get("proxy_url"),
            scheduled_start: row.get("scheduled_start"),
            post_webhook_command: row.get("post_webhook_command"),
            audio_url: row.get("audio_url"),
        });
    }

    Ok(list)
}

pub async fn delete_download(pool: &DbPool, id: &str) -> Result<(), sqlx::Error> {
    sqlx::query("DELETE FROM downloads WHERE id = ?;")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

// ----------------------------------------------------------------------------
// RULES DATABASE OPERATIONS
// ----------------------------------------------------------------------------

pub async fn save_or_update_rule(pool: &DbPool, rule: &Rule) -> Result<(), sqlx::Error> {
    let conditions_json = serde_json::to_string(&rule.conditions).unwrap_or_default();
    let actions_json = serde_json::to_string(&rule.actions).unwrap_or_default();

    sqlx::query(
        r#"
        INSERT INTO rules (id, name, enabled, priority_order, conditions, actions, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            enabled = excluded.enabled,
            priority_order = excluded.priority_order,
            conditions = excluded.conditions,
            actions = excluded.actions;
        "#,
    )
    .bind(&rule.id)
    .bind(&rule.name)
    .bind(if rule.enabled { 1i64 } else { 0i64 })
    .bind(rule.priority_order as i64)
    .bind(&conditions_json)
    .bind(&actions_json)
    .bind(rule.created_at)
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn get_all_rules(pool: &DbPool) -> Result<Vec<Rule>, sqlx::Error> {
    let rows = sqlx::query("SELECT * FROM rules ORDER BY priority_order ASC;")
        .fetch_all(pool)
        .await?;

    let mut rules = Vec::with_capacity(rows.len());
    for row in rows {
        let conditions_str: String = row.get("conditions");
        let actions_str: String = row.get("actions");
        let enabled_int: i64 = row.get("enabled");

        let conditions = serde_json::from_str(&conditions_str).unwrap_or_default();
        let actions = serde_json::from_str(&actions_str).unwrap_or_default();

        rules.push(Rule {
            id: row.get("id"),
            name: row.get("name"),
            enabled: enabled_int != 0,
            priority_order: row.get::<i64, _>("priority_order") as i32,
            conditions,
            actions,
            created_at: row.get("created_at"),
        });
    }

    Ok(rules)
}

pub async fn toggle_rule(pool: &DbPool, id: &str) -> Result<bool, sqlx::Error> {
    let current: Option<i64> = sqlx::query_scalar("SELECT enabled FROM rules WHERE id = ?;")
        .bind(id)
        .fetch_optional(pool)
        .await?;
    if let Some(enabled) = current {
        let new_val = if enabled != 0 { 0i64 } else { 1i64 };
        sqlx::query("UPDATE rules SET enabled = ? WHERE id = ?;")
            .bind(new_val)
            .bind(id)
            .execute(pool)
            .await?;
        Ok(new_val != 0)
    } else {
        Err(sqlx::Error::RowNotFound)
    }
}

pub async fn delete_rule(pool: &DbPool, id: &str) -> Result<(), sqlx::Error> {
    sqlx::query("DELETE FROM rules WHERE id = ?;")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}
