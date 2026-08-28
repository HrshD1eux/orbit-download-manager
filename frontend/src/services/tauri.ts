import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type {
  Download,
  DownloadPriority,
  DownloadProgressEvent,
  Rule,
  SystemStats,
  UpdateCheckResult,
  UrlAnalysisResult,
} from '../types';

export const isTauri = () => '__TAURI_INTERNALS__' in window;

export async function analyzeUrl(url: string): Promise<UrlAnalysisResult> {
  if (!isTauri()) {
    return {
      url,
      filename: url.split('/').pop() || 'sample_file.zip',
      file_size: 450 * 1024 * 1024,
      range_supported: true,
      resume_supported: true,
      content_type: 'application/zip',
      suggested_threads: 16,
      response_time_ms: 42,
      etag: '"sample-etag-12345"',
      category: 'Archives',
      server: 'nginx/1.24.0',
    };
  }
  return await invoke<UrlAnalysisResult>('analyze_url', { url });
}

export async function addDownload(params: {
  url: string;
  saveDir?: string;
  customFilename?: string;
  connections?: number;
  priority?: DownloadPriority;
  category?: string;
  tags?: string[];
  notes?: string;
  autoStart?: boolean;
}): Promise<Download> {
  if (!isTauri()) {
    const mock: Download = {
      id: Math.random().toString(36).substring(7),
      url: params.url,
      headers: {},
      filename: params.customFilename || params.url.split('/').pop() || 'download.bin',
      save_location: `C:/Downloads/${params.customFilename || 'download.bin'}`,
      category: params.category || 'Software',
      status: 'downloading',
      priority: params.priority || 'normal',
      connections: params.connections || 8,
      speed: 12.4 * 1024 * 1024,
      average_speed: 10.1 * 1024 * 1024,
      peak_speed: 15.6 * 1024 * 1024,
      downloaded_bytes: 45 * 1024 * 1024,
      total_bytes: 450 * 1024 * 1024,
      remaining_bytes: 405 * 1024 * 1024,
      eta_seconds: 32,
      created_at: Date.now(),
      started_at: Date.now(),
      retries: 0,
      mirror_list: [],
      range_supported: true,
      tags: params.tags || [],
      notes: params.notes || '',
      chunks: Array.from({ length: 8 }).map((_, i) => ({
        index: i,
        start_byte: i * (450 * 1024 * 1024 / 8),
        end_byte: (i + 1) * (450 * 1024 * 1024 / 8) - 1,
        downloaded_bytes: Math.floor(Math.random() * (450 * 1024 * 1024 / 8)),
        speed: 1.5 * 1024 * 1024,
        status: 'downloading',
      })),
    };
    return mock;
  }

  return await invoke<Download>('add_download', {
    url: params.url,
    saveDir: params.saveDir,
    customFilename: params.customFilename,
    connections: params.connections,
    priority: params.priority,
    category: params.category,
    tags: params.tags,
    notes: params.notes,
    autoStart: params.autoStart,
  });
}

export async function getDownloads(): Promise<Download[]> {
  if (!isTauri()) return [];
  return await invoke<Download[]>('get_downloads');
}

export async function startDownload(id: string): Promise<void> {
  if (!isTauri()) return;
  await invoke('start_download', { id });
}

export async function pauseDownload(id: string): Promise<void> {
  if (!isTauri()) return;
  await invoke('pause_download', { id });
}

export async function resumeDownload(id: string): Promise<void> {
  if (!isTauri()) return;
  await invoke('resume_download', { id });
}

export async function cancelDownload(id: string): Promise<void> {
  if (!isTauri()) return;
  await invoke('cancel_download', { id });
}

export async function deleteDownload(id: string, deleteFile = false): Promise<void> {
  if (!isTauri()) return;
  await invoke('delete_download', { id, deleteFile });
}

export async function openFile(path: string): Promise<void> {
  if (!isTauri()) return;
  await invoke('open_file', { path });
}

export async function openFolder(path: string): Promise<void> {
  if (!isTauri()) return;
  await invoke('open_folder', { path });
}

export async function verifyChecksum(id: string, expectedHash: string, hashType: string): Promise<boolean> {
  if (!isTauri()) return true;
  return await invoke<boolean>('verify_checksum', { id, expectedHash, hashType });
}

export async function getSystemStats(): Promise<SystemStats> {
  if (!isTauri()) {
    return {
      cpu_usage: 12.5,
      memory_used_mb: 4120,
      memory_total_mb: 16384,
      disk_free_gb: 340,
      disk_total_gb: 1024,
      active_downloads: 1,
      total_speed_bytes_sec: 12.4 * 1024 * 1024,
    };
  }
  return await invoke<SystemStats>('get_system_stats');
}

export async function getDefaultDownloadDir(): Promise<string> {
  if (!isTauri()) return 'C:/Downloads';
  return await invoke<string>('get_default_download_dir');
}

// ----------------------------------------------------------------------------
// RULES IPC
// ----------------------------------------------------------------------------

export async function getRules(): Promise<Rule[]> {
  if (!isTauri()) return [];
  return await invoke<Rule[]>('get_rules');
}

export async function saveRule(rule: Rule): Promise<void> {
  if (!isTauri()) return;
  await invoke('save_rule', { rule });
}

export async function deleteRule(id: string): Promise<void> {
  if (!isTauri()) return;
  await invoke('delete_rule', { id });
}

export async function toggleRule(id: string): Promise<boolean> {
  if (!isTauri()) return true;
  return await invoke<boolean>('toggle_rule', { id });
}

export async function checkForUpdates(): Promise<UpdateCheckResult> {
  if (!isTauri()) {
    return {
      current_version: '1.1.1',
      latest_version: '1.1.1',
      is_up_to_date: true,
      release_notes: 'Running latest release.',
      download_url: 'https://github.com/HrshD1eux/Flowgrab_Downlaoder/releases',
    };
  }
  return await invoke<UpdateCheckResult>('check_for_updates');
}

export async function subscribeToProgress(
  callback: (event: DownloadProgressEvent) => void
): Promise<UnlistenFn | (() => void)> {
  if (!isTauri()) return () => {};
  return await listen<DownloadProgressEvent>('download-progress', (e) => {
    callback(e.payload);
  });
}

export async function subscribeToCompleted(
  callback: (download: Download) => void
): Promise<UnlistenFn | (() => void)> {
  if (!isTauri()) return () => {};
  return await listen<Download>('download-completed', (e) => {
    callback(e.payload);
  });
}

export async function addBatchDownloads(urls: string[], saveDir?: string, autoStart = true): Promise<Download[]> {
  if (!isTauri()) return [];
  return await invoke<Download[]>('add_batch_downloads', { urls, saveDir, autoStart });
}

export async function parseMagnetLink(uri: string): Promise<any> {
  if (!isTauri()) return null;
  return await invoke('parse_magnet_link', { uri });
}

export async function setDownloadSpeedLimit(id: string, limitBytes?: number): Promise<void> {
  if (!isTauri()) return;
  await invoke('set_download_speed_limit', { id, limitBytes });
}

export async function pauseAllDownloads(): Promise<void> {
  if (!isTauri()) return;
  await invoke('pause_all_downloads');
}

export async function resumeAllDownloads(): Promise<void> {
  if (!isTauri()) return;
  await invoke('resume_all_downloads');
}

export async function clearAllDownloads(deleteFiles = false): Promise<void> {
  if (!isTauri()) return;
  await invoke('clear_all_downloads', { deleteFiles });
}

export async function deleteMultipleDownloads(ids: string[], deleteFiles = false): Promise<void> {
  if (!isTauri()) return;
  await invoke('delete_multiple_downloads', { ids, deleteFiles });
}


