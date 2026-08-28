import React from 'react';
import { DownloadTable } from '../components/downloads/DownloadTable';
import { DownloadInspector } from '../components/downloads/DownloadInspector';

export const DownloadsPage: React.FC = () => {
  return (
    <div className="flex-1 flex overflow-hidden relative">
      <DownloadTable />
      <DownloadInspector />
    </div>
  );
};
