import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useDownloadStore } from '../../store/useDownloadStore';
import * as tauriService from '../../services/tauri';
import { Download } from 'lucide-react';

export const AddDownloadModal: React.FC = () => {
  const { isAddModalOpen, setAddModalOpen, loadDownloads } = useDownloadStore();

  const [url, setUrl] = useState('');
  const [customFilename, setCustomFilename] = useState('');
  const [saveDir, setSaveDir] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isAddModalOpen) {
      if (!saveDir) {
        tauriService.getDefaultDownloadDir().then(setSaveDir).catch(() => {});
      }
      // Check clipboard for copied download link
      if (navigator.clipboard) {
        navigator.clipboard.readText().then((text) => {
          if (text && (text.startsWith('http://') || text.startsWith('https://'))) {
            setUrl(text.trim());
            autoExtractFilename(text.trim());
          }
        }).catch(() => {});
      }
    }
  }, [isAddModalOpen, saveDir]);

  const autoExtractFilename = (targetUrl: string) => {
    try {
      const parsed = new URL(targetUrl);
      const parts = parsed.pathname.split('/').filter(Boolean);
      const last = parts.pop();
      if (last && last.includes('.')) {
        setCustomFilename(decodeURIComponent(last.split('?')[0]));
      }
    } catch (_) {}
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setUrl(val);
    if (val.startsWith('http')) {
      autoExtractFilename(val.trim());
    }
  };

  const handleSubmit = async (autoStart: boolean) => {
    if (!url.trim()) return;
    setIsSubmitting(true);
    try {
      await tauriService.addDownload({
        url: url.trim(),
        saveDir: saveDir || undefined,
        customFilename: customFilename.trim() || undefined,
        autoStart,
      });
      await loadDownloads();
      setUrl('');
      setCustomFilename('');
      setAddModalOpen(false);
    } catch (err: any) {
      alert(`Download failed to start: ${err.toString()}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isAddModalOpen}
      onClose={() => setAddModalOpen(false)}
      title="New Download"
      maxWidth="max-w-md"
    >
      <form onSubmit={(e) => { e.preventDefault(); handleSubmit(true); }} className="space-y-3 select-none text-xs">
        {/* URL Input */}
        <div>
          <label className="block font-medium text-foreground mb-1">Download URL</label>
          <Input
            placeholder="https://example.com/file.zip"
            value={url}
            onChange={handleUrlChange}
            autoFocus
            required
            className="font-mono text-xs"
          />
        </div>

        {/* Filename Input */}
        <div>
          <label className="block font-medium text-foreground mb-1">Save File As</label>
          <Input
            placeholder="Auto-detected from URL..."
            value={customFilename}
            onChange={(e) => setCustomFilename(e.target.value)}
            className="text-xs"
          />
        </div>

        {/* Save Folder */}
        <div>
          <label className="block font-medium text-foreground mb-1">Save Location</label>
          <Input
            value={saveDir}
            onChange={(e) => setSaveDir(e.target.value)}
            className="text-xs font-mono"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setAddModalOpen(false)}
            className="text-xs"
          >
            Cancel
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleSubmit(false)}
            disabled={isSubmitting || !url.trim()}
            className="text-xs"
          >
            Download Later
          </Button>

          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={isSubmitting || !url.trim()}
            className="text-xs font-semibold"
          >
            <Download className="w-3.5 h-3.5 mr-1" />
            Download Now
          </Button>
        </div>
      </form>
    </Modal>
  );
};
