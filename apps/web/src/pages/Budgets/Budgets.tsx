import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  DollarSign, Plus, Trash2, Loader, Pencil, Bell, Mail, Webhook,
} from 'lucide-react';
import { useAccountStore } from '../../store/accountStore.js';
import { supabase } from '../../lib/supabase.js';
import { apiRequest } from '../../lib/api.js';
import {
  useBudgets,
  useCreateBudget,
  useUpdateBudget,
  useDeleteBudget,
  type BudgetWithActuals,
} from '../../hooks/useBudgets.js';

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', minimumFractionDigits: 2,
  }).format(n);
}

function getProgressColor(pct: number): string {
  if (pct >= 100) return 'bg-destructive';
  if (pct >= 80) return 'bg-warning';
  if (pct >= 50) return 'bg-primary';
  return 'bg-success';
}

function getProgressBg(pct: number): string {
  if (pct >= 100) return 'bg-destructive/10';
  if (pct >= 80) return 'bg-warning/10';
  if (pct >= 50) return 'bg-primary/10';
  return 'bg-success/10';
}

interface NotificationLogEntry {
  id: string;
  budget_id: string;
  channel: string;
  recipient: string | null;
  status: string;
  error_msg: string | null;
  sent_at: string;
}

interface BudgetCardProps {
  budget: BudgetWithActuals;
  onDelete: (id: string) => void;
  onEdit: (budget: BudgetWithActuals) => void;
  onTestEmail: (budget: BudgetWithActuals) => void;
  onTestAlert: (budget: BudgetWithActuals) => void;
  isDeleting: boolean;
  isTesting: boolean;
}

function BudgetCard({ budget, onDelete, onEdit, onTestEmail, onTestAlert, isDeleting, isTesting }: BudgetCardProps) {
  const [showTestMenu, setShowTestMenu] = useState(false);

  return (
    <div className="glass-panel rounded-xl p-6 relative flex flex-col justify-between hover:border-zinc-750 transition-all duration-200">
      <div>
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-bold text-white">{budget.name}</h3>
          </div>
          <div className="flex items-center gap-1">
            <div className="relative">
              <button
                onClick={() => setShowTestMenu(!showTestMenu)}
                disabled={isTesting}
                className="text-zinc-500 hover:text-warning transition-colors cursor-pointer disabled:opacity-50 p-1"
                title="Test alerts"
              >
                <Bell className="h-3.5 w-3.5" />
              </button>
              {showTestMenu && (
                <div className="absolute right-0 top-full mt-1 w-44 bg-zinc-900 border border-border rounded-lg shadow-xl z-10 py-1">
                  <button
                    onClick={() => { onTestEmail(budget); setShowTestMenu(false); }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800 cursor-pointer"
                  >
                    <Mail className="h-3 w-3" />
                    Send test email
                  </button>
                  <button
                    onClick={() => { onTestAlert(budget); setShowTestMenu(false); }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800 cursor-pointer"
                  >
                    <Webhook className="h-3 w-3" />
                    Simulate alert (92%)
                  </button>
                </div>
              )}
            </div>
            <button
              onClick={() => onEdit(budget)}
              className="text-zinc-500 hover:text-primary transition-colors cursor-pointer p-1"
              title="Edit alerts"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => onDelete(budget.id)}
              disabled={isDeleting}
              className="text-zinc-500 hover:text-destructive transition-colors cursor-pointer disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="space-y-2 text-xs mb-4">
          <div className="flex items-center justify-between text-zinc-500">
            <span>Period</span>
            <span className="text-zinc-300 font-medium capitalize">{budget.period.toLowerCase()}</span>
          </div>
          <div className="flex items-center justify-between text-zinc-500">
            <span>Scope</span>
            <span className="text-zinc-300 font-medium">{budget.scope_type}{budget.scope_value ? `: ${budget.scope_value}` : ''}</span>
          </div>
          <div className="flex items-center justify-between text-zinc-500">
            <span>Limit</span>
            <span className="text-zinc-300 font-medium">{formatCurrency(budget.limit_amount)}</span>
          </div>
          <div className="flex items-center justify-between text-zinc-500">
            <span>Spent</span>
            <span className={`font-bold ${
              budget.percentUsed >= 100 ? 'text-destructive' : budget.percentUsed >= 80 ? 'text-warning' : 'text-zinc-300'
            }`}>
              {formatCurrency(budget.currentActual)}
            </span>
          </div>
        </div>

        <div className={`rounded-lg p-3 ${getProgressBg(budget.percentUsed)}`}>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] text-zinc-500 font-semibold">{budget.percentUsed}% used</span>
            {budget.forecastedActual != null && (
              <span className="text-[10px] text-zinc-500">Forecast: {formatCurrency(budget.forecastedActual)}</span>
            )}
          </div>
          <div className="w-full h-2 bg-zinc-900 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${getProgressColor(budget.percentUsed)}`}
              style={{ width: `${Math.min(budget.percentUsed, 100)}%` }}
            />
          </div>
          {budget.alert_thresholds.length > 0 && (
            <div className="relative h-1 mt-1">
              {budget.alert_thresholds.map((t) => (
                <div
                  key={t}
                  className="absolute top-0 w-0.5 h-1.5 bg-zinc-600"
                  style={{ left: `${Math.min(t, 100)}%` }}
                  title={`${t}% alert threshold`}
                />
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5 mt-3">
          {budget.alert_channels?.email && (
            <span className="text-[10px] text-zinc-500 bg-zinc-900 px-2 py-0.5 rounded">Email</span>
          )}
          {budget.alert_channels?.slack && (
            <span className="text-[10px] text-zinc-500 bg-zinc-900 px-2 py-0.5 rounded">Slack</span>
          )}
          {budget.alert_channels?.webhook && (
            <span className="text-[10px] text-zinc-500 bg-zinc-900 px-2 py-0.5 rounded">Webhook</span>
          )}
          {budget.alert_thresholds.map((t) => (
            <span key={t} className="text-[10px] text-zinc-500 bg-zinc-900 px-1.5 py-0.5 rounded">
              {t}%
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

interface AlertChannelsState {
  email: boolean;
  slackEnabled: boolean;
  slackUrl: string;
  webhookEnabled: boolean;
  webhookUrl: string;
}

export function Budgets() {
  const queryClient = useQueryClient();
  const { activeAccountId } = useAccountStore();
  const { data: budgets, isLoading } = useBudgets(activeAccountId);
  const createBudget = useCreateBudget();
  const updateBudget = useUpdateBudget();
  const deleteBudget = useDeleteBudget();

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [scopeType, setScopeType] = useState('account');
  const [scopeValue, setScopeValue] = useState('');
  const [period, setPeriod] = useState('MONTHLY');
  const [limitAmount, setLimitAmount] = useState('');
  const [alertThresholds, setAlertThresholds] = useState('50, 80, 100');
  const [alertChannels, setAlertChannels] = useState<AlertChannelsState>({
    email: true,
    slackEnabled: false,
    slackUrl: '',
    webhookEnabled: false,
    webhookUrl: '',
  });

  const [editingBudget, setEditingBudget] = useState<BudgetWithActuals | null>(null);
  const [editThresholds, setEditThresholds] = useState('');
  const [editChannels, setEditChannels] = useState<AlertChannelsState>({
    email: false,
    slackEnabled: false,
    slackUrl: '',
    webhookEnabled: false,
    webhookUrl: '',
  });

  const [isTesting, setIsTesting] = useState(false);
  const [testMessage, setTestMessage] = useState<string | null>(null);
  const [notificationLog, setNotificationLog] = useState<NotificationLogEntry[]>([]);
  const [showLog, setShowLog] = useState(false);
  const [loadingLog, setLoadingLog] = useState(false);

  useEffect(() => {
    if (!activeAccountId) return;

    const channel = supabase
      .channel('budget-updates')
      .on(
        'postgres_changes' as any,
        { event: '*', schema: 'public', table: 'budget_actuals', filter: undefined },
        () => {
          queryClient.invalidateQueries({ queryKey: ['budgets', activeAccountId] });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [activeAccountId, queryClient]);

  const fetchLog = async () => {
    setLoadingLog(true);
    try {
      const data = await apiRequest<NotificationLogEntry[]>('/api/notifications/log');
      setNotificationLog(data || []);
      setShowLog(true);
    } catch {
      setNotificationLog([]);
      setShowLog(true);
    } finally {
      setLoadingLog(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAccountId) return;

    try {
      const channels: Record<string, any> = { email: alertChannels.email };
      if (alertChannels.slackEnabled) channels.slack = alertChannels.slackUrl || true;
      if (alertChannels.webhookEnabled) channels.webhook = alertChannels.webhookUrl || null;

      await createBudget.mutateAsync({
        accountId: activeAccountId,
        name,
        scopeType,
        scopeValue: scopeValue || undefined,
        period,
        limitAmount: parseFloat(limitAmount),
        alertThresholds: alertThresholds.split(',').map((s) => parseFloat(s.trim())).filter((n) => !isNaN(n)),
        alertChannels: channels,
      });
      setName('');
      setScopeValue('');
      setLimitAmount('');
      setAlertThresholds('50, 80, 100');
      setAlertChannels({ email: true, slackEnabled: false, slackUrl: '', webhookEnabled: false, webhookUrl: '' });
      setShowForm(false);
    } catch (err: any) {
      alert(err.message || 'Failed to create budget');
    }
  };

  const openEdit = (budget: BudgetWithActuals) => {
    setEditingBudget(budget);
    setEditThresholds((budget.alert_thresholds || []).join(', '));
    const slackVal = budget.alert_channels?.slack;
    setEditChannels({
      email: budget.alert_channels?.email || false,
      slackEnabled: !!slackVal,
      slackUrl: typeof slackVal === 'string' ? slackVal : '',
      webhookEnabled: !!budget.alert_channels?.webhook,
      webhookUrl: typeof budget.alert_channels?.webhook === 'string' ? budget.alert_channels.webhook : '',
    });
  };

  const handleEditSave = async () => {
    if (!editingBudget) return;

    try {
      const channels: Record<string, any> = { email: editChannels.email };
      if (editChannels.slackEnabled) channels.slack = editChannels.slackUrl || true;
      if (editChannels.webhookEnabled) channels.webhook = editChannels.webhookUrl || null;

      await updateBudget.mutateAsync({
        id: editingBudget.id,
        data: {
          alertThresholds: editThresholds.split(',').map((s) => parseFloat(s.trim())).filter((n) => !isNaN(n)),
          alertChannels: channels,
        },
      });
      setEditingBudget(null);
    } catch (err: any) {
      alert(err.message || 'Failed to update budget');
    }
  };

  const handleTestEmail = async (budget: BudgetWithActuals) => {
    setIsTesting(true);
    setTestMessage(null);
    try {
      await apiRequest('/api/notifications/test-email', { method: 'POST' });
      setTestMessage(`Test email sent for "${budget.name}"`);
    } catch (err: any) {
      setTestMessage(`Email test failed: ${err.message}`);
    } finally {
      setIsTesting(false);
      setTimeout(() => setTestMessage(null), 5000);
    }
  };

  const handleTestAlert = async (budget: BudgetWithActuals) => {
    setIsTesting(true);
    setTestMessage(null);
    try {
      const res = await apiRequest<{ message: string }>(`/api/budgets/${budget.id}/test-alert`, { method: 'POST' });
      setTestMessage(res.message || `Test alert dispatched for "${budget.name}"`);
    } catch (err: any) {
      setTestMessage(`Test alert failed: ${err.message}`);
    } finally {
      setIsTesting(false);
      setTimeout(() => setTestMessage(null), 5000);
    }
  };

  if (!activeAccountId) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Budgets & Alerting</h1>
            <p className="text-zinc-500 text-xs mt-1">Create, monitor, and configure notifications for AWS account and service expenditure thresholds.</p>
          </div>
        </div>
        <div className="glass-panel p-12 rounded-xl flex flex-col items-center justify-center text-center gap-3">
          <DollarSign className="h-8 w-8 text-zinc-600" />
          <h3 className="text-sm font-semibold text-white">No Account Selected</h3>
          <p className="text-zinc-500 text-xs">Select an AWS account to view and manage budgets.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Budgets & Alerting</h1>
          <p className="text-zinc-500 text-xs mt-1">Create, monitor, and configure notifications for AWS account and service expenditure thresholds.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchLog}
            className="flex items-center gap-2 px-3 py-2 bg-zinc-900 border border-border text-zinc-400 hover:text-white rounded-lg text-xs font-medium transition-colors cursor-pointer"
          >
            <Bell className="h-3.5 w-3.5" />
            <span>Notification Log</span>
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-xs font-semibold hover:bg-accent transition-colors cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Create Budget</span>
          </button>
        </div>
      </div>

      {testMessage && (
        <div className="px-4 py-3 bg-zinc-900 border border-border rounded-lg text-xs text-zinc-300 animate-fade-in">
          {testMessage}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader className="h-8 w-8 text-primary animate-spin" />
        </div>
      ) : !budgets || budgets.length === 0 ? (
        <div className="glass-panel p-12 rounded-xl flex flex-col items-center justify-center text-center gap-3">
          <DollarSign className="h-8 w-8 text-zinc-600" />
          <h3 className="text-sm font-semibold text-white">No Budgets</h3>
          <p className="text-zinc-500 text-xs max-w-sm">Create your first budget to track AWS spending and receive alerts before you exceed your limit.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {budgets.map((b) => (
            <BudgetCard
              key={b.id}
              budget={b}
              onDelete={(id) => deleteBudget.mutate(id)}
              onEdit={openEdit}
              onTestEmail={handleTestEmail}
              onTestAlert={handleTestAlert}
              isDeleting={deleteBudget.isPending}
              isTesting={isTesting}
            />
          ))}
        </div>
      )}

      {showLog && (
        <div className="glass-panel rounded-xl p-6 animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-white">Notification Log</h3>
            <button
              onClick={() => setShowLog(false)}
              className="text-zinc-500 hover:text-white text-xs cursor-pointer"
            >
              Close
            </button>
          </div>
          {loadingLog ? (
            <div className="flex items-center justify-center py-8">
              <Loader className="h-5 w-5 text-primary animate-spin" />
            </div>
          ) : notificationLog.length === 0 ? (
            <p className="text-zinc-500 text-xs py-4 text-center">No notifications sent yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-zinc-500 border-b border-border">
                    <th className="text-left py-2 pr-4">Time</th>
                    <th className="text-left py-2 pr-4">Channel</th>
                    <th className="text-left py-2 pr-4">Recipient</th>
                    <th className="text-left py-2 pr-4">Status</th>
                    <th className="text-left py-2">Error</th>
                  </tr>
                </thead>
                <tbody>
                  {notificationLog.map((entry) => (
                    <tr key={entry.id} className="border-b border-border/50 text-zinc-300">
                      <td className="py-2 pr-4 whitespace-nowrap">
                        {new Date(entry.sent_at).toLocaleString()}
                      </td>
                      <td className="py-2 pr-4 capitalize">{entry.channel}</td>
                      <td className="py-2 pr-4 truncate max-w-[200px]">{entry.recipient || '-'}</td>
                      <td className="py-2 pr-4">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          entry.status === 'sent' ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
                        }`}>
                          {entry.status}
                        </span>
                      </td>
                      <td className="py-2 text-zinc-500 truncate max-w-[200px]">{entry.error_msg || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md max-h-[85vh] overflow-y-auto bg-[#121215] border border-border rounded-xl p-6 animate-fade-in">
            <h2 className="text-lg font-bold text-white mb-4">Create Budget</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-zinc-400 text-xs font-semibold mb-1">Budget Name</label>
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Monthly Infrastructure"
                  className="w-full px-3 py-2 bg-zinc-950 border border-border text-white text-xs rounded-lg outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-zinc-400 text-xs font-semibold mb-1">Scope</label>
                  <select
                    value={scopeType}
                    onChange={(e) => setScopeType(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-950 border border-border text-white text-xs rounded-lg outline-none"
                  >
                    <option value="account">Entire Account</option>
                    <option value="service">Service</option>
                    <option value="tag">Tag</option>
                    <option value="region">Region</option>
                  </select>
                </div>
                <div>
                  <label className="block text-zinc-400 text-xs font-semibold mb-1">Period</label>
                  <select
                    value={period}
                    onChange={(e) => setPeriod(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-950 border border-border text-white text-xs rounded-lg outline-none"
                  >
                    <option value="DAILY">Daily</option>
                    <option value="MONTHLY">Monthly</option>
                    <option value="QUARTERLY">Quarterly</option>
                    <option value="ANNUALLY">Annual</option>
                  </select>
                </div>
              </div>

              {scopeType !== 'account' && (
                <div>
                  <label className="block text-zinc-400 text-xs font-semibold mb-1">Scope Value</label>
                  <input
                    value={scopeValue}
                    onChange={(e) => setScopeValue(e.target.value)}
                    placeholder={scopeType === 'service' ? 'EC2' : scopeType === 'tag' ? 'team=backend' : 'us-east-1'}
                    className="w-full px-3 py-2 bg-zinc-950 border border-border text-white text-xs rounded-lg outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              )}

              <div>
                <label className="block text-zinc-400 text-xs font-semibold mb-1">Budget Limit (USD)</label>
                <input
                  required
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={limitAmount}
                  onChange={(e) => setLimitAmount(e.target.value)}
                  placeholder="5000.00"
                  className="w-full px-3 py-2 bg-zinc-950 border border-border text-white text-xs rounded-lg outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-zinc-400 text-xs font-semibold mb-1">Alert Thresholds (%)</label>
                <input
                  value={alertThresholds}
                  onChange={(e) => setAlertThresholds(e.target.value)}
                  placeholder="50, 80, 100"
                  className="w-full px-3 py-2 bg-zinc-950 border border-border text-white text-xs rounded-lg outline-none focus:ring-1 focus:ring-primary"
                />
                <p className="text-[10px] text-zinc-500 mt-1">Comma-separated percentages at which to trigger alerts</p>
              </div>

              <div>
                <label className="block text-zinc-400 text-xs font-semibold mb-2">Alert Channels</label>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={alertChannels.email}
                      onChange={(e) => setAlertChannels((p) => ({ ...p, email: e.target.checked }))}
                      className="accent-primary"
                    />
                    Email
                  </label>
                  <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={alertChannels.slackEnabled}
                      onChange={(e) => setAlertChannels((p) => ({ ...p, slackEnabled: e.target.checked }))}
                      className="accent-primary"
                    />
                    Slack webhook
                  </label>
                  <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={alertChannels.webhookEnabled}
                      onChange={(e) => setAlertChannels((p) => ({ ...p, webhookEnabled: e.target.checked }))}
                      className="accent-primary"
                    />
                    Custom webhook
                  </label>
                </div>
                {alertChannels.slackEnabled && (
                  <input
                    value={alertChannels.slackUrl}
                    onChange={(e) => setAlertChannels((p) => ({ ...p, slackUrl: e.target.value }))}
                    placeholder="https://hooks.slack.com/services/..."
                    className="w-full mt-2 px-3 py-2 bg-zinc-950 border border-border text-white text-xs rounded-lg outline-none focus:ring-1 focus:ring-primary"
                  />
                )}
                {alertChannels.webhookEnabled && (
                  <input
                    value={alertChannels.webhookUrl}
                    onChange={(e) => setAlertChannels((p) => ({ ...p, webhookUrl: e.target.value }))}
                    placeholder="https://your-webhook.com/endpoint"
                    className="w-full mt-2 px-3 py-2 bg-zinc-950 border border-border text-white text-xs rounded-lg outline-none focus:ring-1 focus:ring-primary"
                  />
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 bg-zinc-900 border border-border text-zinc-400 hover:text-white rounded-lg text-xs font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createBudget.isPending}
                  className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg text-xs font-semibold hover:bg-accent transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {createBudget.isPending && <Loader className="h-3 w-3 animate-spin" />}
                  <span>Create Budget</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingBudget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md max-h-[85vh] overflow-y-auto bg-[#121215] border border-border rounded-xl p-6 animate-fade-in">
            <h2 className="text-lg font-bold text-white mb-4">Edit Alert Configuration</h2>
            <p className="text-zinc-500 text-xs mb-4">{editingBudget.name}</p>
            <div className="space-y-4">
              <div>
                <label className="block text-zinc-400 text-xs font-semibold mb-1">Alert Thresholds (%)</label>
                <input
                  value={editThresholds}
                  onChange={(e) => setEditThresholds(e.target.value)}
                  placeholder="50, 80, 100"
                  className="w-full px-3 py-2 bg-zinc-950 border border-border text-white text-xs rounded-lg outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-zinc-400 text-xs font-semibold mb-2">Alert Channels</label>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editChannels.email}
                      onChange={(e) => setEditChannels((p) => ({ ...p, email: e.target.checked }))}
                      className="accent-primary"
                    />
                    Email
                  </label>
                  <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editChannels.slackEnabled}
                      onChange={(e) => setEditChannels((p) => ({ ...p, slackEnabled: e.target.checked }))}
                      className="accent-primary"
                    />
                    Slack webhook
                  </label>
                  <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editChannels.webhookEnabled}
                      onChange={(e) => setEditChannels((p) => ({ ...p, webhookEnabled: e.target.checked }))}
                      className="accent-primary"
                    />
                    Custom webhook
                  </label>
                </div>
                {editChannels.slackEnabled && (
                  <input
                    value={editChannels.slackUrl}
                    onChange={(e) => setEditChannels((p) => ({ ...p, slackUrl: e.target.value }))}
                    placeholder="https://hooks.slack.com/services/..."
                    className="w-full mt-2 px-3 py-2 bg-zinc-950 border border-border text-white text-xs rounded-lg outline-none focus:ring-1 focus:ring-primary"
                  />
                )}
                {editChannels.webhookEnabled && (
                  <input
                    value={editChannels.webhookUrl}
                    onChange={(e) => setEditChannels((p) => ({ ...p, webhookUrl: e.target.value }))}
                    placeholder="https://your-webhook.com/endpoint"
                    className="w-full mt-2 px-3 py-2 bg-zinc-950 border border-border text-white text-xs rounded-lg outline-none focus:ring-1 focus:ring-primary"
                  />
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setEditingBudget(null)}
                  className="px-4 py-2 bg-zinc-900 border border-border text-zinc-400 hover:text-white rounded-lg text-xs font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleEditSave}
                  disabled={updateBudget.isPending}
                  className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg text-xs font-semibold hover:bg-accent transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {updateBudget.isPending && <Loader className="h-3 w-3 animate-spin" />}
                  <span>Save</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
