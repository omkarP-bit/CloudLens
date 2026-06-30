import { useAWS } from '../../hooks/useAWS.js';
import { useEffect } from 'react';
import { useAccountStore } from '../../store/accountStore.js';
import { CheckCircle, AlertTriangle } from 'lucide-react';

export function Topbar() {
  const { accounts, isLoading } = useAWS();
  const { activeAccountId, setActiveAccountId } = useAccountStore();

  useEffect(() => {
    if (accounts.length > 0 && !activeAccountId) {
      setActiveAccountId(accounts[0].id);
    }
  }, [accounts, activeAccountId, setActiveAccountId]);

  const activeAccount = accounts.find((a) => a.id === activeAccountId);

  return (
    <header className="h-16 border-b border-border bg-card/40 backdrop-blur flex items-center justify-between px-8 select-none">
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-semibold text-white">FinOps Control Plane</h1>
      </div>

      <div className="flex items-center gap-6">
        {accounts.length > 0 ? (
          <div className="flex items-center gap-3">
            <span className="text-xs text-zinc-400 font-medium">AWS Account:</span>
            <select
              value={activeAccountId || ''}
              onChange={(e) => setActiveAccountId(e.target.value)}
              className="bg-zinc-900 border border-border text-white text-xs rounded-lg focus:ring-primary focus:border-primary block p-2 transition-all duration-200 outline-none"
            >
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.alias} ({acc.aws_account_id})
                </option>
              ))}
            </select>

            {activeAccount && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-900 border border-border">
                {activeAccount.status === 'active' ? (
                  <>
                    <CheckCircle className="h-3.5 w-3.5 text-success" />
                    <span className="text-[10px] font-medium text-success">Connected</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-3.5 w-3.5 text-warning animate-pulse" />
                    <span className="text-[10px] font-medium text-warning capitalize">{activeAccount.status}</span>
                  </>
                )}
              </div>
            )}
          </div>
        ) : (
          !isLoading && (
            <div className="flex items-center gap-2 text-warning bg-warning/10 border border-warning/20 px-3 py-1.5 rounded-lg text-xs font-medium">
              <AlertTriangle className="h-4 w-4" />
              <span>No AWS accounts connected. Please go to Settings.</span>
            </div>
          )
        )}
      </div>
    </header>
  );
}
