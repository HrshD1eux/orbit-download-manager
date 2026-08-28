import React from 'react';
import { StatsOverview } from '../components/dashboard/StatsOverview';
import { LiveBandwidthChart } from '../components/dashboard/LiveBandwidthChart';
import { useDownloadStore } from '../store/useDownloadStore';
import { DownloadRow } from '../components/downloads/DownloadRow';
import { Button } from '../components/ui/Button';
import { ArrowRight, Download, Sparkles } from 'lucide-react';

interface DashboardPageProps {
  onNavigateToDownloads: () => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigateToDownloads }) => {
  const {
    downloads,
    setAddModalOpen,
    selectedDownloadId,
    setSelectedDownloadId,
    setInspectorOpen,
  } = useDownloadStore();

  const activeDownloads = downloads.filter((d) => d.status === 'downloading');
  const recentDownloads = downloads.slice(0, 5);

  return (
    <div className="flex-1 p-5 overflow-y-auto space-y-5 bg-background select-none">
      {/* Welcome Banner */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-foreground tracking-tight">Dashboard Overview</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Real-time telemetry, connection performance, and storage metrics.
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={() => setAddModalOpen(true)}
          className="text-xs font-semibold"
        >
          <Download className="w-3.5 h-3.5 mr-1" />
          Add URL
        </Button>
      </div>

      {/* Top Section: Quick Metrics */}
      <StatsOverview />

      {/* Middle Section: Live Bandwidth Chart */}
      <LiveBandwidthChart />

      {/* Bottom Section: Active & Recent Activity */}
      <div className="bg-surface border border-border rounded-md shadow-2xs overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface-subtle/50">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <h3 className="text-xs font-semibold text-foreground">
              {activeDownloads.length > 0
                ? `Live Downloads (${activeDownloads.length})`
                : 'Recent Activity'}
            </h3>
          </div>
          <Button
            variant="ghost"
            size="xs"
            onClick={onNavigateToDownloads}
            className="text-xs text-primary hover:text-primary-hover gap-1"
          >
            <span>View All Downloads</span>
            <ArrowRight className="w-3 h-3" />
          </Button>
        </div>

        {recentDownloads.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground">
            No downloads recorded yet. Click <strong>New Download</strong> to start.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-surface-subtle/40 border-b border-border text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                <tr>
                  <th className="py-2 px-3 w-28">Status</th>
                  <th className="py-2 px-3">Filename</th>
                  <th className="py-2 px-3 w-48">Progress</th>
                  <th className="py-2 px-3 w-24">Speed</th>
                  <th className="py-2 px-3 w-20">ETA</th>
                  <th className="py-2 px-3 w-16 text-center">Conn</th>
                  <th className="py-2 px-3 w-20">Priority</th>
                  <th className="py-2 px-3 w-28 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {(activeDownloads.length > 0 ? activeDownloads : recentDownloads).map((d) => (
                  <DownloadRow
                    key={d.id}
                    download={d}
                    isSelected={selectedDownloadId === d.id}
                    onSelect={() => setSelectedDownloadId(d.id)}
                    onOpenInspector={() => {
                      setSelectedDownloadId(d.id);
                      setInspectorOpen(true);
                    }}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
