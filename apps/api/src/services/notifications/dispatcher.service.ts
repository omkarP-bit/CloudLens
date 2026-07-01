import { supabaseAdmin } from '../../config/supabase.js';
import { sendBudgetAlertEmail } from './email.service.js';
import { sendSlackAlert } from './slack.service.js';
import { sendWebhookAlert } from './webhook.service.js';

interface AlertBudget {
  id: string;
  user_id: string;
  account_id: string;
  name: string;
  limit_amount: number;
  currency: string;
  alert_channels: Record<string, any>;
  user_email: string;
}

export async function dispatchAlert(
  budget: AlertBudget,
  threshold: number,
  percentUsed: number,
  spent: number
): Promise<void> {
  const channels = budget.alert_channels || {};
  const budgetName = budget.name;
  const limit = budget.limit_amount;
  const currency = budget.currency || 'USD';

  const promises: Promise<void>[] = [];

  if (channels.email) {
    promises.push(
      sendBudgetAlertEmail(budget.user_email, budgetName, threshold, percentUsed, spent, limit, currency)
        .then(() => logNotification(budget.id, 'email', budget.user_email, 'sent'))
        .catch((err) => logNotification(budget.id, 'email', budget.user_email, 'failed', err.message))
    );
  }

  if (channels.slack && typeof channels.slack === 'string') {
    promises.push(
      sendSlackAlert(channels.slack, budgetName, threshold, percentUsed, spent, limit, currency)
        .then(() => logNotification(budget.id, 'slack', channels.slack, 'sent'))
        .catch((err) => logNotification(budget.id, 'slack', channels.slack, 'failed', err.message))
    );
  }

  if (channels.webhook && typeof channels.webhook === 'string') {
    promises.push(
      sendWebhookAlert(channels.webhook, budgetName, threshold, percentUsed, spent, limit, currency, budget.id, budget.account_id, budget.user_id)
        .then(() => logNotification(budget.id, 'webhook', channels.webhook, 'sent'))
        .catch((err) => logNotification(budget.id, 'webhook', channels.webhook, 'failed', err.message))
    );
  }

  await Promise.allSettled(promises);
}

async function logNotification(
  budgetId: string,
  channel: string,
  recipient: string,
  status: 'sent' | 'failed',
  errorMsg?: string
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('notification_log')
    .insert({
      budget_id: budgetId,
      channel,
      recipient,
      status,
      error_msg: errorMsg || null,
    });

  if (error) {
    console.error('Failed to log notification:', error.message);
  }
}
