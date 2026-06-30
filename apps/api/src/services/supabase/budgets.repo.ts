import { supabaseAdmin } from '../../config/supabase.js';

export interface Budget {
  id: string;
  user_id: string;
  account_id: string;
  name: string;
  scope_type: 'account' | 'service' | 'tag' | 'region';
  scope_value: string | null;
  period: 'DAILY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY';
  limit_amount: number;
  currency: string;
  alert_thresholds: number[];
  alert_channels: Record<string, any>;
  is_template: boolean;
  template_name: string | null;
  aws_budget_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface BudgetActual {
  id: string;
  budget_id: string;
  period_date: string;
  actual: number;
  forecasted: number | null;
  synced_at: string;
}

export interface BudgetWithActuals extends Budget {
  actuals: BudgetActual[];
  currentActual: number | null;
  forecastedActual: number | null;
  percentUsed: number;
}

export async function listBudgets(userId: string, accountId?: string): Promise<Budget[]> {
  let query = supabaseAdmin
    .from('budgets')
    .select('*')
    .eq('user_id', userId)
    .eq('is_template', false)
    .order('created_at', { ascending: false });

  if (accountId) {
    query = query.eq('account_id', accountId);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data || [];
}

export async function listBudgetTemplates(userId: string): Promise<Budget[]> {
  const { data, error } = await supabaseAdmin
    .from('budgets')
    .select('*')
    .eq('user_id', userId)
    .eq('is_template', true)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getBudget(id: string, userId: string): Promise<Budget | null> {
  const { data, error } = await supabaseAdmin
    .from('budgets')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .single();

  if (error || !data) return null;
  return data;
}

export async function createBudget(
  userId: string,
  budget: {
    account_id: string;
    name: string;
    scope_type: string;
    scope_value?: string;
    period: string;
    limit_amount: number;
    currency?: string;
    alert_thresholds?: number[];
    alert_channels?: Record<string, any>;
    is_template?: boolean;
    template_name?: string;
    aws_budget_id?: string;
  }
): Promise<Budget> {
  const { data, error } = await supabaseAdmin
    .from('budgets')
    .insert({
      user_id: userId,
      account_id: budget.account_id,
      name: budget.name,
      scope_type: budget.scope_type,
      scope_value: budget.scope_value || null,
      period: budget.period,
      limit_amount: budget.limit_amount,
      currency: budget.currency || 'USD',
      alert_thresholds: budget.alert_thresholds || [50, 80, 100],
      alert_channels: budget.alert_channels || { email: true, slack: false, webhook: null },
      is_template: budget.is_template || false,
      template_name: budget.template_name || null,
      aws_budget_id: budget.aws_budget_id || null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateBudget(
  id: string,
  userId: string,
  updates: Partial<{
    name: string;
    scope_type: string;
    scope_value: string | null;
    period: string;
    limit_amount: number;
    alert_thresholds: number[];
    alert_channels: Record<string, any>;
    aws_budget_id: string | null;
    enabled: boolean;
  }>
): Promise<Budget> {
  const { data, error } = await supabaseAdmin
    .from('budgets')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteBudget(id: string, userId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('budgets')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) throw error;
}

export async function getBudgetActuals(
  budgetId: string,
  userId: string,
  limit: number = 12
): Promise<BudgetActual[]> {
  const { data: budget } = await supabaseAdmin
    .from('budgets')
    .select('id')
    .eq('id', budgetId)
    .eq('user_id', userId)
    .single();

  if (!budget) throw new Error('Budget not found');

  const { data, error } = await supabaseAdmin
    .from('budget_actuals')
    .select('*')
    .eq('budget_id', budgetId)
    .order('period_date', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

export async function getBudgetsWithActuals(
  userId: string,
  accountId?: string
): Promise<BudgetWithActuals[]> {
  const budgets = await listBudgets(userId, accountId);
  if (budgets.length === 0) return [];

  const budgetIds = budgets.map((b) => b.id);

  const { data: actuals, error } = await supabaseAdmin
    .from('budget_actuals')
    .select('*')
    .in('budget_id', budgetIds)
    .order('period_date', { ascending: false });

  if (error) throw error;

  const actualsByBudget: Record<string, BudgetActual[]> = {};
  for (const a of actuals || []) {
    if (!actualsByBudget[a.budget_id]) actualsByBudget[a.budget_id] = [];
    actualsByBudget[a.budget_id].push(a);
  }

  return budgets.map((b) => {
    const budgetActuals = actualsByBudget[b.id] || [];
    const latest = budgetActuals[0];
    const currentActual = latest?.actual || 0;
    const forecastedActual = latest?.forecasted || null;
    const percentUsed = b.limit_amount > 0
      ? Math.round((currentActual / b.limit_amount) * 10000) / 100
      : 0;

    return {
      ...b,
      actuals: budgetActuals,
      currentActual,
      forecastedActual,
      percentUsed,
    };
  });
}

export async function upsertBudgetActual(
  budgetId: string,
  periodDate: string,
  actual: number,
  forecasted?: number | null
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('budget_actuals')
    .upsert(
      {
        budget_id: budgetId,
        period_date: periodDate,
        actual,
        forecasted: forecasted ?? null,
        synced_at: new Date().toISOString(),
      },
      {
        onConflict: 'budget_id, period_date',
        ignoreDuplicates: false,
      }
    );

  if (error) throw error;
}
