import React, { useEffect, useState } from 'react';
import { Navbar } from './components/layout/Navbar';
import { Sidebar } from './components/layout/Sidebar';
import { Statusbar } from './components/layout/Statusbar';
import { DownloadsPage } from './pages/DownloadsPage';
import { HistoryPage } from './pages/HistoryPage';
import { SettingsPage } from './pages/SettingsPage';
import { AddDownloadModal } from './components/downloads/AddDownloadModal';
import { BatchImportModal } from './components/downloads/BatchImportModal';
import { useDownloadStore } from './store/useDownloadStore';
import * as tauriService from './services/tauri';

export const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<'downloads' | 'history' | 'settings'>('downloads');
  const {
    loadDownloads,
    loadRules,
    updateProgress,
    onDownloadCompleted,
    setSystemStats,
    isBatchModalOpen,
    setBatchModalOpen,
  } = useDownloadStore();

  useEffect(() => {
    // Initial Load of downloads and automation rules
    loadDownloads();
    loadRules();

    // Subscribe to IPC Progress Stream
    let unlistenProgress: (() => void) | undefined;
    let unlistenCompleted: (() => void) | undefined;

    tauriService.subscribeToProgress((event) => {
      updateProgress(event);
    }).then((unlisten) => {
      unlistenProgress = unlisten;
    });

    tauriService.subscribeToCompleted((download) => {
      onDownloadCompleted(download);
    }).then((unlisten) => {
      unlistenCompleted = unlisten;
    });

    // Poll System Telemetry every 1 second
    const statsInterval = setInterval(async () => {
      try {
        const stats = await tauriService.getSystemStats();
        setSystemStats(stats);
      } catch (err) {
        // Ignore in browser mock mode
      }
    }, 1000);

    return () => {
      if (unlistenProgress) unlistenProgress();
      if (unlistenCompleted) unlistenCompleted();
      clearInterval(statsInterval);
    };
  }, [loadDownloads, loadRules, updateProgress, onDownloadCompleted, setSystemStats]);

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-background text-foreground select-none">
      {/* Top Minimal Navbar (Neat Style) */}
      <Navbar />

      {/* Main Split Layout */}
      <div className="flex-1 flex overflow-hidden">
        <Sidebar currentView={currentView} setCurrentView={setCurrentView} />

        <main className="flex-1 flex flex-col overflow-hidden bg-background">
          {currentView === 'downloads' && <DownloadsPage />}
          {currentView === 'history' && <HistoryPage />}
          {currentView === 'settings' && <SettingsPage />}
        </main>
      </div>

      {/* Bottom Status Bar */}
      <Statusbar />

      {/* Add Download Modal */}
      <AddDownloadModal />

      {/* Batch Import Modal */}
      <BatchImportModal isOpen={isBatchModalOpen} onClose={() => setBatchModalOpen(false)} />
    </div>
  );
};
