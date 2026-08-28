import React from 'react';
import { DownloadRow } from './DownloadRow';
import { useDownloadStore } from '../../store/useDownloadStore';
import { Download, Inbox } from 'lucide-react';
import { Button } from '../ui/Button';

export const DownloadTable: React.FC = () => {
  const {
    downloads,
    statusFilter,
    selectedCategory,
    searchQuery,
    selectedDownloadId,
    selectedDownloadIds,
    setSelectedDownloadId,
    toggleSelectDownloadId,
    selectAllDownloads,
    clearSelection,
    setInspectorOpen,
    setAddModalOpen,
  } = useDownloadStore();

  const filteredDownloads = downloads.filter((d) => {
    // Status Filter
    if (statusFilter !== 'all' && d.status !== statusFilter) {
      return false;
    }
    // Category Filter
    if (selectedCategory && d.category.toLowerCase() !== selectedCategory.toLowerCase()) {
      return false;
    }
    // Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = d.filename.toLowerCase().includes(q);
      const matchUrl = d.url.toLowerCase().includes(q);
      const matchTag = d.tags.some((t) => t.toLowerCase().includes(q));
      if (!matchName && !matchUrl && !matchTag) return false;
    }
    return true;
  });

  const isAllSelected = filteredDownloads.length > 0 && selectedDownloadIds.length === filteredDownloads.length;

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      clearSelection();
    } else {
      selectAllDownloads();
    }
  };

  return (
    <div className="flex-1 w-full flex flex-col h-full bg-surface overflow-hidden select-none">
      {filteredDownloads.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center select-none">
          <div className="w-10 h-10 rounded-full bg-surface-subtle border border-border flex items-center justify-center text-muted-foreground mb-2">
            <Inbox className="w-5 h-5" />
          </div>
          <h3 className="text-xs font-semibold text-foreground">No downloads in this view</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5 max-w-xs">
            {searchQuery
              ? `No items match "${searchQuery}"`
              : 'Add a new URL to start downloading.'}
          </p>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setAddModalOpen(true)}
            className="mt-3 text-xs font-semibold"
          >
            <Download className="w-3.5 h-3.5 mr-1" />
            Add URL
          </Button>
        </div>
      ) : (
        <div className="flex-1 w-full overflow-auto">
          <table className="w-full min-w-full text-left border-collapse text-xs table-fixed">
            <thead className="bg-surface-subtle/90 sticky top-0 z-10 border-b border-border text-[11px] font-semibold text-muted-foreground select-none">
              <tr>
                <th className="py-2 px-3 w-8 text-center">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={handleToggleSelectAll}
                    className="accent-primary rounded cursor-pointer"
                  />
                </th>
                <th className="py-2 px-3 w-28">Status</th>
                <th className="py-2 px-3">File Name</th>
                <th className="py-2 px-3 w-48">Progress</th>
                <th className="py-2 px-3 w-24">Speed</th>
                <th className="py-2 px-3 w-20">Time Left</th>
                <th className="py-2 px-3 w-32 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filteredDownloads.map((d) => {
                const isSelected = selectedDownloadIds.includes(d.id) || selectedDownloadId === d.id;
                return (
                  <DownloadRow
                    key={d.id}
                    download={d}
                    isSelected={isSelected}
                    onSelect={() => {
                      setSelectedDownloadId(d.id);
                      toggleSelectDownloadId(d.id);
                    }}
                    onOpenInspector={() => {
                      setSelectedDownloadId(d.id);
                      setInspectorOpen(true);
                    }}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
