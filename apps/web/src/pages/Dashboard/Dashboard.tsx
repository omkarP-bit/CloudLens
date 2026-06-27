import { TrendingUp, CreditCard, Sparkles, AlertCircle } from 'lucide-react';

export function Dashboard() {
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-panel p-6 rounded-xl flex flex-col justify-between h-36">
          <div className="flex items-center justify-between">
            <span className="text-zinc-500 text-xs font-semibold uppercase tracking-wider">MTD Spend</span>
            <CreditCard className="h-4.5 w-4.5 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-white">$0.00</h2>
            <p className="text-[10px] text-zinc-500 mt-1">MTD forecast: $0.00 (0% change)</p>
          </div>
        </div>

        <div className="glass-panel p-6 rounded-xl flex flex-col justify-between h-36">
          <div className="flex items-center justify-between">
            <span className="text-zinc-500 text-xs font-semibold uppercase tracking-wider">Active Services</span>
            <TrendingUp className="h-4.5 w-4.5 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-white">0</h2>
            <p className="text-[10px] text-zinc-500 mt-1">Across connected AWS regions</p>
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
