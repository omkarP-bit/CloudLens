import { useState, useMemo } from 'react';
import {
  Server, Database, Container, Code, Play, Square, RotateCcw, Trash2, Plus,
  Loader, Activity, Calendar, Clock, Bell, Power, PowerOff,
  AlertTriangle, CheckCircle, XCircle, Info,
} from 'lucide-react';
import { useAccountStore } from '../../store/accountStore.js';
import { useServices, type Resource, type ResourceType } from '../../hooks/useServices.js';
import { useControls } from '../../hooks/useControls.js';
import { useScheduledActions } from '../../hooks/useScheduledActions.js';
import { useAuditLogs } from '../../hooks/useAuditLogs.js';

const TYPE_ICONS: Record<string, typeof Server> = {
  EC2: Server, RDS: Database, ECS: Container, Lambda: Code,
};

const TYPE_COLORS: Record<string, string> = {
  EC2: 'text-orange-400', RDS: 'text-blue-400', ECS: 'text-emerald-400', Lambda: 'text-purple-400',
};

const ACTION_BADGES: Record<string, { label: string; icon: typeof Play; color: string }> = {
  START: { label: 'Start', icon: Play, color: 'text-success border-success/20 bg-success/10' },
  STOP: { label: 'Stop', icon: Square, color: 'text-warning border-warning/20 bg-warning/10' },
  REBOOT: { label: 'Reboot', icon: RotateCcw, color: 'text-blue-400 border-blue-400/20 bg-blue-400/10' },
  TERMINATE: { label: 'Terminate', icon: Trash2, color: 'text-destructive border-destructive/20 bg-destructive/10' },
};

function formatTime(ts: string | null): string {
  if (!ts) return '-';
  return new Date(ts).toLocaleString();
}

function ActionButton({ action, onClick, disabled, busy }: {
  action: string; onClick: () => void; disabled: boolean; busy: boolean;
}) {
  const meta = ACTION_BADGES[action];
  if (!meta) return null;
  const Icon = meta.icon;
  return (
    <button
      onClick={onClick}
      disabled={disabled || busy}
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-semibold border transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${meta.color} hover:brightness-110`}
    >
      {busy ? <Loader className="h-3 w-3 animate-spin" /> : <Icon className="h-3 w-3" />}
      <span>{meta.label}</span>
    </button>
  );
}

function formatCronDesc(cron: string): string {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return cron;
  const [, , , , dow] = parts;
  if (cron === '0 20 * * 1-5') return 'Weekdays 8PM';
  if (cron === '0 8 * * 1-5') return 'Weekdays 8AM';
  if (cron === '0 0 * * *') return 'Midnight daily';
  if (cron === '0 */6 * * *') return 'Every 6 hours';
  if (dow === '0' || dow === '7') return 'Sundays';
  return cron;
}

function ResourceActionPanel() {
  const { activeAccountId } = useAccountStore();
  const [filterType, setFilterType] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const { data, isLoading } = useServices({ accountId: activeAccountId, type: filterType as ResourceType | undefined });
  const { executeAction, isExecuting } = useControls();

  const resources = useMemo(() => data?.resources || [], [data]);

  const filteredResources = useMemo(() => {
    if (!filterType) return resources;
    return resources.filter((r) => r.type === filterType);
  }, [resources, filterType]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAction = async (resource: Resource, action: 'STOP' | 'START' | 'TERMINATE' | 'REBOOT') => {
    if (!activeAccountId) return;
    try {
      await executeAction({ resourceType: resource.type, resourceId: resource.id, action, accountId: activeAccountId, region: resource.region });
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleBulkAction = async (action: 'STOP' | 'START' | 'TERMINATE' | 'REBOOT') => {
    if (!activeAccountId) return;
    const selected = filteredResources.filter((r) => selectedIds.has(r.id));
    for (const resource of selected) {
      try {
        await executeAction({ resourceType: resource.type, resourceId: resource.id, action, accountId: activeAccountId, region: resource.region });
      } catch (err: any) {
        console.error(err);
      }
    }
    setSelectedIds(new Set());
  };

  return (
    <div className="glass-panel rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-bold text-white">Execute Actions</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-zinc-500">{selectedIds.size} selected</span>
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-1.5">
              {Object.values(ACTION_BADGES).filter((a) => a.label !== 'Terminate').map((meta) => {
                const Icon = meta.icon;
                return (
                  <button
                    key={meta.label}
                    onClick={() => handleBulkAction(meta.label.toUpperCase() as any)}
                    disabled={isExecuting}
                    className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold border transition-colors cursor-pointer disabled:opacity-40 ${meta.color} hover:brightness-110`}
                  >
                    {isExecuting ? <Loader className="h-3 w-3 animate-spin" /> : <Icon className="h-3 w-3" />}
                    <span>Bulk {meta.label}</span>
                  </button>
                );
              })}
              <button
                onClick={() => setSelectedIds(new Set())}
                className="text-zinc-500 hover:text-white text-[10px] px-2 cursor-pointer"
              >
                Clear
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <select
          value={filterType}
          onChange={(e) => { setFilterType(e.target.value); setSelectedIds(new Set()); }}
          className="bg-zinc-950 border border-border text-white text-xs rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="">All Resources</option>
          <option value="EC2">EC2</option>
          <option value="RDS">RDS</option>
          <option value="ECS">ECS</option>
          <option value="Lambda">Lambda</option>
        </select>
        <span className="text-xs text-zinc-500">{filteredResources.length} resources</span>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader className="h-6 w-6 text-primary animate-spin" />
        </div>
      ) : filteredResources.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center gap-2">
          <Activity className="h-6 w-6 text-zinc-600" />
          <p className="text-xs text-zinc-500">No resources available</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-zinc-500">
                <th className="w-8 p-2 pl-0">
                  <input
                    type="checkbox"
                    checked={filteredResources.length > 0 && selectedIds.size === filteredResources.length}
                    onChange={() => {
                      if (selectedIds.size === filteredResources.length) setSelectedIds(new Set());
                      else setSelectedIds(new Set(filteredResources.map((r) => r.id)));
                    }}
                    className="cursor-pointer"
                  />
                </th>
                <th className="text-left font-semibold p-2">Type</th>
                <th className="text-left font-semibold p-2">Name</th>
                <th className="text-left font-semibold p-2">Region</th>
                <th className="text-left font-semibold p-2">State</th>
                <th className="text-right font-semibold p-2 pr-0">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredResources.map((r) => {
                const Icon = TYPE_ICONS[r.type] || Server;
                const isSelected = selectedIds.has(r.id);
                return (
                  <tr key={`${r.type}-${r.id}`} className="border-b border-border/50 last:border-0 hover:bg-white/[0.02]">
                    <td className="p-2 pl-0">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(r.id)}
                        className="cursor-pointer"
                      />
                    </td>
                    <td className="p-2">
                      <div className="flex items-center gap-2">
                        <Icon className={`h-3.5 w-3.5 ${TYPE_COLORS[r.type] || 'text-zinc-400'}`} />
                        <span className="text-zinc-400 font-medium">{r.type}</span>
                      </div>
                    </td>
                    <td className="p-2 text-white font-medium">{r.name}</td>
                    <td className="p-2 text-zinc-400">{r.region}</td>
                    <td className="p-2">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                        r.state === 'running' || r.state === 'available' || r.state === 'Active'
                          ? 'bg-success/10 border-success/20 text-success'
                          : r.state === 'stopped' || r.state === 'inactive'
                          ? 'bg-warning/10 border-warning/20 text-warning'
                          : 'bg-zinc-900 border-border text-zinc-400'
                      }`}>
                        {r.state}
                      </span>
                    </td>
                    <td className="p-2 pr-0">
                      <div className="flex items-center justify-end gap-1.5">
                        {(r.type === 'EC2' || r.type === 'RDS') && (
                          <ActionButton action="START" onClick={() => handleAction(r, 'START')} disabled={r.state === 'running'} busy={isExecuting} />
                        )}
                        {(r.type === 'EC2' || r.type === 'RDS') && (
                          <ActionButton action="STOP" onClick={() => handleAction(r, 'STOP')} disabled={r.state === 'stopped'} busy={isExecuting} />
                        )}
                        <ActionButton action="REBOOT" onClick={() => handleAction(r, 'REBOOT')} disabled={false} busy={isExecuting} />
                        {(r.type === 'EC2' || r.type === 'ECS') && (
                          <ActionButton action="TERMINATE" onClick={() => handleAction(r, 'TERMINATE')} disabled={false} busy={isExecuting} />
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ScheduledActionsPanel() {
  const { activeAccountId } = useAccountStore();
  const { actions, isLoading, create, isCreating, toggle, remove } = useScheduledActions();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [resourceType, setResourceType] = useState('EC2');
  const [resourceId, setResourceId] = useState('');
  const [action, setAction] = useState('STOP');
  const [cronExpression, setCronExpression] = useState('0 20 * * 1-5');
  const [timezone, setTimezone] = useState('UTC');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAccountId) return;
    try {
      await create({
        account_id: activeAccountId,
        name, resource_type: resourceType, resource_id: resourceId,
        action, cron_expression: cronExpression, timezone,
      });
      setName(''); setResourceId(''); setShowForm(false);
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-bold text-white">Scheduled Actions</h2>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-zinc-500">{actions.length} schedules</span>
          <button
            onClick={() => setShowForm(true)}
            disabled={!activeAccountId}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-lg text-[10px] font-semibold hover:bg-accent transition-colors disabled:opacity-50 cursor-pointer"
          >
            <Plus className="h-3 w-3" />
            <span>New Schedule</span>
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-10">
          <Loader className="h-5 w-5 text-primary animate-spin" />
        </div>
      ) : actions.length === 0 ? (
        <div className="glass-panel rounded-xl p-8 flex flex-col items-center justify-center text-center gap-2">
          <Calendar className="h-6 w-6 text-zinc-600" />
          <p className="text-xs text-zinc-500">No scheduled actions. Create one to automate resource lifecycle.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {actions.map((s) => {
            const Icon = TYPE_ICONS[s.resource_type] || Server;
            return (
              <div key={s.id} className="glass-panel rounded-xl p-4 flex items-start justify-between hover:border-zinc-750 transition-all">
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${s.enabled ? 'bg-primary/10' : 'bg-zinc-900'}`}>
                    <Icon className={`h-4 w-4 ${TYPE_COLORS[s.resource_type] || 'text-zinc-400'}`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-xs font-bold text-white">{s.name}</h3>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold border ${ACTION_BADGES[s.action]?.color || ''}`}>
                        {s.action}
                      </span>
                    </div>
                    <p className="text-[10px] text-zinc-500 mb-0.5">
                      {s.resource_type} {s.resource_id}
                    </p>
                    <div className="flex items-center gap-3 text-[10px] text-zinc-500">
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatCronDesc(s.cron_expression)}</span>
                      <span className="flex items-center gap-1"><Bell className="h-3 w-3" />{s.timezone}</span>
                    </div>
                    {s.last_run_at && (
                      <p className="text-[10px] text-zinc-500 mt-1">
                        Last run: {formatTime(s.last_run_at)} ({s.last_run_status || 'unknown'})
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => toggle(s.id)}
                    title={s.enabled ? 'Disable' : 'Enable'}
                    className={`p-1.5 rounded-lg transition-colors cursor-pointer ${s.enabled ? 'text-success hover:bg-success/10' : 'text-zinc-500 hover:bg-zinc-900'}`}
                  >
                    {s.enabled ? <Power className="h-3.5 w-3.5" /> : <PowerOff className="h-3.5 w-3.5" />}
                  </button>
                  <button
                    onClick={() => { if (confirm('Delete this scheduled action?')) remove(s.id); }}
                    className="p-1.5 rounded-lg text-zinc-500 hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#121215] border border-border rounded-xl p-6 animate-fade-in">
            <h2 className="text-lg font-bold text-white mb-4">New Scheduled Action</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-zinc-400 text-xs font-semibold mb-1">Name</label>
                <input required value={name} onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Stop dev instances at night"
                  className="w-full px-3 py-2 bg-zinc-950 border border-border text-white text-xs rounded-lg outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-zinc-400 text-xs font-semibold mb-1">Resource Type</label>
                  <select value={resourceType} onChange={(e) => setResourceType(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-950 border border-border text-white text-xs rounded-lg outline-none"
                  >
                    <option value="EC2">EC2</option>
                    <option value="RDS">RDS</option>
                    <option value="ECS">ECS</option>
                    <option value="Lambda">Lambda</option>
                  </select>
                </div>
                <div>
                  <label className="block text-zinc-400 text-xs font-semibold mb-1">Action</label>
                  <select value={action} onChange={(e) => setAction(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-950 border border-border text-white text-xs rounded-lg outline-none"
                  >
                    <option value="STOP">Stop</option>
                    <option value="START">Start</option>
                    <option value="REBOOT">Reboot</option>
                    <option value="TERMINATE">Terminate</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-zinc-400 text-xs font-semibold mb-1">Resource ID</label>
                <input required value={resourceId} onChange={(e) => setResourceId(e.target.value)}
                  placeholder="i-123abc (or cluster/service for ECS)"
                  className="w-full px-3 py-2 bg-zinc-950 border border-border text-white text-xs rounded-lg outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-zinc-400 text-xs font-semibold mb-1">Cron Expression</label>
                  <input required value={cronExpression} onChange={(e) => setCronExpression(e.target.value)}
                    placeholder="0 20 * * 1-5"
                    className="w-full px-3 py-2 bg-zinc-950 border border-border text-white text-xs rounded-lg outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-zinc-400 text-xs font-semibold mb-1">Timezone</label>
                  <select value={timezone} onChange={(e) => setTimezone(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-950 border border-border text-white text-xs rounded-lg outline-none"
                  >
                    <option value="UTC">UTC</option>
                    <option value="US/Eastern">US/Eastern</option>
                    <option value="US/Pacific">US/Pacific</option>
                    <option value="Europe/London">Europe/London</option>
                  </select>
                </div>
              </div>
              <p className="text-[10px] text-zinc-500">
                Need help with cron? Try <code className="text-primary">0 20 * * 1-5</code> (weekdays 8PM) or <code className="text-primary">0 8 * * 1-5</code> (weekdays 8AM).
              </p>
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
                <button type="button" onClick={() => setShowForm(false)}
                  className="px-4 py-2 bg-zinc-900 border border-border text-zinc-400 hover:text-white rounded-lg text-xs font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button type="submit" disabled={isCreating || !activeAccountId}
                  className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg text-xs font-semibold hover:bg-accent transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {isCreating && <Loader className="h-3 w-3 animate-spin" />}
                  <span>Create Schedule</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function AuditTrailPanel() {
  const { activeAccountId } = useAccountStore();
  const { logs, isLoading } = useAuditLogs(activeAccountId);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Info className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-bold text-white">Audit Trail</h2>
        <span className="text-[10px] text-zinc-500 ml-auto">Live updates via Realtime</span>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-10">
          <Loader className="h-5 w-5 text-primary animate-spin" />
        </div>
      ) : logs.length === 0 ? (
        <div className="glass-panel rounded-xl p-8 flex flex-col items-center justify-center text-center gap-2">
          <Info className="h-6 w-6 text-zinc-600" />
          <p className="text-xs text-zinc-500">No audit records yet. Actions will appear here in real time.</p>
        </div>
      ) : (
        <div className="glass-panel rounded-xl overflow-hidden">
          <div className="overflow-x-auto max-h-96 overflow-y-auto scrollbar-thin">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-[#121215]">
                <tr className="border-b border-border text-zinc-500">
                  <th className="text-left font-semibold p-3 pl-4">Time</th>
                  <th className="text-left font-semibold p-3">Action</th>
                  <th className="text-left font-semibold p-3">Resource</th>
                  <th className="text-left font-semibold p-3">Region</th>
                  <th className="text-left font-semibold p-3">Policy</th>
                  <th className="text-left font-semibold p-3">Result</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const Icon = TYPE_ICONS[log.resource_type] || Activity;
                  return (
                    <tr key={log.id} className="border-b border-border/50 last:border-0 hover:bg-white/[0.02]">
                      <td className="p-3 pl-4 text-zinc-400 whitespace-nowrap">{formatTime(log.created_at)}</td>
                      <td className="p-3">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                          ACTION_BADGES[log.action.split(':')[1]]?.color || 'bg-zinc-900 border-border text-zinc-400'
                        }`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <Icon className={`h-3 w-3 ${TYPE_COLORS[log.resource_type] || 'text-zinc-400'}`} />
                          <span className="text-white font-medium">{log.resource_id.substring(0, 20)}</span>
                        </div>
                      </td>
                      <td className="p-3 text-zinc-400">{log.region}</td>
                      <td className="p-3">
                        {log.policy_result === 'ALLOW' ? (
                          <span className="flex items-center gap-1 text-success"><CheckCircle className="h-3 w-3" />Allow</span>
                        ) : log.policy_result === 'DENY' ? (
                          <span className="flex items-center gap-1 text-destructive"><XCircle className="h-3 w-3" />Deny</span>
                        ) : (
                          <span className="flex items-center gap-1 text-warning"><AlertTriangle className="h-3 w-3" />Warn</span>
                        )}
                      </td>
                      <td className="p-3">
                        {log.metadata && typeof log.metadata === 'object' && 'success' in log.metadata ? (
                          (log.metadata as any).success ? (
                            <span className="flex items-center gap-1 text-success"><CheckCircle className="h-3 w-3" />Success</span>
                          ) : (
                            <span className="flex items-center gap-1 text-destructive"><XCircle className="h-3 w-3" />Failed</span>
                          )
                        ) : (
                          <span className="text-zinc-500">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export function Controls() {
  const { activeAccountId } = useAccountStore();

  if (!activeAccountId) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Resource Controls</h1>
            <p className="text-zinc-500 text-xs mt-1">Execute lifecycle actions on AWS resources with full audit logging.</p>
          </div>
        </div>
        <div className="glass-panel p-12 rounded-xl flex flex-col items-center justify-center text-center gap-3">
          <Activity className="h-8 w-8 text-zinc-600" />
          <h3 className="text-sm font-semibold text-white">No Account Selected</h3>
          <p className="text-zinc-500 text-xs">Select an AWS account to execute resource actions.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Resource Controls</h1>
          <p className="text-zinc-500 text-xs mt-1">Stop, start, terminate, or reboot AWS services on-demand or via automated schedules.</p>
        </div>
      </div>

      <ResourceActionPanel />
      <ScheduledActionsPanel />
      <AuditTrailPanel />
    </div>
  );
}
