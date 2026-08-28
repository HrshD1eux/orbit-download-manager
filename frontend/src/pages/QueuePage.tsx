import React, { useState } from 'react';
import { Layers } from 'lucide-react';
import { Badge } from '../components/ui/Badge';
import { useDownloadStore } from '../store/useDownloadStore';

export const QueuePage: React.FC = () => {
  const { downloads } = useDownloadStore();
  const [maxConcurrent, setMaxConcurrent] = useState(3);

  const queuedDownloads = downloads.filter((d) => d.status === 'queued');
  const activeDownloads = downloads.filter((d) => d.status === 'downloading');

  const queues = [
    { name: 'Default Queue', priority: 'Normal', maxSpeed: 'Unlimited', activeCount: activeDownloads.length, total: downloads.length },
    { name: 'Games & Large Files', priority: 'High', maxSpeed: 'Unlimited', activeCount: 0, total: 0 },
    { name: 'Software Updates', priority: 'Normal', maxSpeed: 'Unlimited', activeCount: 0, total: 0 },
    { name: 'ISOs & Media', priority: 'Low', maxSpeed: 'Unlimited', activeCount: 0, total: 0 },
  ];

  return (
    <div className="flex-1 p-5 overflow-y-auto space-y-5 bg-background select-none">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-foreground tracking-tight">Queue Manager</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure multi-queue execution policies, concurrency limits, and scheduled tasks.
          </p>
        </div>
      </div>

      {/* Global Queue Controls Card */}
      <div className="p-4 bg-surface border border-border rounded-md shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-primary" />
            <h3 className="text-xs font-semibold text-foreground">Global Concurrency & Scheduling</h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Max Active Downloads:</span>
            <select
              value={maxConcurrent}
              onChange={(e) => setMaxConcurrent(Number(e.target.value))}
              className="h-7 px-2 text-xs rounded border border-border bg-surface text-foreground"
            >
              <option value="1">1 (Sequential)</option>
              <option value="2">2 Concurrent</option>
              <option value="3">3 Concurrent (Recommended)</option>
              <option value="5">5 Concurrent</option>
              <option value="10">10 Concurrent</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 pt-2 text-xs border-t border-border">
          <div className="p-3 bg-surface-subtle border border-border/80 rounded">
            <span className="text-[11px] text-muted-foreground">Currently Active</span>
            <div className="text-base font-bold font-mono text-primary mt-0.5">
              {activeDownloads.length} / {maxConcurrent} slots
            </div>
          </div>
          <div className="p-3 bg-surface-subtle border border-border/80 rounded">
            <span className="text-[11px] text-muted-foreground">Waiting in Queue</span>
            <div className="text-base font-bold font-mono text-foreground mt-0.5">
              {queuedDownloads.length} files
            </div>
          </div>
          <div className="p-3 bg-surface-subtle border border-border/80 rounded">
            <span className="text-[11px] text-muted-foreground">Scheduler Status</span>
            <div className="text-base font-bold text-emerald-700 mt-0.5 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Active
            </div>
          </div>
        </div>
      </div>

      {/* Queues List */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-foreground">Configured Queues</h3>

        <div className="grid grid-cols-2 gap-3">
          {queues.map((q, idx) => (
            <div
              key={idx}
              className="p-3.5 bg-surface border border-border rounded-md shadow-2xs space-y-2.5"
            >
              <div className="flex items-center justify-between">
                <div className="font-semibold text-xs text-foreground">{q.name}</div>
                <Badge variant={idx === 0 ? 'blue' : 'outline'}>{q.priority} Priority</Badge>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                <div>
                  <span>Speed Limit: </span>
                  <strong className="text-foreground">{q.maxSpeed}</strong>
                </div>
                <div>
                  <span>Active Tasks: </span>
                  <strong className="text-foreground">{q.activeCount}</strong>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
