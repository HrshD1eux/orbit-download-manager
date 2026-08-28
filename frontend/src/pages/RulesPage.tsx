import React, { useState } from 'react';
import {
  Sparkles,
  Plus,
  Trash2,
  ArrowRight,
} from 'lucide-react';
import { useDownloadStore } from '../store/useDownloadStore';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { Badge } from '../components/ui/Badge';
import type { ActionType, ConditionField, ConditionOperator, Rule } from '../types';

export const RulesPage: React.FC = () => {
  const { rules, saveRule, deleteRule, toggleRule } = useDownloadStore();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Form State
  const [ruleName, setRuleName] = useState('');
  const [condField, setCondField] = useState<ConditionField>('extension');
  const [condOperator, setCondOperator] = useState<ConditionOperator>('in_list');
  const [condValue, setCondValue] = useState('');
  const [actionType, setActionType] = useState<ActionType>('set_category');
  const [actionValue, setActionValue] = useState('Programming');

  const presets: Array<{ name: string; desc: string; rule: Omit<Rule, 'id' | 'created_at'> }> = [
    {
      name: 'GitHub Archives to Code',
      desc: 'Automatically route zip and tar.gz files from GitHub into the Programming category with High priority.',
      rule: {
        name: 'GitHub Archives to Code',
        enabled: true,
        priority_order: 1,
        conditions: [
          { field: 'domain', operator: 'contains', value: 'github.com' },
          { field: 'extension', operator: 'in_list', value: 'zip,tar.gz' },
        ],
        actions: [
          { action_type: 'set_category', value: 'Programming' },
          { action_type: 'set_priority', value: 'high' },
        ],
      },
    },
    {
      name: 'Large File Turbo Boost',
      desc: 'Allocate 24 parallel threads and set Urgent priority for files over 2 GB.',
      rule: {
        name: 'Large File Turbo Boost',
        enabled: true,
        priority_order: 2,
        conditions: [
          { field: 'file_size', operator: 'greater_than', value: (2 * 1024 * 1024 * 1024).toString() },
        ],
        actions: [
          { action_type: 'set_connections', value: '24' },
          { action_type: 'set_priority', value: 'urgent' },
        ],
      },
    },
    {
      name: 'Media Auto-Organizer',
      desc: 'Identify video extensions (mp4, mkv, webm) and classify them under Videos.',
      rule: {
        name: 'Media Auto-Organizer',
        enabled: true,
        priority_order: 3,
        conditions: [
          { field: 'extension', operator: 'in_list', value: 'mp4,mkv,webm,mov,avi' },
        ],
        actions: [
          { action_type: 'set_category', value: 'Videos' },
        ],
      },
    },
  ];

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleName.trim() || !condValue.trim()) return;

    const newRule: Rule = {
      id: Math.random().toString(36).substring(7),
      name: ruleName.trim(),
      enabled: true,
      priority_order: rules.length + 1,
      conditions: [
        {
          field: condField,
          operator: condOperator,
          value: condValue.trim(),
        },
      ],
      actions: [
        {
          action_type: actionType,
          value: actionValue.trim(),
        },
      ],
      created_at: Date.now(),
    };

    await saveRule(newRule);
    setIsCreateModalOpen(false);
    setRuleName('');
    setCondValue('');
  };

  const handleApplyPreset = async (preset: (typeof presets)[0]) => {
    const newRule: Rule = {
      ...preset.rule,
      id: Math.random().toString(36).substring(7),
      created_at: Date.now(),
    };
    await saveRule(newRule);
  };

  return (
    <div className="flex-1 p-5 overflow-y-auto space-y-5 bg-background select-none">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold text-foreground tracking-tight flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <span>Automations & Rules</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure no-code download automation policies based on URLs, file types, and sizes.
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={() => setIsCreateModalOpen(true)}
          className="text-xs font-semibold"
        >
          <Plus className="w-3.5 h-3.5 mr-1" />
          Create Rule
        </Button>
      </div>

      {/* Preset Quick Starters */}
      {rules.length === 0 && (
        <div className="space-y-2.5">
          <span className="text-xs font-semibold text-foreground">Recommended Automation Presets</span>
          <div className="grid grid-cols-3 gap-3">
            {presets.map((preset, idx) => (
              <div
                key={idx}
                className="p-3.5 bg-surface border border-border rounded-md shadow-2xs space-y-2 flex flex-col justify-between"
              >
                <div>
                  <div className="font-semibold text-xs text-foreground">{preset.name}</div>
                  <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{preset.desc}</p>
                </div>
                <Button
                  variant="secondary"
                  size="xs"
                  onClick={() => handleApplyPreset(preset)}
                  className="mt-2 w-full text-xs font-medium text-primary"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Enable Preset
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active Rules List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-foreground">Active Automation Rules ({rules.length})</span>
        </div>

        {rules.length === 0 ? (
          <div className="p-8 bg-surface border border-border rounded-md text-center text-xs text-muted-foreground">
            No custom rules configured yet. Enable a preset above or click <strong>Create Rule</strong>.
          </div>
        ) : (
          <div className="space-y-2.5">
            {rules.map((rule) => (
              <div
                key={rule.id}
                className={`p-3.5 bg-surface border rounded-md shadow-2xs flex items-center justify-between transition-colors ${
                  rule.enabled ? 'border-border' : 'border-border/60 opacity-60'
                }`}
              >
                <div className="space-y-1.5 flex-1 pr-4">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs text-foreground">{rule.name}</span>
                    <Badge variant={rule.enabled ? 'success' : 'outline'}>
                      {rule.enabled ? 'Active' : 'Disabled'}
                    </Badge>
                  </div>

                  {/* Conditions & Actions Badge Strip */}
                  <div className="flex items-center gap-2 flex-wrap text-[11px] font-mono">
                    <span className="text-muted-foreground">IF:</span>
                    {rule.conditions.map((c, i) => (
                      <span
                        key={i}
                        className="px-1.5 py-0.5 rounded bg-surface-subtle border border-border text-foreground"
                      >
                        {c.field} {c.operator.replace('_', ' ')} &ldquo;{c.value}&rdquo;
                      </span>
                    ))}

                    <ArrowRight className="w-3 h-3 text-muted-foreground" />

                    <span className="text-muted-foreground">THEN:</span>
                    {rule.actions.map((a, i) => (
                      <span
                        key={i}
                        className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200"
                      >
                        {a.action_type.replace('_', ' ')} = {a.value}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Controls */}
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="subtle"
                    size="xs"
                    onClick={() => toggleRule(rule.id)}
                    className="text-xs"
                  >
                    {rule.enabled ? 'Disable' : 'Enable'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => deleteRule(rule.id)}
                    className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Rule Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create Automation Rule"
        description="Define an automated trigger and action to execute when a new download is added."
        maxWidth="max-w-xl"
      >
        <form onSubmit={handleCreateRule} className="space-y-4 text-xs">
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">Rule Name</label>
            <Input
              value={ruleName}
              onChange={(e) => setRuleName(e.target.value)}
              placeholder="e.g. Route Zip Files to Archives"
              required
              className="text-xs"
            />
          </div>

          {/* Trigger Condition Block */}
          <div className="p-3 bg-surface-subtle border border-border rounded-md space-y-2">
            <span className="text-[11px] font-semibold text-foreground uppercase tracking-wider block">
              IF (Trigger Condition)
            </span>
            <div className="grid grid-cols-3 gap-2">
              <select
                value={condField}
                onChange={(e) => setCondField(e.target.value as ConditionField)}
                className="h-8 rounded border border-border bg-surface px-2 text-xs text-foreground"
              >
                <option value="extension">File Extension</option>
                <option value="domain">Domain / Host</option>
                <option value="url">Full URL</option>
                <option value="category">Category</option>
              </select>

              <select
                value={condOperator}
                onChange={(e) => setCondOperator(e.target.value as ConditionOperator)}
                className="h-8 rounded border border-border bg-surface px-2 text-xs text-foreground"
              >
                <option value="in_list">Is in list (comma separated)</option>
                <option value="equals">Equals</option>
                <option value="contains">Contains</option>
                <option value="starts_with">Starts with</option>
              </select>

              <Input
                value={condValue}
                onChange={(e) => setCondValue(e.target.value)}
                placeholder="e.g. zip, tar.gz"
                required
                className="text-xs"
              />
            </div>
          </div>

          {/* Action Block */}
          <div className="p-3 bg-surface-subtle border border-border rounded-md space-y-2">
            <span className="text-[11px] font-semibold text-foreground uppercase tracking-wider block">
              THEN (Execute Action)
            </span>
            <div className="grid grid-cols-2 gap-2">
              <select
                value={actionType}
                onChange={(e) => setActionType(e.target.value as ActionType)}
                className="h-8 rounded border border-border bg-surface px-2 text-xs text-foreground"
              >
                <option value="set_category">Set Category</option>
                <option value="set_priority">Set Priority (low, normal, high, urgent)</option>
                <option value="set_connections">Set Parallel Threads (1-32)</option>
                <option value="set_save_path">Set Save Directory</option>
              </select>

              <Input
                value={actionValue}
                onChange={(e) => setActionValue(e.target.value)}
                placeholder="Action value"
                required
                className="text-xs"
              />
            </div>
          </div>

          {/* Submit */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={() => setIsCreateModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="md" className="font-semibold">
              Save Rule
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
