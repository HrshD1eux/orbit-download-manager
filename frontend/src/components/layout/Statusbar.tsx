import React from 'react';
import { ArrowDown, HardDrive, Cpu, Activity } from 'lucide-react';
import { useDownloadStore } from '../../store/useDownloadStore';
import { formatSpeed } from '../../lib/utils';

export const Statusbar: React.FC = () => {
  const { systemStats, downloads } = useDownloadStore();

  const activeDownloads = downloads.filter((d) => d.status === 'downloading');
  const totalSpeed = activeDownloads.reduce((sum, d) => sum + d.speed, 0);

  return (
    <footer className="h-6 border-t border-border bg-surface-subtle/80 flex items-center justify-between px-3 text-[11px] font-mono text-muted-foreground select-none shrink-0">
      {/* Left: Engine & Network Status */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1 text-foreground font-semibold">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Engine Online</span>
        </div>

        <div className="flex items-center gap-1.5 text-primary font-semibold">
          <ArrowDown className="h-3 w-3" />
          <span>{formatSpeed(totalSpeed)}</span>
        </div>

        <div>
          <span>Active: </span>
          <span className="font-semibold text-foreground">{activeDownloads.length}</span>
        </div>
      </div>

      {/* Right: System Resources */}
      <div className="flex items-center gap-4">
        {systemStats && (
          <>
            <div className="flex items-center gap-1" title="Host CPU Usage">
              <Cpu className="h-3 w-3" />
              <span>{Math.round(systemStats.cpu_usage)}%</span>
            </div>

            <div className="flex items-center gap-1" title="Memory Allocation">
              <Activity className="h-3 w-3" />
              <span>{systemStats.memory_used_mb} MB</span>
            </div>

            <div className="flex items-center gap-1" title="Disk Free Space">
              <HardDrive className="h-3 w-3" />
              <span>{systemStats.disk_free_gb} GB Free</span>
            </div>
          </>
        )}
        <div className="text-[10px] text-muted-foreground">SQLite WAL Mode</div>
      </div>
    </footer>
  );
};
