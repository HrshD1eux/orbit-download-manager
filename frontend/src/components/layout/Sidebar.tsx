import React from 'react';
import {
  Download,
  ArrowDownCircle,
  CheckCircle2,
  History,
  Settings,
  FolderArchive,
  FileCode2,
  FileText,
  Film,
  Music2,
  Image as ImageIcon,
  Disc,
  Gamepad2,
  Cpu,
} from 'lucide-react';
import { useDownloadStore } from '../../store/useDownloadStore';
import { cn } from '../../lib/utils';

interface SidebarProps {
  currentView: 'downloads' | 'history' | 'settings';
  setCurrentView: (view: 'downloads' | 'history' | 'settings') => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, setCurrentView }) => {
  const {
    downloads,
    statusFilter,
    setStatusFilter,
    selectedCategory,
    setSelectedCategory,
  } = useDownloadStore();

  const countByStatus = {
    all: downloads.length,
    downloading: downloads.filter((d) => d.status === 'downloading').length,
    completed: downloads.filter((d) => d.status === 'completed').length,
  };

  const categories = [
    { name: 'Software', icon: Cpu },
    { name: 'Archives', icon: FolderArchive },
    { name: 'Documents', icon: FileText },
    { name: 'Videos', icon: Film },
    { name: 'Music', icon: Music2 },
    { name: 'Images', icon: ImageIcon },
    { name: 'ISOs', icon: Disc },
    { name: 'Programming', icon: FileCode2 },
    { name: 'Games', icon: Gamepad2 },
  ];

  const handleNavClick = (status: string) => {
    setSelectedCategory(null);
    setStatusFilter(status);
    setCurrentView('downloads');
  };

  return (
    <aside className="w-44 border-r border-border bg-surface flex flex-col select-none shrink-0 h-full text-xs">
      {/* Primary Navigation */}
      <div className="p-2 space-y-0.5">
        <button
          onClick={() => handleNavClick('all')}
          className={cn(
            'w-full flex items-center justify-between px-2.5 py-1.5 rounded text-xs transition-colors',
            currentView === 'downloads' && selectedCategory === null && statusFilter === 'all'
              ? 'bg-primary text-white font-semibold'
              : 'text-foreground hover:bg-surface-subtle'
          )}
        >
          <div className="flex items-center gap-2">
            <Download className="h-3.5 w-3.5" />
            <span>All Downloads</span>
          </div>
          <span className={cn(
            "text-[10px] font-mono",
            currentView === 'downloads' && selectedCategory === null && statusFilter === 'all'
              ? "text-white/80"
              : "text-muted-foreground"
          )}>{countByStatus.all}</span>
        </button>

        <button
          onClick={() => handleNavClick('downloading')}
          className={cn(
            'w-full flex items-center justify-between px-2.5 py-1.5 rounded text-xs transition-colors',
            currentView === 'downloads' && statusFilter === 'downloading'
              ? 'bg-primary text-white font-semibold'
              : 'text-foreground hover:bg-surface-subtle'
          )}
        >
          <div className="flex items-center gap-2">
            <ArrowDownCircle className="h-3.5 w-3.5" />
            <span>Downloading</span>
          </div>
          {countByStatus.downloading > 0 && (
            <span className={cn(
              "text-[10px] px-1.5 py-0.2 rounded font-mono font-semibold",
              currentView === 'downloads' && statusFilter === 'downloading'
                ? "bg-white/20 text-white"
                : "bg-blue-100 text-blue-800"
            )}>
              {countByStatus.downloading}
            </span>
          )}
        </button>

        <button
          onClick={() => handleNavClick('completed')}
          className={cn(
            'w-full flex items-center justify-between px-2.5 py-1.5 rounded text-xs transition-colors',
            currentView === 'downloads' && statusFilter === 'completed'
              ? 'bg-primary text-white font-semibold'
              : 'text-foreground hover:bg-surface-subtle'
          )}
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>Completed</span>
          </div>
          <span className={cn(
            "text-[10px] font-mono",
            currentView === 'downloads' && statusFilter === 'completed'
              ? "text-white/80"
              : "text-muted-foreground"
          )}>{countByStatus.completed}</span>
        </button>

        <button
          onClick={() => setCurrentView('history')}
          className={cn(
            'w-full flex items-center justify-between px-2.5 py-1.5 rounded text-xs transition-colors',
            currentView === 'history'
              ? 'bg-primary text-white font-semibold'
              : 'text-foreground hover:bg-surface-subtle'
          )}
        >
          <div className="flex items-center gap-2">
            <History className="h-3.5 w-3.5" />
            <span>History</span>
          </div>
        </button>
      </div>

      <div className="h-px bg-border my-1 mx-2" />

      {/* Categories */}
      <div className="p-2 space-y-0.5 flex-1 overflow-y-auto">
        <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Categories
        </div>

        {categories.map((cat) => {
          const Icon = cat.icon;
          const count = downloads.filter((d) => d.category.toLowerCase() === cat.name.toLowerCase()).length;
          const isSelected = currentView === 'downloads' && selectedCategory === cat.name;

          return (
            <button
              key={cat.name}
              onClick={() => {
                setSelectedCategory(cat.name);
                setStatusFilter('all');
                setCurrentView('downloads');
              }}
              className={cn(
                'w-full flex items-center justify-between px-2 py-1 rounded text-xs transition-colors',
                isSelected
                  ? 'bg-surface-subtle font-semibold text-primary border border-border/80'
                  : 'text-foreground hover:bg-surface-subtle'
              )}
            >
              <div className="flex items-center gap-2">
                <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                <span>{cat.name}</span>
              </div>
              {count > 0 && (
                <span className="text-[10px] text-muted-foreground font-mono">{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Bottom Anchored Single Settings Button */}
      <div className="p-2 border-t border-border bg-surface shrink-0">
        <button
          onClick={() => setCurrentView('settings')}
          className={cn(
            'w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-xs font-medium transition-colors',
            currentView === 'settings'
              ? 'bg-primary text-white font-semibold'
              : 'text-foreground hover:bg-surface-subtle'
          )}
        >
          <Settings className="h-3.5 w-3.5" />
          <span>Settings</span>
        </button>
      </div>
    </aside>
  );
};
