import { create } from 'zustand';
import type { Download, DownloadProgressEvent, Rule, SystemStats } from '../types';
import * as tauriService from '../services/tauri';

interface DownloadStore {
  downloads: Download[];
  rules: Rule[];
  selectedCategory: string | null;
  statusFilter: string;
  searchQuery: string;
  selectedDownloadId: string | null;
  selectedDownloadIds: string[];
  isAddModalOpen: boolean;
  isBatchModalOpen: boolean;
  isInspectorOpen: boolean;
  systemStats: SystemStats | null;
  speedHistory: number[];

  // Actions
  setDownloads: (downloads: Download[]) => void;
  setRules: (rules: Rule[]) => void;
  setSelectedCategory: (cat: string | null) => void;
  setStatusFilter: (status: string) => void;
  setSearchQuery: (query: string) => void;
  setSelectedDownloadId: (id: string | null) => void;
  setSelectedDownloadIds: (ids: string[]) => void;
  toggleSelectDownloadId: (id: string) => void;
  selectAllDownloads: () => void;
  clearSelection: () => void;
  setAddModalOpen: (open: boolean) => void;
  setBatchModalOpen: (open: boolean) => void;
  setInspectorOpen: (open: boolean) => void;
  setSystemStats: (stats: SystemStats) => void;
  
  loadDownloads: () => Promise<void>;
  loadRules: () => Promise<void>;
  saveRule: (rule: Rule) => Promise<void>;
  deleteRule: (id: string) => Promise<void>;
  toggleRule: (id: string) => Promise<void>;

  updateProgress: (event: DownloadProgressEvent) => void;
  onDownloadCompleted: (download: Download) => void;
  pauseDownload: (id: string) => Promise<void>;
  resumeDownload: (id: string) => Promise<void>;
  cancelDownload: (id: string) => Promise<void>;
  deleteDownload: (id: string, deleteFile?: boolean) => Promise<void>;
  pauseAllDownloads: () => Promise<void>;
  resumeAllDownloads: () => Promise<void>;
  clearAllDownloads: (deleteFiles?: boolean) => Promise<void>;
  deleteSelectedDownloads: (deleteFiles?: boolean) => Promise<void>;
}

export const useDownloadStore = create<DownloadStore>((set, get) => ({
  downloads: [],
  rules: [],
  selectedCategory: null,
  statusFilter: 'all',
  searchQuery: '',
  selectedDownloadId: null,
  selectedDownloadIds: [],
  isAddModalOpen: false,
  isBatchModalOpen: false,
  isInspectorOpen: false,
  systemStats: null,
  speedHistory: new Array(30).fill(0),

  setDownloads: (downloads) => set({ downloads }),
  setRules: (rules) => set({ rules }),
  setSelectedCategory: (selectedCategory) => set({ selectedCategory }),
  setStatusFilter: (statusFilter) => set({ statusFilter }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setSelectedDownloadId: (selectedDownloadId) => set({ selectedDownloadId }),
  setSelectedDownloadIds: (selectedDownloadIds) => set({ selectedDownloadIds }),
  toggleSelectDownloadId: (id) =>
    set((state) => {
      const exists = state.selectedDownloadIds.includes(id);
      const next = exists
        ? state.selectedDownloadIds.filter((x) => x !== id)
        : [...state.selectedDownloadIds, id];
      return { selectedDownloadIds: next, selectedDownloadId: next[0] || null };
    }),
  selectAllDownloads: () =>
    set((state) => ({
      selectedDownloadIds: state.downloads.map((d) => d.id),
      selectedDownloadId: state.downloads[0]?.id || null,
    })),
  clearSelection: () => set({ selectedDownloadIds: [], selectedDownloadId: null }),
  setAddModalOpen: (isAddModalOpen) => set({ isAddModalOpen }),
  setBatchModalOpen: (isBatchModalOpen) => set({ isBatchModalOpen }),
  setInspectorOpen: (isInspectorOpen) => set({ isInspectorOpen }),
  setSystemStats: (systemStats) => set((state) => {
    const newSpeedHistory = [...state.speedHistory.slice(1), systemStats.total_speed_bytes_sec];
    return { systemStats, speedHistory: newSpeedHistory };
  }),

  loadDownloads: async () => {
    const list = await tauriService.getDownloads();
    set({ downloads: list });
  },

  loadRules: async () => {
    const list = await tauriService.getRules();
    set({ rules: list });
  },

  saveRule: async (rule) => {
    await tauriService.saveRule(rule);
    await get().loadRules();
  },

  deleteRule: async (id) => {
    await tauriService.deleteRule(id);
    await get().loadRules();
  },

  toggleRule: async (id) => {
    await tauriService.toggleRule(id);
    await get().loadRules();
  },

  updateProgress: (event) => {
    set((state) => {
      const idx = state.downloads.findIndex((d) => d.id === event.id);
      if (idx === -1) return state;

      const updated = [...state.downloads];
      const prev = updated[idx];

      updated[idx] = {
        ...prev,
        status: event.status,
        downloaded_bytes: event.downloaded_bytes,
        total_bytes: event.total_bytes,
        remaining_bytes: Math.max(0, event.total_bytes - event.downloaded_bytes),
        speed: event.speed,
        eta_seconds: event.eta_seconds,
        chunks: event.chunks,
      };

      return { downloads: updated };
    });
  },

  onDownloadCompleted: (download) => {
    set((state) => {
      const idx = state.downloads.findIndex((d) => d.id === download.id);
      if (idx === -1) {
        return { downloads: [download, ...state.downloads] };
      }
      const updated = [...state.downloads];
      updated[idx] = download;
      return { downloads: updated };
    });
  },

  pauseDownload: async (id) => {
    await tauriService.pauseDownload(id);
    set((state) => ({
      downloads: state.downloads.map((d) =>
        d.id === id ? { ...d, status: 'paused', speed: 0 } : d
      ),
    }));
  },

  resumeDownload: async (id) => {
    await tauriService.resumeDownload(id);
    set((state) => ({
      downloads: state.downloads.map((d) =>
        d.id === id ? { ...d, status: 'downloading' } : d
      ),
    }));
  },

  cancelDownload: async (id) => {
    await tauriService.cancelDownload(id);
    set((state) => ({
      downloads: state.downloads.map((d) =>
        d.id === id ? { ...d, status: 'cancelled', speed: 0 } : d
      ),
    }));
  },

  deleteDownload: async (id, deleteFile = false) => {
    await tauriService.deleteDownload(id, deleteFile);
    set((state) => ({
      downloads: state.downloads.filter((d) => d.id !== id),
      selectedDownloadId: state.selectedDownloadId === id ? null : state.selectedDownloadId,
      selectedDownloadIds: state.selectedDownloadIds.filter((x) => x !== id),
    }));
  },

  pauseAllDownloads: async () => {
    await tauriService.pauseAllDownloads();
    set((state) => ({
      downloads: state.downloads.map((d) =>
        d.status === 'downloading' || d.status === 'queued'
          ? { ...d, status: 'paused', speed: 0 }
          : d
      ),
    }));
  },

  resumeAllDownloads: async () => {
    await tauriService.resumeAllDownloads();
    set((state) => ({
      downloads: state.downloads.map((d) =>
        d.status === 'paused' || d.status === 'failed' || d.status === 'cancelled'
          ? { ...d, status: 'downloading' }
          : d
      ),
    }));
  },

  clearAllDownloads: async (deleteFiles = false) => {
    await tauriService.clearAllDownloads(deleteFiles);
    set({ downloads: [], selectedDownloadId: null, selectedDownloadIds: [] });
  },

  deleteSelectedDownloads: async (deleteFiles = false) => {
    const { selectedDownloadIds, selectedDownloadId } = get();
    const idsToDelete = selectedDownloadIds.length > 0
      ? selectedDownloadIds
      : selectedDownloadId
      ? [selectedDownloadId]
      : [];

    if (idsToDelete.length === 0) return;

    await tauriService.deleteMultipleDownloads(idsToDelete, deleteFiles);
    set((state) => ({
      downloads: state.downloads.filter((d) => !idsToDelete.includes(d.id)),
      selectedDownloadId: null,
      selectedDownloadIds: [],
    }));
  },
}));
