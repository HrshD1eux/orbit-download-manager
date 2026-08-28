export type DownloadStatus =
  | 'queued'
  | 'starting'
  | 'connecting'
  | 'downloading'
  | 'paused'
  | 'verifying'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'waiting'
  | 'retrying'
  | 'scheduled';

export type DownloadPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface ChunkState {
  index: number;
  start_byte: number;
  end_byte: number;
  downloaded_bytes: number;
  speed: number;
  status: 'pending' | 'downloading' | 'completed' | 'failed';
}

export interface Download {
  id: string;
  url: string;
  headers: Record<string, string>;
  filename: string;
  save_location: string;
  category: string;
  status: DownloadStatus;
  priority: DownloadPriority;
  connections: number;
  speed: number;
  average_speed: number;
  peak_speed: number;
  downloaded_bytes: number;
  total_bytes: number;
  remaining_bytes: number;
  eta_seconds?: number | null;
  created_at: number;
  started_at?: number | null;
  completed_at?: number | null;
  retries: number;
  mirror_list: string[];
  etag?: string | null;
  last_modified?: string | null;
  range_supported: boolean;
  sha256?: string | null;
  md5?: string | null;
  sha1?: string | null;
  tags: string[];
  notes: string;
  error_message?: string | null;
  chunks: ChunkState[];
  speed_limit_bytes?: number | null;
  proxy_url?: string | null;
  scheduled_start?: number | null;
  post_webhook_command?: string | null;
  audio_url?: string | null;
}

export interface MagnetMetadata {
  info_hash: string;
  display_name: string;
  trackers: string[];
  exact_length?: number | null;
}

export interface UrlAnalysisResult {
  url: string;
  filename: string;
  file_size: number;
  range_supported: boolean;
  resume_supported: boolean;
  content_type: string;
  suggested_threads: number;
  response_time_ms: number;
  etag?: string | null;
  last_modified?: string | null;
  category: string;
  server?: string | null;
}

export interface DownloadProgressEvent {
  id: string;
  status: DownloadStatus;
  downloaded_bytes: number;
  total_bytes: number;
  speed: number;
  eta_seconds?: number | null;
  chunks: ChunkState[];
}

export interface SystemStats {
  cpu_usage: number;
  memory_used_mb: number;
  memory_total_mb: number;
  disk_free_gb: number;
  disk_total_gb: number;
  active_downloads: number;
  total_speed_bytes_sec: number;
}

export type ConditionField = 'extension' | 'domain' | 'url' | 'file_size' | 'category';
export type ConditionOperator = 'equals' | 'not_equals' | 'contains' | 'starts_with' | 'greater_than' | 'less_than' | 'in_list';
export type ActionType = 'set_save_path' | 'set_category' | 'set_priority' | 'set_connections' | 'auto_verify_sha256' | 'auto_start';

export interface RuleCondition {
  field: ConditionField;
  operator: ConditionOperator;
  value: string;
}

export interface RuleAction {
  action_type: ActionType;
  value: string;
}

export interface Rule {
  id: string;
  name: string;
  enabled: boolean;
  priority_order: number;
  conditions: RuleCondition[];
  actions: RuleAction[];
  created_at: number;
}

export interface UpdateCheckResult {
  current_version: string;
  latest_version: string;
  is_up_to_date: boolean;
  release_notes: string;
  download_url: string;
}
