import { supabaseAdmin } from '../../config/supabase.js';
export async function listBudgets(userId, accountId) {
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
    if (error)
        throw error;
    return data || [];
}
export async function listBudgetTemplates(userId) {
    const { data, error } = await supabaseAdmin
        .from('budgets')
        .select('*')
        .eq('user_id', userId)
        .eq('is_template', true)
        .order('created_at', { ascending: false });
    if (error)
        throw error;
    return data || [];
}
export async function getBudget(id, userId) {
    const { data, error } = await supabaseAdmin
        .from('budgets')
        .select('*')
        .eq('id', id)
        .eq('user_id', userId)
        .single();
    if (error || !data)
        return null;
    return data;
}
export async function createBudget(userId, budget) {
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
    if (error)
        throw error;
    return data;
}
export async function updateBudget(id, userId, updates) {
    const { data, error } = await supabaseAdmin
        .from('budgets')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .single();
    if (error)
        throw error;
    return data;
}
export async function deleteBudget(id, userId) {
    const { error } = await supabaseAdmin
        .from('budgets')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);
    if (error)
        throw error;
}
export async function getBudgetActuals(budgetId, userId, limit = 12) {
    const { data: budget } = await supabaseAdmin
        .from('budgets')
        .select('id')
        .eq('id', budgetId)
        .eq('user_id', userId)
        .single();
    if (!budget)
        throw new Error('Budget not found');
    const { data, error } = await supabaseAdmin
        .from('budget_actuals')
        .select('*')
        .eq('budget_id', budgetId)
        .order('period_date', { ascending: false })
        .limit(limit);
    if (error)
        throw error;
    return data || [];
}
export async function getBudgetsWithActuals(userId, accountId) {
    const budgets = await listBudgets(userId, accountId);
    if (budgets.length === 0)
        return [];
    const budgetIds = budgets.map((b) => b.id);
    const { data: actuals, error } = await supabaseAdmin
        .from('budget_actuals')
        .select('*')
        .in('budget_id', budgetIds)
        .order('period_date', { ascending: false });
    if (error)
        throw error;
    const actualsByBudget = {};
    for (const a of actuals || []) {
        if (!actualsByBudget[a.budget_id])
            actualsByBudget[a.budget_id] = [];
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
export async function upsertBudgetActual(budgetId, periodDate, actual, forecasted) {
    const { error } = await supabaseAdmin
        .from('budget_actuals')
        .upsert({
        budget_id: budgetId,
        period_date: periodDate,
        actual,
        forecasted: forecasted ?? null,
        synced_at: new Date().toISOString(),
    }, {
        onConflict: 'budget_id, period_date',
        ignoreDuplicates: false,
    });
    if (error)
        throw error;
}
