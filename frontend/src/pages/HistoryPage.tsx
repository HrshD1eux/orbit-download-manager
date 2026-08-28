import React, { useState } from 'react';
import {
  History,
  FolderOpen,
  ExternalLink,
  Trash2,
  Search,
  CheckCircle2,
  HardDrive,
  Copy,
  RotateCcw,
  ShieldCheck,
  Check,
} from 'lucide-react';
import { useDownloadStore } from '../store/useDownloadStore';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { formatBytes, formatDate, formatSpeed } from '../lib/utils';
import * as tauriService from '../services/tauri';

export const HistoryPage: React.FC = () => {
  const { downloads, deleteDownload, loadDownloads } = useDownloadStore();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const completedDownloads = downloads.filter((d) => d.status === 'completed');

  const totalBytes = completedDownloads.reduce((acc, d) => acc + (d.total_bytes || d.downloaded_bytes || 0), 0);
  const avgSpeed = completedDownloads.length > 0
    ? Math.round(completedDownloads.reduce((acc, d) => acc + (d.average_speed || d.peak_speed || 0), 0) / completedDownloads.length)
    : 0;

  const filteredHistory = completedDownloads.filter((item) => {
    const matchesSearch = item.filename.toLowerCase().includes(search.toLowerCase()) || item.url.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || item.category.toLowerCase() === selectedCategory.toLowerCase();
    return matchesSearch && matchesCategory;
  });

  const handleCopyLink = (url: string, id: string) => {
    navigator.clipboard?.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleRedownload = async (item: typeof downloads[0]) => {
    await tauriService.addDownload({
      url: item.url,
      customFilename: item.filename,
      category: item.category,
      connections: item.connections,
      priority: item.priority,
      autoStart: true,
    });
    await loadDownloads();
  };

  const handleClearAllHistory = async () => {
    if (confirm('Clear all completed download history? (Your files on disk will NOT be deleted)')) {
      for (const item of completedDownloads) {
        await deleteDownload(item.id, false);
      }
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-background select-none">
      {/* Header */}
      <div className="h-12 border-b border-border bg-surface px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-primary" />
          <h1 className="text-sm font-semibold text-foreground">Download History</h1>
          <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-surface-subtle border border-border text-muted-foreground">
            {completedDownloads.length} completed
          </span>
        </div>

        <div className="flex items-center gap-2">
          {completedDownloads.length > 0 && (
            <Button
              variant="outline"
              size="xs"
              onClick={handleClearAllHistory}
              className="text-xs text-rose-600 hover:bg-rose-50 hover:border-rose-200"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1" />
              Clear History
            </Button>
          )}
        </div>
      </div>

      {/* Summary Metrics Bar */}
      <div className="grid grid-cols-3 gap-3 p-4 border-b border-border bg-surface-subtle/50 shrink-0">
        <div className="p-3 bg-surface border border-border rounded flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-blue-50 border border-blue-100 flex items-center justify-center text-primary">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[11px] font-medium text-muted-foreground">Total Completed</div>
            <div className="text-sm font-bold text-foreground font-mono">{completedDownloads.length} files</div>
          </div>
        </div>

        <div className="p-3 bg-surface border border-border rounded flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
            <HardDrive className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[11px] font-medium text-muted-foreground">Total Transferred</div>
            <div className="text-sm font-bold text-foreground font-mono">{formatBytes(totalBytes)}</div>
          </div>
        </div>

        <div className="p-3 bg-surface border border-border rounded flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[11px] font-medium text-muted-foreground">Historical Avg Speed</div>
            <div className="text-sm font-bold text-foreground font-mono">{formatSpeed(avgSpeed)}</div>
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="p-3 border-b border-border bg-surface flex items-center gap-3 shrink-0">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search history by name or URL..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-7 text-xs bg-surface-subtle/50"
          />
        </div>

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span>Category:</span>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="h-7 rounded border border-border bg-surface px-2 text-xs text-foreground"
          >
            <option value="all">All Categories</option>
            <option value="software">Software</option>
            <option value="archives">Archives</option>
            <option value="videos">Videos</option>
            <option value="music">Music</option>
            <option value="documents">Documents</option>
            <option value="images">Images</option>
            <option value="isos">ISOs</option>
            <option value="programming">Programming</option>
          </select>
        </div>
      </div>

      {/* History Table */}
      <div className="flex-1 overflow-y-auto">
        {filteredHistory.length === 0 ? (
          <div className="p-12 text-center text-xs text-muted-foreground">
            No completed downloads found in history.
          </div>
        ) : (
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-surface-subtle border-b border-border sticky top-0 z-10 text-[11px] font-semibold text-muted-foreground">
              <tr>
                <th className="py-2 px-3">File Name</th>
                <th className="py-2 px-3 w-28">Category</th>
                <th className="py-2 px-3 w-24">Size</th>
                <th className="py-2 px-3 w-36">Completed On</th>
                <th className="py-2 px-3 w-40 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filteredHistory.map((item) => (
                <tr key={item.id} className="hover:bg-surface-subtle/70 transition-colors group">
                  {/* File Name */}
                  <td className="py-2.5 px-3 max-w-[320px] truncate">
                    <div className="font-semibold text-foreground truncate" title={item.filename}>
                      {item.filename}
                    </div>
                    <div className="text-[10px] text-muted-foreground font-mono truncate" title={item.url}>
                      {item.url}
                    </div>
                  </td>

                  {/* Category */}
                  <td className="py-2.5 px-3 whitespace-nowrap">
                    <Badge variant="outline" className="text-[10px] font-medium">
                      {item.category}
                    </Badge>
                  </td>

                  {/* Size */}
                  <td className="py-2.5 px-3 whitespace-nowrap font-mono font-medium text-foreground">
                    {formatBytes(item.total_bytes || item.downloaded_bytes)}
                  </td>

                  {/* Completed On */}
                  <td className="py-2.5 px-3 whitespace-nowrap font-mono text-[11px] text-muted-foreground">
                    {item.completed_at ? formatDate(item.completed_at) : formatDate(item.created_at)}
                  </td>

                  {/* Actions */}
                  <td className="py-2.5 px-3 whitespace-nowrap text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => tauriService.openFile(item.save_location)}
                        title="Open File"
                        className="h-6 w-6 text-muted-foreground hover:text-foreground"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => tauriService.openFolder(item.save_location)}
                        title="Open in Explorer"
                        className="h-6 w-6 text-muted-foreground hover:text-foreground"
                      >
                        <FolderOpen className="w-3 h-3" />
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleCopyLink(item.url, item.id)}
                        title={copiedId === item.id ? 'Copied!' : 'Copy Source Link'}
                        className="h-6 w-6 text-muted-foreground hover:text-foreground"
                      >
                        {copiedId === item.id ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRedownload(item)}
                        title="Re-download"
                        className="h-6 w-6 text-primary hover:bg-blue-50"
                      >
                        <RotateCcw className="w-3 h-3" />
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteDownload(item.id, false)}
                        title="Delete from History"
                        className="h-6 w-6 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
