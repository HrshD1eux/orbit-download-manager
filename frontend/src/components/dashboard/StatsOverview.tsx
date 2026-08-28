import React from 'react';
import {
  ArrowDownCircle,
  CheckCircle2,
  AlertCircle,
  Clock,
} from 'lucide-react';
import { useDownloadStore } from '../../store/useDownloadStore';
import { formatBytes, formatSpeed } from '../../lib/utils';

export const StatsOverview: React.FC = () => {
  const { downloads } = useDownloadStore();

  const downloading = downloads.filter((d) => d.status === 'downloading');
  const completed = downloads.filter((d) => d.status === 'completed');
  const failed = downloads.filter((d) => d.status === 'failed');
  const queued = downloads.filter((d) => d.status === 'queued');

  const totalSpeed = downloading.reduce((sum, d) => sum + d.speed, 0);
  const totalDownloaded = downloads.reduce((sum, d) => sum + d.downloaded_bytes, 0);

  const stats = [
    {
      title: 'Current Transfer Rate',
      value: formatSpeed(totalSpeed),
      subtext: `${downloading.length} active downloads`,
      icon: ArrowDownCircle,
      iconColor: 'text-primary',
      bgAccent: 'border-l-2 border-l-primary',
    },
    {
      title: 'Completed Files',
      value: completed.length.toString(),
      subtext: formatBytes(totalDownloaded),
      icon: CheckCircle2,
      iconColor: 'text-emerald-600',
      bgAccent: 'border-l-2 border-l-emerald-500',
    },
    {
      title: 'In Queue',
      value: queued.length.toString(),
      subtext: 'Auto-scheduled',
      icon: Clock,
      iconColor: 'text-indigo-500',
      bgAccent: 'border-l-2 border-l-indigo-500',
    },
    {
      title: 'Failed / Interrupted',
      value: failed.length.toString(),
      subtext: failed.length > 0 ? 'Requires attention' : 'All good',
      icon: AlertCircle,
      iconColor: failed.length > 0 ? 'text-rose-600' : 'text-muted-foreground',
      bgAccent: failed.length > 0 ? 'border-l-2 border-l-rose-500' : 'border-l-2 border-l-border',
    },
  ];

  return (
    <div className="grid grid-cols-4 gap-3 select-none">
      {stats.map((item, idx) => {
        const Icon = item.icon;
        return (
          <div
            key={idx}
            className={`p-3.5 bg-surface border border-border rounded-md shadow-2xs ${item.bgAccent} flex items-center justify-between`}
          >
            <div>
              <span className="text-[11px] font-medium text-muted-foreground">{item.title}</span>
              <div className="text-lg font-bold font-mono text-foreground mt-0.5">{item.value}</div>
              <span className="text-[10px] text-muted-foreground mt-0.5 block">{item.subtext}</span>
            </div>
            <div className="p-2 rounded bg-surface-subtle border border-border/60 shrink-0">
              <Icon className={`w-4 h-4 ${item.iconColor}`} />
            </div>
          </div>
        );
      })}
    </div>
  );
};
