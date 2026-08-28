import React, { useState } from 'react';
import {
  X,
  FileText,
  Layers,
  BarChart3,
  ShieldCheck,
  Globe,
  FolderOpen,
  CheckCircle2,
  AlertCircle,
  Hash,
} from 'lucide-react';
import { useDownloadStore } from '../../store/useDownloadStore';
import { Button } from '../ui/Button';
import { Progress } from '../ui/Progress';
import { formatBytes, formatSpeed, formatEta, formatDate, cn } from '../../lib/utils';
import * as tauriService from '../../services/tauri';

export const DownloadInspector: React.FC = () => {
  const { isInspectorOpen, setInspectorOpen, selectedDownloadId, downloads } = useDownloadStore();
  const [activeTab, setActiveTab] = useState<'overview' | 'chunks' | 'stats' | 'integrity' | 'headers'>('overview');
  const [verifyHashInput, setVerifyHashInput] = useState('');
  const [verifyResult, setVerifyResult] = useState<boolean | null>(null);

  const download = downloads.find((d) => d.id === selectedDownloadId);

  if (!isInspectorOpen || !download) return null;

  const percent =
    download.total_bytes > 0
      ? (download.downloaded_bytes / download.total_bytes) * 100
      : download.status === 'completed'
      ? 100
      : 0;

  const handleVerifyChecksum = async (type: string) => {
    if (!verifyHashInput.trim()) return;
    try {
      const match = await tauriService.verifyChecksum(download.id, verifyHashInput.trim(), type);
      setVerifyResult(match);
    } catch {
      setVerifyResult(false);
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 w-[520px] bg-surface border-l border-border shadow-2xl z-40 flex flex-col select-none">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface-subtle/60 shrink-0">
        <div className="flex items-center gap-2 truncate">
          <FileText className="w-4 h-4 text-primary shrink-0" />
          <span className="font-semibold text-xs text-foreground truncate" title={download.filename}>
            {download.filename}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setInspectorOpen(false)}
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center border-b border-border px-3 bg-surface text-xs font-medium shrink-0">
        {[
          { id: 'overview', label: 'Overview', icon: Globe },
          { id: 'chunks', label: 'Chunk Map', icon: Layers },
          { id: 'stats', label: 'Statistics', icon: BarChart3 },
          { id: 'integrity', label: 'Integrity', icon: ShieldCheck },
          { id: 'headers', label: 'Headers', icon: Hash },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 border-b-2 transition-colors cursor-pointer',
                activeTab === tab.id
                  ? 'border-primary text-primary font-semibold'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="flex-1 p-4 overflow-y-auto text-xs space-y-4">
        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            {/* Quick Progress Banner */}
            <div className="p-3 bg-surface-subtle border border-border rounded-md space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground">Download Progress</span>
                <span className="font-mono font-bold text-foreground">{percent.toFixed(1)}%</span>
              </div>
              <Progress value={percent} className="h-2" />
              <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground">
                <span>{formatBytes(download.downloaded_bytes)} of {formatBytes(download.total_bytes)}</span>
                <span>{download.status === 'downloading' ? formatSpeed(download.speed) : download.status}</span>
              </div>
            </div>

            {/* Metadata Grid */}
            <div className="space-y-2.5">
              <div>
                <label className="text-[11px] text-muted-foreground font-medium">Download ID</label>
                <div className="font-mono text-xs text-foreground select-all bg-surface-subtle p-1.5 rounded border border-border mt-0.5">
                  {download.id}
                </div>
              </div>

              <div>
                <label className="text-[11px] text-muted-foreground font-medium">Source URL</label>
                <div className="font-mono text-xs text-foreground break-all select-all bg-surface-subtle p-1.5 rounded border border-border mt-0.5">
                  {download.url}
                </div>
              </div>

              <div>
                <label className="text-[11px] text-muted-foreground font-medium">Save Destination</label>
                <div className="font-mono text-xs text-foreground break-all select-all bg-surface-subtle p-1.5 rounded border border-border mt-0.5 flex items-center justify-between">
                  <span className="truncate">{download.save_location}</span>
                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => tauriService.openFolder(download.save_location)}
                      title="Show in folder"
                    >
                      <FolderOpen className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="text-[11px] text-muted-foreground font-medium">Category</label>
                  <div className="font-medium text-foreground mt-0.5">{download.category}</div>
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground font-medium">Priority</label>
                  <div className="font-medium text-foreground mt-0.5 uppercase tracking-wide">
                    {download.priority}
                  </div>
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground font-medium">Added Time</label>
                  <div className="font-mono text-muted-foreground mt-0.5">
                    {formatDate(download.created_at)}
                  </div>
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground font-medium">Active Connections</label>
                  <div className="font-mono font-semibold text-foreground mt-0.5">
                    {download.connections} Threads
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: CHUNK MAP VISUALIZER */}
        {activeTab === 'chunks' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-foreground">
                Multi-Threaded Segment Map ({download.chunks.length} Chunks)
              </span>
              <span className="text-[11px] font-mono text-muted-foreground">
                Range Streaming Direct-to-Disk
              </span>
            </div>

            {/* Visual Segments Strip */}
            <div className="h-7 w-full bg-surface-subtle border border-border rounded flex overflow-hidden p-0.5 gap-0.5">
              {download.chunks.map((chunk) => {
                const totalChunk = chunk.end_byte - chunk.start_byte + 1;
                const chunkPct = totalChunk > 0 ? (chunk.downloaded_bytes / totalChunk) * 100 : 0;
                return (
                  <div
                    key={chunk.index}
                    className="h-full flex-1 bg-surface border border-border/60 rounded-xs relative overflow-hidden"
                    title={`Chunk #${chunk.index + 1}: ${chunkPct.toFixed(1)}% (${formatBytes(
                      chunk.downloaded_bytes
                    )})`}
                  >
                    <div
                      className={cn(
                        'h-full transition-all duration-150',
                        chunk.status === 'completed'
                          ? 'bg-emerald-500'
                          : chunk.status === 'downloading'
                          ? 'bg-primary animate-pulse'
                          : 'bg-muted'
                      )}
                      style={{ width: `${chunkPct}%` }}
                    />
                  </div>
                );
              })}
            </div>

            {/* Detailed Chunk List */}
            <div className="space-y-1.5 max-h-[340px] overflow-y-auto">
              {download.chunks.map((chunk) => {
                const totalChunk = chunk.end_byte - chunk.start_byte + 1;
                const chunkPct = totalChunk > 0 ? (chunk.downloaded_bytes / totalChunk) * 100 : 0;

                return (
                  <div
                    key={chunk.index}
                    className="p-2 bg-surface-subtle border border-border/80 rounded flex items-center justify-between font-mono text-[11px]"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-foreground">#{chunk.index + 1}</span>
                      <span className="text-muted-foreground">
                        {chunk.start_byte} - {chunk.end_byte}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span>{formatBytes(chunk.downloaded_bytes)}</span>
                      <span className="font-semibold text-primary w-12 text-right">
                        {chunkPct.toFixed(1)}%
                      </span>
                      <span
                        className={cn(
                          'px-1.5 py-0.2 rounded text-[10px] uppercase font-semibold',
                          chunk.status === 'completed'
                            ? 'bg-emerald-100 text-emerald-800'
                            : chunk.status === 'downloading'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-muted text-muted-foreground'
                        )}
                      >
                        {chunk.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 3: STATISTICS */}
        {activeTab === 'stats' && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-surface-subtle border border-border rounded-md">
                <span className="text-[11px] text-muted-foreground">Current Speed</span>
                <div className="text-base font-bold font-mono text-primary mt-1">
                  {formatSpeed(download.speed)}
                </div>
              </div>

              <div className="p-3 bg-surface-subtle border border-border rounded-md">
                <span className="text-[11px] text-muted-foreground">Peak Speed</span>
                <div className="text-base font-bold font-mono text-foreground mt-1">
                  {formatSpeed(download.peak_speed)}
                </div>
              </div>

              <div className="p-3 bg-surface-subtle border border-border rounded-md">
                <span className="text-[11px] text-muted-foreground">Average Speed</span>
                <div className="text-base font-bold font-mono text-foreground mt-1">
                  {formatSpeed(download.average_speed)}
                </div>
              </div>

              <div className="p-3 bg-surface-subtle border border-border rounded-md">
                <span className="text-[11px] text-muted-foreground">Time Remaining (ETA)</span>
                <div className="text-base font-bold font-mono text-foreground mt-1">
                  {formatEta(download.eta_seconds)}
                </div>
              </div>
            </div>

            <div className="p-3 bg-surface-subtle border border-border rounded-md space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">Range Requests Supported</span>
                <strong className={download.range_supported ? 'text-emerald-700' : 'text-amber-700'}>
                  {download.range_supported ? 'Yes' : 'No'}
                </strong>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">Total Retries</span>
                <span className="font-mono text-foreground">{download.retries}</span>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: INTEGRITY & CHECKSUMS */}
        {activeTab === 'integrity' && (
          <div className="space-y-4">
            <div className="p-3 bg-surface-subtle border border-border rounded-md space-y-3">
              <span className="font-semibold text-foreground text-xs block">
                Cryptographic Checksums
              </span>

              <div>
                <label className="text-[10px] text-muted-foreground font-mono uppercase">SHA-256</label>
                <div className="font-mono text-[11px] text-foreground bg-surface p-1.5 rounded border border-border select-all break-all">
                  {download.sha256 || 'Calculated automatically on completion'}
                </div>
              </div>

              <div>
                <label className="text-[10px] text-muted-foreground font-mono uppercase">MD5</label>
                <div className="font-mono text-[11px] text-foreground bg-surface p-1.5 rounded border border-border select-all break-all">
                  {download.md5 || 'Calculated automatically on completion'}
                </div>
              </div>

              <div>
                <label className="text-[10px] text-muted-foreground font-mono uppercase">SHA-1</label>
                <div className="font-mono text-[11px] text-foreground bg-surface p-1.5 rounded border border-border select-all break-all">
                  {download.sha1 || 'Calculated automatically on completion'}
                </div>
              </div>
            </div>

            {/* Checksum Verifier Input */}
            <div className="p-3 bg-surface-subtle border border-border rounded-md space-y-2">
              <label className="block font-semibold text-foreground text-xs">
                Verify Checksum Match
              </label>
              <input
                type="text"
                placeholder="Paste expected SHA-256 or MD5 hash..."
                value={verifyHashInput}
                onChange={(e) => {
                  setVerifyHashInput(e.target.value);
                  setVerifyResult(null);
                }}
                className="w-full h-8 px-2.5 text-xs font-mono rounded border border-border bg-surface text-foreground"
              />
              <div className="flex items-center gap-2 pt-1">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleVerifyChecksum('sha256')}
                  disabled={!verifyHashInput.trim()}
                  className="text-xs"
                >
                  Verify SHA-256
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleVerifyChecksum('md5')}
                  disabled={!verifyHashInput.trim()}
                  className="text-xs"
                >
                  Verify MD5
                </Button>
              </div>

              {verifyResult !== null && (
                <div
                  className={cn(
                    'p-2 rounded border flex items-center gap-2 text-xs font-medium mt-2',
                    verifyResult
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : 'bg-rose-50 text-rose-800 border-rose-200'
                  )}
                >
                  {verifyResult ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Checksum MATCHES! File integrity 100% verified.</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>Checksum MISMATCH! File may be corrupt or altered.</span>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 5: HEADERS */}
        {activeTab === 'headers' && (
          <div className="space-y-3">
            <div className="p-3 bg-surface-subtle border border-border rounded-md space-y-2">
              <span className="font-semibold text-foreground text-xs block">HTTP Response Headers</span>
              <div className="space-y-1 text-[11px] font-mono text-muted-foreground">
                <div className="flex justify-between py-1 border-b border-border/60">
                  <span className="text-foreground">ETag:</span>
                  <span>{download.etag || 'None'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/60">
                  <span className="text-foreground">Last-Modified:</span>
                  <span>{download.last_modified || 'None'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/60">
                  <span className="text-foreground">Accept-Ranges:</span>
                  <span>{download.range_supported ? 'bytes' : 'none'}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
