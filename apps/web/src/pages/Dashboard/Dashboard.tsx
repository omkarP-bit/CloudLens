import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  TrendingUp, CreditCard, Sparkles, AlertCircle, Loader, Layers, XCircle,
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import { useAccountStore } from '../../store/accountStore.js';
import { supabase } from '../../lib/supabase.js';
import { useAWS } from '../../hooks/useAWS.js';
import {
  useCostSummary,
  useCostTrends,
  useServiceBreakdown,
  useTopServices,
} from '../../hooks/useCosts.js';

const DONUT_COLORS = [
  '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#14b8a6',
  '#a855f7', '#eab308',
];

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(n);
}

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return formatCurrency(n);
}

export function Dashboard() {
  const queryClient = useQueryClient();
  const { accounts, isLoading: accountsLoading } = useAWS();
  const { activeAccountId } = useAccountStore();
  const [trendDays, setTrendDays] = useState(30);

  const summary = useCostSummary(activeAccountId);
  const trends = useCostTrends(activeAccountId, trendDays);
  const breakdown = useServiceBreakdown(activeAccountId);
  const topServices = useTopServices(activeAccountId, 10);

  useEffect(() => {
    if (!activeAccountId) return;

    const channel = supabase
      .channel('cost-updates')
      .on(
        'postgres_changes' as any,
        {
          event: '*',
          schema: 'public',
          table: 'cost_cache',
          filter: `account_id=eq.${activeAccountId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['costs', 'summary', activeAccountId] });
          queryClient.invalidateQueries({ queryKey: ['costs', 'trends', activeAccountId] });
          queryClient.invalidateQueries({ queryKey: ['costs', 'breakdown', activeAccountId] });
          queryClient.invalidateQueries({ queryKey: ['costs', 'top-services', activeAccountId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeAccountId, queryClient]);

  const isLoading = summary.isLoading || trends.isLoading || breakdown.isLoading || topServices.isLoading;

  const firstError = summary.error || trends.error || breakdown.error || topServices.error;

  if (accountsLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader className="h-8 w-8 text-primary animate-spin" />
      </div>
    );
  }

  if (accounts.length === 0 || !activeAccountId) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">FinOps Overview</h1>
            <p className="text-zinc-500 text-xs mt-1">
              Analyze and monitor real-time AWS usage, expenditures, and anomaly alerts.
            </p>
          </div>
        </div>
        <div className="glass-panel p-12 rounded-xl flex flex-col items-center justify-center text-center gap-3">
          <Sparkles className="h-8 w-8 text-primary animate-pulse" />
          <h3 className="text-sm font-semibold text-white">Dashboard Live Cache</h3>
          <p className="text-zinc-500 text-xs max-w-sm">
            Connect your AWS Account and complete credential verification under settings to activate cost and regional analytics.
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">FinOps Overview</h1>
            <p className="text-zinc-500 text-xs mt-1">
              Analyze and monitor real-time AWS usage, expenditures, and anomaly alerts.
            </p>
          </div>
        </div>
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <Loader className="h-8 w-8 text-primary animate-spin" />
            <span className="text-zinc-500 text-xs">Loading cost data...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">FinOps Overview</h1>
          <p className="text-zinc-500 text-xs mt-1">
            Analyze and monitor real-time AWS usage, expenditures, and anomaly alerts.
          </p>
        </div>
      </div>

      {firstError && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-xs">
          <XCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
          <div>
            <span className="font-semibold text-destructive">API Error: </span>
            <span className="text-zinc-300">{String(firstError).replace(/^Error:\s*/i, '')}</span>
            <p className="text-zinc-500 mt-1">
              Check the API server logs and verify your AWS credentials have <code className="text-[10px] bg-zinc-900 px-1 py-0.5 rounded">ce:GetCostAndUsage</code> permission.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-panel p-6 rounded-xl flex flex-col justify-between h-36">
          <div className="flex items-center justify-between">
            <span className="text-zinc-500 text-xs font-semibold uppercase tracking-wider">MTD Spend</span>
            <CreditCard className="h-4.5 w-4.5 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-white">
              {formatCompact(summary.data?.totalMtd ?? 0)}
            </h2>
            <p className="text-[10px] text-zinc-500 mt-1">
              MTD forecast: {formatCompact(summary.data?.forecastedMonthEnd ?? 0)}
            </p>
          </div>
        </div>

        <div className="glass-panel p-6 rounded-xl flex flex-col justify-between h-36">
          <div className="flex items-center justify-between">
            <span className="text-zinc-500 text-xs font-semibold uppercase tracking-wider">Active Services</span>
            <TrendingUp className="h-4.5 w-4.5 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-white">
              {breakdown.data?.length ?? 0}
            </h2>
            <p className="text-[10px] text-zinc-500 mt-1">
              Services with costs this month
            </p>
          </div>
        </div>

        <div className="glass-panel p-6 rounded-xl flex flex-col justify-between h-36">
          <div className="flex items-center justify-between">
            <span className="text-zinc-500 text-xs font-semibold uppercase tracking-wider">Anomalies Detected</span>
            <AlertCircle className="h-4.5 w-4.5 text-amber-500" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-amber-500">0</h2>
            <p className="text-[10px] text-zinc-500 mt-1">Z-score cost spikes: None</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 glass-panel rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white">Daily Spend Trend</h3>
            <div className="flex items-center gap-1 bg-zinc-900 border border-border rounded-lg p-0.5">
              {[30, 60, 90].map((d) => (
                <button
                  key={d}
                  onClick={() => setTrendDays(d)}
                  className={`px-3 py-1 text-[11px] font-medium rounded-md transition-colors cursor-pointer ${
                    trendDays === d
                      ? 'bg-primary text-white'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {d}D
                </button>
              ))}
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trends.data ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis
                  dataKey="date"
                  stroke="rgba(255,255,255,0.15)"
                  tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.3)' }}
                  tickFormatter={(v: string) => {
                    const d = new Date(v);
                    return `${d.getMonth() + 1}/${d.getDate()}`;
                  }}
                />
                <YAxis
                  stroke="rgba(255,255,255,0.15)"
                  tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.3)' }}
                  tickFormatter={(v: number) => `$${v}`}
                />
                <Tooltip
                  contentStyle={{
                    background: '#121215',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                  labelStyle={{ color: '#f4f4f5' }}
                  formatter={(value: number) => [formatCurrency(value), 'Spend']}
                />
                <Line
                  type="monotone"
                  dataKey="amount"
                  stroke="#6366f1"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: '#6366f1' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-2 glass-panel rounded-xl p-6">
          <h3 className="text-sm font-semibold text-white mb-4">Cost by Service</h3>
          {(breakdown.data ?? []).length === 0 ? (
            <div className="flex items-center justify-center h-48 text-zinc-500 text-xs">
              No service data available
            </div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={(breakdown.data ?? []).slice(0, 8)}
                    dataKey="amount"
                    nameKey="service"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={2}
                  >
                    {(breakdown.data ?? []).slice(0, 8).map((_, i) => (
                      <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: '#121215',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                    formatter={(value: number, name: string) => [formatCurrency(value), name]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="mt-3 space-y-1.5">
            {(breakdown.data ?? []).slice(0, 5).map((s, i) => (
              <div key={s.service} className="flex items-center gap-2 text-[11px]">
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }}
                />
                <span className="text-zinc-400 flex-1 truncate">{s.service}</span>
                <span className="text-zinc-500">{s.percentage}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="glass-panel rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Layers className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-white">Top Services by Spend</h3>
        </div>
        {(topServices.data ?? []).length === 0 ? (
          <div className="flex items-center justify-center py-12 text-zinc-500 text-xs">
            No service data available
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-zinc-500">
                  <th className="text-left font-semibold pb-3 pr-4">Service</th>
                  <th className="text-right font-semibold pb-3 pr-4">Current Month</th>
                  <th className="text-right font-semibold pb-3 pr-4">Previous Month</th>
                  <th className="text-right font-semibold pb-3 pr-4">Change</th>
                  <th className="text-right font-semibold pb-3">Share</th>
                </tr>
              </thead>
              <tbody>
                {(topServices.data ?? []).map((s) => (
                  <tr key={s.service} className="border-b border-border/50 last:border-0">
                    <td className="py-3 pr-4 text-white font-medium">{s.service}</td>
                    <td className="py-3 pr-4 text-right text-zinc-300">{formatCurrency(s.amount)}</td>
                    <td className="py-3 pr-4 text-right text-zinc-500">{formatCurrency(s.previousAmount)}</td>
                    <td className="py-3 pr-4 text-right">
                      <span
                        className={`font-semibold ${
                          s.change > 0
                            ? 'text-destructive'
                            : s.change < 0
                            ? 'text-success'
                            : 'text-zinc-400'
                        }`}
                      >
                        {s.change > 0 ? '+' : ''}{s.change}%
                      </span>
                    </td>
                    <td className="py-3 text-right text-zinc-400">{s.percentage}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
