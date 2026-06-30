import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  DollarSign, Plus, Trash2, Loader,
} from 'lucide-react';
import { useAccountStore } from '../../store/accountStore.js';
import { supabase } from '../../lib/supabase.js';
import {
  useBudgets,
  useCreateBudget,
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

interface BudgetCardProps {
  budget: BudgetWithActuals;
  onDelete: (id: string) => void;
  isDeleting: boolean;
}

function BudgetCard({ budget, onDelete, isDeleting }: BudgetCardProps) {
  return (
    <div className="glass-panel rounded-xl p-6 relative flex flex-col justify-between hover:border-zinc-750 transition-all duration-200">
      <div>
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-bold text-white">{budget.name}</h3>
          </div>
          <button
            onClick={() => onDelete(budget.id)}
            disabled={isDeleting}
            className="text-zinc-500 hover:text-destructive transition-colors cursor-pointer disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
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

export function Budgets() {
  const queryClient = useQueryClient();
  const { activeAccountId } = useAccountStore();
  const { data: budgets, isLoading } = useBudgets(activeAccountId);
  const createBudget = useCreateBudget();
  const deleteBudget = useDeleteBudget();

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [scopeType, setScopeType] = useState('account');
  const [scopeValue, setScopeValue] = useState('');
  const [period, setPeriod] = useState('MONTHLY');
  const [limitAmount, setLimitAmount] = useState('');
  const [alertThresholds, setAlertThresholds] = useState('50, 80, 100');

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

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAccountId) return;

    try {
      await createBudget.mutateAsync({
        accountId: activeAccountId,
        name,
        scopeType,
        scopeValue: scopeValue || undefined,
        period,
        limitAmount: parseFloat(limitAmount),
        alertThresholds: alertThresholds.split(',').map((s) => parseFloat(s.trim())).filter((n) => !isNaN(n)),
      });
      setName('');
      setScopeValue('');
      setLimitAmount('');
      setShowForm(false);
    } catch (err: any) {
      alert(err.message || 'Failed to create budget');
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
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-xs font-semibold hover:bg-accent transition-colors cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          <span>Create Budget</span>
        </button>
      </div>

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
              isDeleting={deleteBudget.isPending}
            />
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#121215] border border-border rounded-xl p-6 animate-fade-in">
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
    </div>
  );
}
