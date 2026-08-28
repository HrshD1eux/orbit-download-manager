import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useDownloadStore } from '../../store/useDownloadStore';
import * as tauriService from '../../services/tauri';
import { Upload, Wand2, Download } from 'lucide-react';

interface BatchImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BatchImportModal: React.FC<BatchImportModalProps> = ({ isOpen, onClose }) => {
  const { loadDownloads } = useDownloadStore();
  const [text, setText] = useState('');
  const [patternInput, setPatternInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Expand Wildcard Range (e.g. https://site.com/file[01-10].zip)
  const handleExpandPattern = () => {
    if (!patternInput.trim()) return;
    const match = patternInput.match(/\[(\d+)-(\d+)\]/);
    if (!match) {
      alert('Invalid range syntax. Use [01-10] or [1-20]');
      return;
    }

    const startStr = match[1];
    const endStr = match[2];
    const start = parseInt(startStr, 10);
    const end = parseInt(endStr, 10);
    const padLen = startStr.length;

    if (start > end || end - start > 200) {
      alert('Please specify a valid range between 1 and 200 items.');
      return;
    }

    const expanded: string[] = [];
    for (let i = start; i <= end; i++) {
      const numFormatted = i.toString().padStart(padLen, '0');
      expanded.push(patternInput.replace(match[0], numFormatted));
    }

    setText((prev) => (prev ? `${prev}\n${expanded.join('\n')}` : expanded.join('\n')));
    setPatternInput('');
  };

  // Upload .txt file
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setText((prev) => (prev ? `${prev}\n${content}` : content));
      }
    };
    reader.readAsText(file);
  };

  const urls = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('http://') || l.startsWith('https://') || l.startsWith('ftp://'));

  const handleImport = async (autoStart: boolean) => {
    if (urls.length === 0) return;
    setIsSubmitting(true);
    try {
      await tauriService.addBatchDownloads(urls, undefined, autoStart);
      await loadDownloads();
      setText('');
      onClose();
    } catch (err: any) {
      alert(`Batch import failed: ${err.toString()}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Batch Link Importer"
      maxWidth="max-w-lg"
    >
      <div className="space-y-3.5 select-none text-xs">
        {/* Pattern Expander Bar */}
        <div className="p-2.5 bg-surface-subtle border border-border rounded flex items-center gap-2">
          <input
            type="text"
            placeholder="e.g. https://site.com/video_[01-12].mp4"
            value={patternInput}
            onChange={(e) => setPatternInput(e.target.value)}
            className="flex-1 px-2.5 py-1 text-xs font-mono bg-surface border border-border rounded"
          />
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={handleExpandPattern}
            className="shrink-0 text-[11px]"
          >
            <Wand2 className="w-3 h-3 mr-1" />
            Expand Range
          </Button>
        </div>

        {/* Textarea */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="font-medium text-foreground">URLs to Ingest (One per line)</label>
            <label className="text-primary hover:underline cursor-pointer flex items-center gap-1 text-[11px]">
              <Upload className="w-3 h-3" />
              <span>Import .txt</span>
              <input type="file" accept=".txt,.urls" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>
          <textarea
            rows={7}
            placeholder="https://example.com/file1.iso&#10;https://example.com/file2.iso"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full p-2.5 text-xs font-mono bg-surface border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <div className="text-[11px] text-muted-foreground mt-1 flex justify-between">
            <span>{urls.length} valid links detected</span>
            <span>Supports HTTP, HTTPS, FTP</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
          <Button type="button" variant="ghost" size="sm" onClick={onClose} className="text-xs">
            Cancel
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleImport(false)}
            disabled={isSubmitting || urls.length === 0}
            className="text-xs"
          >
            Add as Paused
          </Button>

          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => handleImport(true)}
            disabled={isSubmitting || urls.length === 0}
            className="text-xs font-semibold"
          >
            <Download className="w-3.5 h-3.5 mr-1" />
            Download All ({urls.length})
          </Button>
        </div>
      </div>
    </Modal>
  );
};
