import React, { useState, useEffect } from 'react';
import { HardDrive, Network, RefreshCw, CheckCircle2, Shield, Gauge, Terminal } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { RulesPage } from './RulesPage';
import { QueuePage } from './QueuePage';
import * as tauriService from '../services/tauri';
import type { UpdateCheckResult } from '../types';

export const SettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'general' | 'network' | 'rules' | 'queue'>('general');
  const [downloadDir, setDownloadDir] = useState('C:/Downloads');
  const [defaultConnections, setDefaultConnections] = useState(16);
  const [globalSpeedLimit, setGlobalSpeedLimit] = useState<number>(0);
  const [proxyUrl, setProxyUrl] = useState('');
  const [webhookCommand, setWebhookCommand] = useState('');
  const [savedNotice, setSavedNotice] = useState(false);

  // Update Checker State
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [updateResult, setUpdateResult] = useState<UpdateCheckResult | null>(null);

  useEffect(() => {
    tauriService.getDefaultDownloadDir().then(setDownloadDir).catch(console.error);
    const savedProxy = localStorage.getItem('orbit_proxy_url');
    if (savedProxy) setProxyUrl(savedProxy);
    const savedWebhook = localStorage.getItem('orbit_webhook_cmd');
    if (savedWebhook) setWebhookCommand(savedWebhook);
  }, []);

  const handleSave = () => {
    localStorage.setItem('orbit_proxy_url', proxyUrl);
    localStorage.setItem('orbit_webhook_cmd', webhookCommand);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2000);
  };

  const handleCheckUpdates = async () => {
    setIsCheckingUpdate(true);
    try {
      const res = await tauriService.checkForUpdates();
      setUpdateResult(res);
    } catch (e) {
      console.error(e);
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-background select-none">
      {/* Settings Tab Header */}
      <div className="h-10 border-b border-border bg-surface px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab('general')}
            className={`px-3 py-1 text-xs font-semibold rounded transition-colors ${
              activeTab === 'general' ? 'bg-primary text-white' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            General & Storage
          </button>
          <button
            onClick={() => setActiveTab('network')}
            className={`px-3 py-1 text-xs font-semibold rounded transition-colors ${
              activeTab === 'network' ? 'bg-primary text-white' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Network & Proxy
          </button>
          <button
            onClick={() => setActiveTab('rules')}
            className={`px-3 py-1 text-xs font-semibold rounded transition-colors ${
              activeTab === 'rules' ? 'bg-primary text-white' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Smart Rules
          </button>
          <button
            onClick={() => setActiveTab('queue')}
            className={`px-3 py-1 text-xs font-semibold rounded transition-colors ${
              activeTab === 'queue' ? 'bg-primary text-white' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Queue & Limits
          </button>
        </div>

        {(activeTab === 'general' || activeTab === 'network') && (
          <Button variant="primary" size="xs" onClick={handleSave} className="text-xs font-semibold">
            {savedNotice ? 'Saved!' : 'Save'}
          </Button>
        )}
      </div>

      {/* Tab 1: General */}
      {activeTab === 'general' && (
        <div className="flex-1 p-5 overflow-y-auto space-y-4 max-w-2xl">
          {/* Storage Settings */}
          <div className="p-3.5 bg-surface border border-border rounded space-y-2.5">
            <div className="flex items-center gap-2 border-b border-border pb-1.5">
              <HardDrive className="w-3.5 h-3.5 text-primary" />
              <h3 className="text-xs font-semibold text-foreground">Storage Location</h3>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                Default Download Directory
              </label>
              <Input
                value={downloadDir}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDownloadDir(e.target.value)}
                className="text-xs font-mono"
              />
            </div>
          </div>

          {/* Post-Download Webhook / Script Execution */}
          <div className="p-3.5 bg-surface border border-border rounded space-y-2.5">
            <div className="flex items-center gap-2 border-b border-border pb-1.5">
              <Terminal className="w-3.5 h-3.5 text-primary" />
              <h3 className="text-xs font-semibold text-foreground">Post-Download Shell Webhook</h3>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                Execute Shell Command on Finish (Variables: <code className="font-mono">{'{FILE}'}</code>, <code className="font-mono">{'{DIR}'}</code>, <code className="font-mono">{'{SIZE}'}</code>)
              </label>
              <Input
                placeholder="e.g. echo Downloaded {FILE} >> C:/logs.txt"
                value={webhookCommand}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setWebhookCommand(e.target.value)}
                className="text-xs font-mono"
              />
            </div>
          </div>

          {/* Updates */}
          <div className="p-3.5 bg-surface border border-border rounded space-y-2.5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-foreground">Orbit Download Manager v1.1.1</div>
                <div className="text-[11px] text-muted-foreground">Check for software updates and engine upgrades.</div>
              </div>
              <Button
                variant="outline"
                size="xs"
                onClick={handleCheckUpdates}
                disabled={isCheckingUpdate}
                className="text-xs shrink-0"
              >
                <RefreshCw className={`w-3 h-3 mr-1 ${isCheckingUpdate ? 'animate-spin' : ''}`} />
                {isCheckingUpdate ? 'Checking...' : 'Check for Updates'}
              </Button>
            </div>

            {updateResult && (
              <div className="pt-2 border-t border-border text-[11px]">
                {!updateResult.is_up_to_date ? (
                  <div className="text-emerald-700 font-medium">New version {updateResult.latest_version} available!</div>
                ) : (
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>You have the latest version.</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Network & Proxy */}
      {activeTab === 'network' && (
        <div className="flex-1 p-5 overflow-y-auto space-y-4 max-w-2xl">
          {/* Acceleration & Threads */}
          <div className="p-3.5 bg-surface border border-border rounded space-y-2.5">
            <div className="flex items-center gap-2 border-b border-border pb-1.5">
              <Network className="w-3.5 h-3.5 text-primary" />
              <h3 className="text-xs font-semibold text-foreground">Parallel Acceleration</h3>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                Connections per Download ({defaultConnections} threads)
              </label>
              <input
                type="range"
                min="1"
                max="32"
                step="1"
                value={defaultConnections}
                onChange={(e) => setDefaultConnections(Number(e.target.value))}
                className="w-full accent-primary h-1.5 cursor-pointer mt-1"
              />
            </div>
          </div>

          {/* Bandwidth Limiter */}
          <div className="p-3.5 bg-surface border border-border rounded space-y-2.5">
            <div className="flex items-center gap-2 border-b border-border pb-1.5">
              <Gauge className="w-3.5 h-3.5 text-primary" />
              <h3 className="text-xs font-semibold text-foreground">Bandwidth Speed Cap</h3>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                Global Speed Limit ({globalSpeedLimit === 0 ? 'Unlimited (Max Speed)' : `${globalSpeedLimit} MB/s`})
              </label>
              <input
                type="range"
                min="0"
                max="50"
                step="1"
                value={globalSpeedLimit}
                onChange={(e) => setGlobalSpeedLimit(Number(e.target.value))}
                className="w-full accent-primary h-1.5 cursor-pointer mt-1"
              />
            </div>
          </div>

          {/* Proxy Configuration */}
          <div className="p-3.5 bg-surface border border-border rounded space-y-2.5">
            <div className="flex items-center gap-2 border-b border-border pb-1.5">
              <Shield className="w-3.5 h-3.5 text-primary" />
              <h3 className="text-xs font-semibold text-foreground">Proxy Server (HTTP / HTTPS / SOCKS5)</h3>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                Proxy URL (e.g. socks5://127.0.0.1:1080 or http://user:pass@proxy.com:8080)
              </label>
              <Input
                placeholder="Direct Connection (No Proxy)"
                value={proxyUrl}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setProxyUrl(e.target.value)}
                className="text-xs font-mono"
              />
            </div>
          </div>
        </div>
      )}

      {activeTab === 'rules' && <RulesPage />}
      {activeTab === 'queue' && <QueuePage />}
    </div>
  );
};
