import { supabaseAdmin } from '../../config/supabase.js';
import { dispatchAlert } from './dispatcher.service.js';
import { listAllBudgets } from '../supabase/budgets.repo.js';

interface BudgetWithActual {
  id: string;
  user_id: string;
  account_id: string;
  name: string;
  limit_amount: number;
  currency: string;
  alert_thresholds: number[];
  alert_channels: Record<string, any>;
  currentActual: number;
}

export async function evaluateBudgets(): Promise<void> {
  const startTime = Date.now();
  console.log(`[Eval] Starting budget evaluation...`);

  try {
    const budgets = await listAllBudgets();
    if (budgets.length === 0) {
      console.log(`[Eval] No budgets found — skipping`);
      return;
    }

    console.log(`[Eval] Found ${budgets.length} budget(s)`);

    const budgetIds = budgets.map((b) => b.id);

    const { data: actuals, error: actualsError } = await supabaseAdmin
      .from('budget_actuals')
      .select('budget_id, actual, period_date')
      .in('budget_id', budgetIds)
      .order('period_date', { ascending: false });

    if (actualsError) {
      console.error(`[Eval] Failed to fetch budget actuals: ${actualsError.message}`);
      return;
    }

    const latestActualByBudget: Record<string, { actual: number; periodDate: string }> = {};
    for (const a of actuals || []) {
      if (!latestActualByBudget[a.budget_id]) {
        latestActualByBudget[a.budget_id] = { actual: a.actual, periodDate: a.period_date };
      }
    }

    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from('user_profiles')
      .select('id, email');

    if (profilesError) {
      console.error(`[Eval] Failed to fetch user profiles: ${profilesError.message}`);
      return;
    }

    const emailByUserId: Record<string, string> = {};
    for (const p of profiles || []) {
      emailByUserId[p.id] = p.email;
    }

    const { data: alreadyNotified, error: notifiedError } = await supabaseAdmin
      .from('alert_notifications')
      .select('budget_id, threshold, period_date');

    if (notifiedError) {
      console.error(`[Eval] Failed to fetch existing notifications: ${notifiedError.message}`);
      return;
    }

    const notifiedSet = new Set<string>();
    for (const n of alreadyNotified || []) {
      notifiedSet.add(`${n.budget_id}:${n.threshold}:${n.period_date}`);
    }

    let alertsSent = 0;
    let alertsSkipped = 0;

    for (const budget of budgets) {
      const latest = latestActualByBudget[budget.id];
      if (!latest) {
        console.log(`[Eval] Budget "${budget.name}": no actuals yet — skipping`);
        continue;
      }

      const currentActual = latest.actual;
      const percentUsed = budget.limit_amount > 0
        ? Math.round((currentActual / budget.limit_amount) * 10000) / 100
        : 0;

      const thresholds = budget.alert_thresholds || [];
      const userEmail = emailByUserId[budget.user_id] || '';

      console.log(`[Eval] Budget "${budget.name}": $${currentActual} / $${budget.limit_amount} = ${percentUsed}%, thresholds [${thresholds.join(',')}]`);

      for (const threshold of [...thresholds].sort((a, b) => b - a)) {
        if (percentUsed < threshold) {
          continue;
        }

        const dedupKey = `${budget.id}:${threshold}:${latest.periodDate}`;
        if (notifiedSet.has(dedupKey)) {
          console.log(`[Eval] Budget "${budget.name}": threshold ${threshold}% already notified — skipped`);
          alertsSkipped++;
          continue;
        }

        console.log(`[Eval] Budget "${budget.name}": threshold ${threshold}% crossed — dispatching alert`);

        await dispatchAlert(
          {
            id: budget.id,
            user_id: budget.user_id,
            account_id: budget.account_id,
            name: budget.name,
            limit_amount: budget.limit_amount,
            currency: budget.currency || 'USD',
            alert_channels: budget.alert_channels || {},
            user_email: userEmail,
          },
          threshold,
          percentUsed,
          currentActual
        );

        console.log(`[Eval] Budget "${budget.name}": alert dispatched for ${threshold}%`);

        const { error: insertError } = await supabaseAdmin
          .from('alert_notifications')
          .insert({
            budget_id: budget.id,
            threshold,
            channel: 'email',
            period_date: latest.periodDate,
          });

        if (insertError) {
          console.error(`[Eval] Failed to record notification for budget ${budget.id}: ${insertError.message}`);
        }

        alertsSent++;
      }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[Eval] Completed in ${elapsed}s (${budgets.length} budgets, ${alertsSent} sent, ${alertsSkipped} dedup-skipped)`);
  } catch (err: any) {
    console.error(`[Eval] Failed: ${err.message}`);
  }
}
