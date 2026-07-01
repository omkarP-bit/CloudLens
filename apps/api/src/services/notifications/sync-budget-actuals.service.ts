import { listAllAccounts, getDecryptedCredentials } from '../supabase/accounts.repo.js';
import { getCostSummary } from '../aws/cost-explorer.service.js';
import { supabaseAdmin } from '../../config/supabase.js';

export async function syncBudgetActuals(): Promise<void> {
  const startTime = Date.now();
  console.log(`[Sync] Starting budget actuals sync...`);

  try {
    const accounts = await listAllAccounts();
    console.log(`[Sync] Found ${accounts.length} active account(s)`);

    let totalBudgets = 0;
    let syncedAccounts = 0;

    for (const account of accounts) {
      try {
        const creds = await getDecryptedCredentials(account.id);

        if (creds.accessKeyId.startsWith('mock_') || creds.secretAccessKey.startsWith('mock_')) {
          console.log(`[Sync] Skipping mock account ${account.alias} (${account.id})`);
          continue;
        }

        const summary = await getCostSummary(creds);

        const periodDate = new Date().toISOString().slice(0, 10);

        const { data: budgets, error: budgetsError } = await supabaseAdmin
          .from('budgets')
          .select('id, period')
          .eq('account_id', account.id)
          .eq('is_template', false);

        if (budgetsError) {
          console.error(`[Sync] Failed to fetch budgets for account ${account.id}: ${budgetsError.message}`);
          continue;
        }

        if (!budgets || budgets.length === 0) {
          console.log(`[Sync] No budgets for account ${account.alias} — skipping`);
          continue;
        }

        let syncedCount = 0;

        for (const budget of budgets) {
          let periodStart: string;
          const now = new Date();

          switch (budget.period) {
            case 'DAILY':
              periodStart = periodDate;
              break;
            case 'MONTHLY':
              periodStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
              break;
            case 'QUARTERLY': {
              const q = Math.floor(now.getMonth() / 3) * 3;
              periodStart = `${now.getFullYear()}-${String(q + 1).padStart(2, '0')}-01`;
              break;
            }
            case 'ANNUALLY':
              periodStart = `${now.getFullYear()}-01-01`;
              break;
            default:
              periodStart = periodDate;
          }

          const { error } = await supabaseAdmin
            .from('budget_actuals')
            .upsert(
              {
                budget_id: budget.id,
                period_date: periodStart,
                actual: summary.totalMtd,
                forecasted: summary.forecastedMonthEnd,
                synced_at: new Date().toISOString(),
              },
              {
                onConflict: 'budget_id, period_date',
                ignoreDuplicates: false,
              }
            );

          if (error) {
            console.error(`[Sync] Failed to upsert actual for budget ${budget.id}: ${error.message}`);
          } else {
            syncedCount++;
          }
        }

        console.log(`[Sync] Account ${account.alias}: synced ${syncedCount} budget(s) (MTD: $${summary.totalMtd})`);
        totalBudgets += syncedCount;
        syncedAccounts++;
      } catch (err: any) {
        console.error(`[Sync] Failed to sync account ${account.alias} (${account.id}): ${err.message}`);
      }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[Sync] Completed in ${elapsed}s (${syncedAccounts}/${accounts.length} accounts, ${totalBudgets} budgets)`);
  } catch (err: any) {
    console.error(`[Sync] Failed: ${err.message}`);
  }
}
