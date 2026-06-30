import { z } from 'zod';
import { supabaseAdmin } from '../config/supabase.js';
import { getDecryptedCredentials } from '../services/supabase/accounts.repo.js';
import { getBudgetsWithActuals, getBudget, createBudget, updateBudget, deleteBudget, getBudgetActuals, listBudgetTemplates, } from '../services/supabase/budgets.repo.js';
import { syncBudgetToAws } from '../services/aws/budgets.service.js';
async function verifyAccountOwnership(accountId, userId) {
    const { data, error } = await supabaseAdmin
        .from('aws_accounts')
        .select('id')
        .eq('id', accountId)
        .eq('user_id', userId)
        .maybeSingle();
    if (error || !data) {
        throw new Error('Account not found or access denied');
    }
}
const createBudgetSchema = z.object({
    accountId: z.string().uuid(),
    name: z.string().min(1),
    scopeType: z.enum(['account', 'service', 'tag', 'region']),
    scopeValue: z.string().optional(),
    period: z.enum(['DAILY', 'MONTHLY', 'QUARTERLY', 'ANNUALLY']),
    limitAmount: z.number().positive(),
    currency: z.string().default('USD'),
    alertThresholds: z.array(z.number()).default([50, 80, 100]),
    alertChannels: z.object({
        email: z.boolean().default(true),
        slack: z.boolean().default(false),
        webhook: z.string().nullable().default(null),
    }).default({}),
    isTemplate: z.boolean().default(false),
    templateName: z.string().optional(),
    syncToAws: z.boolean().default(false),
});
const updateBudgetSchema = z.object({
    name: z.string().min(1).optional(),
    scopeType: z.enum(['account', 'service', 'tag', 'region']).optional(),
    scopeValue: z.string().nullable().optional(),
    period: z.enum(['DAILY', 'MONTHLY', 'QUARTERLY', 'ANNUALLY']).optional(),
    limitAmount: z.number().positive().optional(),
    alertThresholds: z.array(z.number()).optional(),
    alertChannels: z.object({
        email: z.boolean().optional(),
        slack: z.boolean().optional(),
        webhook: z.string().nullable().optional(),
    }).optional(),
    syncToAws: z.boolean().default(false).optional(),
});
export async function budgetsRoutes(fastify) {
    fastify.get('/api/budgets', async (request, reply) => {
        const user = request.user;
        const query = z.object({
            accountId: z.string().uuid().optional(),
        }).parse(request.query);
        try {
            if (query.accountId) {
                await verifyAccountOwnership(query.accountId, user.id);
            }
            const budgets = await getBudgetsWithActuals(user.id, query.accountId);
            return budgets;
        }
        catch (err) {
            fastify.log.error({ route: 'list-budgets', err: err.message || err });
            return reply.status(500).send({ error: `Failed to list budgets: ${err.message || 'Unknown error'}` });
        }
    });
    fastify.get('/api/budgets/templates', async (request, reply) => {
        const user = request.user;
        try {
            const templates = await listBudgetTemplates(user.id);
            return templates;
        }
        catch (err) {
            fastify.log.error({ route: 'list-templates', err: err.message || err });
            return reply.status(500).send({ error: `Failed to list templates: ${err.message || 'Unknown error'}` });
        }
    });
    fastify.get('/api/budgets/:id', async (request, reply) => {
        const user = request.user;
        const { id } = request.params;
        try {
            const budget = await getBudget(id, user.id);
            if (!budget) {
                return reply.status(404).send({ error: 'Budget not found' });
            }
            return budget;
        }
        catch (err) {
            fastify.log.error({ route: 'get-budget', id, err: err.message || err });
            return reply.status(500).send({ error: `Failed to get budget: ${err.message || 'Unknown error'}` });
        }
    });
    fastify.post('/api/budgets', async (request, reply) => {
        const user = request.user;
        const body = createBudgetSchema.parse(request.body);
        try {
            await verifyAccountOwnership(body.accountId, user.id);
            let awsBudgetId = null;
            if (body.syncToAws) {
                try {
                    const creds = await getDecryptedCredentials(body.accountId);
                    awsBudgetId = await syncBudgetToAws(creds, body.accountId, body.name, body.limitAmount, body.period, null);
                }
                catch (syncErr) {
                    fastify.log.warn({ err: syncErr.message }, 'AWS Budget sync failed, creating local only');
                }
            }
            const budgetData = {
                account_id: body.accountId,
                name: body.name,
                scope_type: body.scopeType,
                scope_value: body.scopeValue,
                period: body.period,
                limit_amount: body.limitAmount,
                currency: body.currency,
                alert_thresholds: body.alertThresholds,
                alert_channels: body.alertChannels,
                is_template: body.isTemplate,
                template_name: body.templateName,
            };
            if (awsBudgetId) {
                budgetData.aws_budget_id = awsBudgetId;
            }
            const budget = await createBudget(user.id, budgetData);
            return reply.status(201).send(budget);
        }
        catch (err) {
            if (err instanceof z.ZodError) {
                return reply.status(400).send({ error: 'Validation failed', details: err.format() });
            }
            fastify.log.error({ route: 'create-budget', err: err.message || err });
            return reply.status(500).send({ error: `Failed to create budget: ${err.message || 'Unknown error'}` });
        }
    });
    fastify.patch('/api/budgets/:id', async (request, reply) => {
        const user = request.user;
        const { id } = request.params;
        const body = updateBudgetSchema.parse(request.body);
        try {
            const existing = await getBudget(id, user.id);
            if (!existing) {
                return reply.status(404).send({ error: 'Budget not found' });
            }
            if (body.syncToAws && existing.aws_budget_id) {
                try {
                    const creds = await getDecryptedCredentials(existing.account_id);
                    await syncBudgetToAws(creds, existing.account_id, existing.name, body.limitAmount || existing.limit_amount, body.period || existing.period, existing.aws_budget_id);
                }
                catch (syncErr) {
                    fastify.log.warn({ err: syncErr.message }, 'AWS Budget update sync failed');
                }
            }
            const updateData = {};
            if (body.name)
                updateData.name = body.name;
            if (body.scopeType)
                updateData.scope_type = body.scopeType;
            if (body.scopeValue !== undefined)
                updateData.scope_value = body.scopeValue;
            if (body.period)
                updateData.period = body.period;
            if (body.limitAmount)
                updateData.limit_amount = body.limitAmount;
            if (body.alertThresholds)
                updateData.alert_thresholds = body.alertThresholds;
            if (body.alertChannels)
                updateData.alert_channels = body.alertChannels;
            const updated = await updateBudget(id, user.id, updateData);
            return updated;
        }
        catch (err) {
            if (err instanceof z.ZodError) {
                return reply.status(400).send({ error: 'Validation failed', details: err.format() });
            }
            fastify.log.error({ route: 'update-budget', id, err: err.message || err });
            return reply.status(500).send({ error: `Failed to update budget: ${err.message || 'Unknown error'}` });
        }
    });
    fastify.delete('/api/budgets/:id', async (request, reply) => {
        const user = request.user;
        const { id } = request.params;
        try {
            const existing = await getBudget(id, user.id);
            if (!existing) {
                return reply.status(404).send({ error: 'Budget not found' });
            }
            if (existing.aws_budget_id) {
                try {
                    const creds = await getDecryptedCredentials(existing.account_id);
                    const { deleteAwsBudget } = await import('../services/aws/budgets.service.js');
                    await deleteAwsBudget(creds, existing.aws_budget_id);
                }
                catch (syncErr) {
                    fastify.log.warn({ err: syncErr.message }, 'AWS Budget delete sync failed');
                }
            }
            await deleteBudget(id, user.id);
            return reply.status(204).send();
        }
        catch (err) {
            fastify.log.error({ route: 'delete-budget', id, err: err.message || err });
            return reply.status(500).send({ error: `Failed to delete budget: ${err.message || 'Unknown error'}` });
        }
    });
    fastify.get('/api/budgets/:id/actuals', async (request, reply) => {
        const user = request.user;
        const { id } = request.params;
        const query = z.object({ limit: z.coerce.number().int().min(1).max(36).default(12) }).parse(request.query);
        try {
            const actuals = await getBudgetActuals(id, user.id, query.limit);
            return actuals;
        }
        catch (err) {
            if (err.message === 'Budget not found') {
                return reply.status(404).send({ error: 'Budget not found' });
            }
            fastify.log.error({ route: 'budget-actuals', id, err: err.message || err });
            return reply.status(500).send({ error: `Failed to get budget actuals: ${err.message || 'Unknown error'}` });
        }
    });
}
