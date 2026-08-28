import React from 'react';
import { useDownloadStore } from '../../store/useDownloadStore';
import { formatSpeed } from '../../lib/utils';
import { Activity } from 'lucide-react';

export const LiveBandwidthChart: React.FC = () => {
  const { speedHistory } = useDownloadStore();

  const maxSpeed = Math.max(...speedHistory, 1024 * 1024); // at least 1MB/s scale
  const currentSpeed = speedHistory[speedHistory.length - 1] || 0;

  // Generate SVG path coordinates
  const width = 600;
  const height = 110;
  const padding = 10;
  const points = speedHistory.map((val, idx) => {
    const x = padding + (idx / (speedHistory.length - 1)) * (width - 2 * padding);
    const y = height - padding - (val / maxSpeed) * (height - 2 * padding);
    return `${x},${y}`;
  });

  const pathD = `M ${points.join(' L ')}`;
  const areaD = `M ${padding},${height - padding} L ${points.join(' L ')} L ${
    width - padding
  },${height - padding} Z`;

  return (
    <div className="p-4 bg-surface border border-border rounded-md shadow-2xs space-y-3 select-none">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" />
          <h3 className="text-xs font-semibold text-foreground">Real-Time Network Throughput</h3>
        </div>
        <div className="flex items-center gap-4 text-xs font-mono">
          <div>
            <span className="text-muted-foreground text-[10px]">CURRENT: </span>
            <span className="font-bold text-primary">{formatSpeed(currentSpeed)}</span>
          </div>
          <div>
            <span className="text-muted-foreground text-[10px]">PEAK: </span>
            <span className="font-semibold text-foreground">{formatSpeed(maxSpeed)}</span>
          </div>
        </div>
      </div>

      <div className="relative w-full h-28 bg-surface-subtle border border-border/60 rounded overflow-hidden">
        {/* Subtle grid lines */}
        <div className="absolute inset-0 flex flex-col justify-between p-2 pointer-events-none opacity-40">
          <div className="border-b border-border/80 w-full" />
          <div className="border-b border-border/80 w-full" />
          <div className="border-b border-border/80 w-full" />
        </div>

        {/* SVG Graph */}
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full preserve-3d" preserveAspectRatio="none">
          <defs>
            <linearGradient id="speedGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#1677ff" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#1677ff" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Area fill */}
          <path d={areaD} fill="url(#speedGradient)" />

          {/* Line stroke */}
          <path
            d={pathD}
            fill="none"
            stroke="#1677ff"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  );
};
