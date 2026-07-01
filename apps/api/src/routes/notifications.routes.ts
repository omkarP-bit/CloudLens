import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { supabaseAdmin } from '../config/supabase.js';
import { sendBudgetAlertEmail } from '../services/notifications/email.service.js';
import { sendSlackAlert } from '../services/notifications/slack.service.js';
import { sendWebhookAlert } from '../services/notifications/webhook.service.js';
import { dispatchAlert } from '../services/notifications/dispatcher.service.js';
import { getBudget } from '../services/supabase/budgets.repo.js';

export async function notificationsRoutes(fastify: FastifyInstance) {
  fastify.post('/api/notifications/test-email', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user;

    try {
      const { data: profile } = await supabaseAdmin
        .from('user_profiles')
        .select('email')
        .eq('id', user.id)
        .single();

      if (!profile?.email) {
        return reply.status(400).send({ error: 'No email found for your account' });
      }

      await sendBudgetAlertEmail(
        profile.email,
        'Test Budget',
        80,
        85,
        4250,
        5000,
        'USD'
      );

      console.log(`[Test] Test email sent to ${profile.email}`);
      return { success: true, message: `Test email sent to ${profile.email}` };
    } catch (err: any) {
      console.error(`[Test] Test email failed: ${err.message}`);
      return reply.status(500).send({ error: `Email failed: ${err.message}` });
    }
  });

  fastify.post('/api/notifications/test-slack', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = z.object({
      webhookUrl: z.string().url(),
    }).parse(request.body as any);

    try {
      await sendSlackAlert(body.webhookUrl, 'Test Budget', 80, 85, 4250, 5000, 'USD');
      console.log(`[Test] Test Slack message sent`);
      return { success: true, message: 'Test Slack message sent' };
    } catch (err: any) {
      console.error(`[Test] Test Slack failed: ${err.message}`);
      return reply.status(500).send({ error: `Slack test failed: ${err.message}` });
    }
  });

  fastify.post('/api/notifications/test-webhook', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user;
    const body = z.object({
      webhookUrl: z.string().url(),
    }).parse(request.body as any);

    try {
      await sendWebhookAlert(
        body.webhookUrl, 'Test Budget', 80, 85, 4250, 5000, 'USD',
        'test-budget-id', 'test-account-id', user.id
      );
      console.log(`[Test] Test webhook sent`);
      return { success: true, message: 'Test webhook payload sent' };
    } catch (err: any) {
      console.error(`[Test] Test webhook failed: ${err.message}`);
      return reply.status(500).send({ error: `Webhook test failed: ${err.message}` });
    }
  });

  fastify.post('/api/budgets/:id/test-alert', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user;
    const { id } = request.params as { id: string };

    try {
      const budget = await getBudget(id, user.id);
      if (!budget) {
        return reply.status(404).send({ error: 'Budget not found' });
      }

      const { data: profile } = await supabaseAdmin
        .from('user_profiles')
        .select('email')
        .eq('id', user.id)
        .single();

      const testThreshold = 90;
      const testPercent = 92;
      const testSpent = Math.round(budget.limit_amount * 0.92 * 100) / 100;

      console.log(`[Test] Simulating alert for budget "${budget.name}": ${testPercent}% used, threshold ${testThreshold}%`);

      await dispatchAlert(
        {
          id: budget.id,
          user_id: user.id,
          account_id: budget.account_id,
          name: budget.name,
          limit_amount: budget.limit_amount,
          currency: budget.currency,
          alert_channels: budget.alert_channels || {},
          user_email: profile?.email || '',
        },
        testThreshold,
        testPercent,
        testSpent
      );

      return {
        success: true,
        message: `Test alert dispatched for "${budget.name}"`,
        details: {
          threshold: testThreshold,
          simulatedPercent: testPercent,
          simulatedSpent: testSpent,
          channels: budget.alert_channels,
        },
      };
    } catch (err: any) {
      console.error(`[Test] Test alert failed: ${err.message}`);
      return reply.status(500).send({ error: `Test alert failed: ${err.message}` });
    }
  });

  fastify.get('/api/notifications/log', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user;

    try {
      const { data: budgets } = await supabaseAdmin
        .from('budgets')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_template', false);

      if (!budgets || budgets.length === 0) {
        return [];
      }

      const budgetIds = budgets.map((b) => b.id);

      const { data: log, error } = await supabaseAdmin
        .from('notification_log')
        .select('*')
        .in('budget_id', budgetIds)
        .order('sent_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      return log || [];
    } catch (err: any) {
      console.error(`[Notifications] Failed to fetch log: ${err.message}`);
      return reply.status(500).send({ error: `Failed to fetch notification log: ${err.message}` });
    }
  });
}
