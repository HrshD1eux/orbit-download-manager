import React from 'react';
import {
  Play,
  Pause,
  Trash2,
  FolderOpen,
  FileText,
  CheckCircle2,
  AlertCircle,
  Clock,
  ExternalLink,
} from 'lucide-react';
import type { Download } from '../../types';
import { useDownloadStore } from '../../store/useDownloadStore';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Progress } from '../ui/Progress';
import { formatBytes, formatSpeed, formatEta, formatDate, cn } from '../../lib/utils';
import * as tauriService from '../../services/tauri';

interface DownloadRowProps {
  download: Download;
  isSelected: boolean;
  onSelect: () => void;
  onOpenInspector: () => void;
}

export const DownloadRow: React.FC<DownloadRowProps> = ({
  download,
  isSelected,
  onSelect,
  onOpenInspector,
}) => {
  const { pauseDownload, resumeDownload, deleteDownload } = useDownloadStore();

  const percent =
    download.total_bytes > 0
      ? (download.downloaded_bytes / download.total_bytes) * 100
      : download.status === 'completed'
      ? 100
      : 0;

  const getStatusBadge = () => {
    switch (download.status) {
      case 'downloading':
        return (
          <Badge variant="blue" className="gap-1 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
            Downloading
          </Badge>
        );
      case 'completed':
        return (
          <Badge variant="success" className="gap-1 font-medium">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Completed
          </Badge>
        );
      case 'paused':
        return (
          <Badge variant="warning" className="gap-1 font-medium">
            <Clock className="w-3 h-3 text-amber-600" />
            Paused
          </Badge>
        );
      case 'queued':
        return <Badge variant="outline">Queued</Badge>;
      case 'failed':
        return (
          <Badge variant="destructive" className="gap-1 font-medium">
            <AlertCircle className="w-3 h-3 text-rose-600" />
            Failed
          </Badge>
        );
      default:
        return <Badge variant="outline">{download.status}</Badge>;
    }
  };

  return (
    <tr
      onClick={onSelect}
      onDoubleClick={onOpenInspector}
      className={cn(
        'group border-b border-border/70 text-xs transition-colors cursor-pointer select-none',
        isSelected ? 'bg-blue-50/70 hover:bg-blue-50/90' : 'hover:bg-surface-subtle/70'
      )}
    >
      {/* Checkbox */}
      <td className="py-2.5 px-3 w-8 text-center" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onSelect}
          className="accent-primary rounded cursor-pointer"
        />
      </td>

      {/* Status */}
      <td className="py-2.5 px-3 whitespace-nowrap w-28">{getStatusBadge()}</td>

      {/* Filename & Category (Fluid Responsive) */}
      <td className="py-2.5 px-3 font-medium text-foreground overflow-hidden">
        <div className="truncate font-semibold text-foreground text-xs" title={download.filename}>
          {download.filename}
        </div>
        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
          <span className="px-1 py-0.2 rounded bg-surface-subtle border border-border">
            {download.category}
          </span>
          <span className="font-mono">{formatDate(download.created_at)}</span>
        </div>
      </td>

      {/* Progress */}
      <td className="py-2.5 px-3 w-48">
        <div className="flex items-center justify-between text-[10px] mb-1 font-mono text-muted-foreground">
          <span className="font-semibold text-foreground">{percent.toFixed(1)}%</span>
          <span>
            {formatBytes(download.downloaded_bytes)} / {formatBytes(download.total_bytes)}
          </span>
        </div>
        <Progress
          value={percent}
          className="h-1.5"
          indicatorClassName={
            download.status === 'completed'
              ? 'bg-emerald-500'
              : download.status === 'paused'
              ? 'bg-amber-500'
              : 'bg-primary'
          }
        />
      </td>

      {/* Speed */}
      <td className="py-2.5 px-3 whitespace-nowrap font-mono font-medium text-xs w-24">
        {download.status === 'downloading' ? (
          <span className="text-primary font-bold">{formatSpeed(download.speed)}</span>
        ) : (
          <span className="text-muted-foreground">--</span>
        )}
      </td>

      {/* ETA */}
      <td className="py-2.5 px-3 whitespace-nowrap font-mono text-[11px] text-muted-foreground w-20">
        {download.status === 'downloading' ? formatEta(download.eta_seconds) : '--'}
      </td>

      {/* Actions */}
      <td className="py-2.5 px-3 whitespace-nowrap text-right w-32" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-end gap-1">
          {download.status === 'downloading' ? (
            <Button
              variant="secondary"
              size="xs"
              onClick={() => pauseDownload(download.id)}
              title="Pause"
              className="h-6 px-2 text-[11px]"
            >
              <Pause className="w-3 h-3 mr-1 fill-current" />
              Pause
            </Button>
          ) : download.status === 'paused' || download.status === 'failed' || download.status === 'cancelled' || download.status === 'queued' ? (
            <Button
              variant="secondary"
              size="xs"
              onClick={() => resumeDownload(download.id)}
              title="Resume"
              className="h-6 px-2 text-[11px] text-emerald-700"
            >
              <Play className="w-3 h-3 mr-1 fill-current" />
              Resume
            </Button>
          ) : null}

          {download.status === 'completed' && (
            <>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => tauriService.openFile(download.save_location)}
                title="Open File"
                className="h-6 w-6"
              >
                <ExternalLink className="w-3 h-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => tauriService.openFolder(download.save_location)}
                title="Open Folder"
                className="h-6 w-6"
              >
                <FolderOpen className="w-3 h-3" />
              </Button>
            </>
          )}

          <Button
            variant="ghost"
            size="icon"
            onClick={onOpenInspector}
            title="Inspect"
            className="h-6 w-6 text-muted-foreground hover:text-foreground"
          >
            <FileText className="w-3 h-3" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => deleteDownload(download.id, false)}
            title="Delete"
            className="h-6 w-6 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </td>
    </tr>
  );
};
