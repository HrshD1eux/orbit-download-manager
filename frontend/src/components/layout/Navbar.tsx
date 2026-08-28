import React from 'react';
import { Plus, Layers, Play, Pause, Trash2, Search, XCircle } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useDownloadStore } from '../../store/useDownloadStore';

export const Navbar: React.FC = () => {
  const {
    downloads,
    searchQuery,
    setSearchQuery,
    setAddModalOpen,
    setBatchModalOpen,
    selectedDownloadId,
    selectedDownloadIds,
    pauseDownload,
    resumeDownload,
    pauseAllDownloads,
    resumeAllDownloads,
    clearAllDownloads,
    deleteSelectedDownloads,
  } = useDownloadStore();

  const hasSelection = selectedDownloadIds.length > 0 || !!selectedDownloadId;

  const handleResume = async () => {
    if (selectedDownloadIds.length > 0) {
      for (const id of selectedDownloadIds) {
        await resumeDownload(id);
      }
    } else if (selectedDownloadId) {
      await resumeDownload(selectedDownloadId);
    } else {
      await resumeAllDownloads();
    }
  };

  const handlePause = async () => {
    if (selectedDownloadIds.length > 0) {
      for (const id of selectedDownloadIds) {
        await pauseDownload(id);
      }
    } else if (selectedDownloadId) {
      await pauseDownload(selectedDownloadId);
    } else {
      await pauseAllDownloads();
    }
  };

  const handleDelete = async () => {
    if (hasSelection) {
      await deleteSelectedDownloads(false);
    } else if (downloads.length > 0) {
      if (window.confirm(`Stop and clear all ${downloads.length} downloads?`)) {
        await clearAllDownloads(false);
      }
    }
  };

  const handleClearAll = async () => {
    if (downloads.length === 0) return;
    if (window.confirm(`Clear all ${downloads.length} downloads from the list?`)) {
      await clearAllDownloads(false);
    }
  };

  return (
    <header className="h-10 border-b border-border bg-surface flex items-center justify-between px-3 select-none shrink-0">
      {/* Left: Quick Actions */}
      <div className="flex items-center gap-1.5">
        <Button
          variant="primary"
          size="sm"
          onClick={() => setAddModalOpen(true)}
          className="h-7 px-2.5 text-xs font-semibold"
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          Add URL
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setBatchModalOpen(true)}
          title="Batch Link Importer & Pattern Expansion"
          className="h-7 px-2 text-xs font-medium"
        >
          <Layers className="h-3.5 w-3.5 mr-1 text-primary" />
          Batch
        </Button>

        <div className="h-4 w-px bg-border mx-1" />

        <Button
          variant="outline"
          size="sm"
          onClick={handleResume}
          title={hasSelection ? 'Resume Selected' : 'Resume All Downloads'}
          className="h-7 px-2 text-xs font-medium"
        >
          <Play className="h-3.5 w-3.5 text-emerald-600 mr-1 fill-emerald-600/20" />
          {hasSelection ? 'Resume' : 'Resume All'}
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={handlePause}
          title={hasSelection ? 'Pause Selected' : 'Pause All Downloads'}
          className="h-7 px-2 text-xs font-medium"
        >
          <Pause className="h-3.5 w-3.5 text-amber-600 mr-1 fill-amber-600/20" />
          {hasSelection ? 'Pause' : 'Pause All'}
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={handleDelete}
          disabled={downloads.length === 0}
          title={hasSelection ? 'Delete Selected' : 'Delete All'}
          className="h-7 px-2 text-xs font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-40"
        >
          <Trash2 className="h-3.5 w-3.5 mr-1" />
          {hasSelection ? `Delete (${selectedDownloadIds.length || 1})` : 'Delete All'}
        </Button>

        {downloads.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearAll}
            title="Clear all downloads"
            className="h-7 px-2 text-xs text-muted-foreground hover:text-rose-600"
          >
            <XCircle className="h-3.5 w-3.5 mr-1" />
            Clear List
          </Button>
        )}
      </div>

      {/* Right: Search Filter */}
      <div className="relative w-52">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Filter..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-7 h-6 text-xs bg-surface-subtle/50"
        />
      </div>
    </header>
  );
};
