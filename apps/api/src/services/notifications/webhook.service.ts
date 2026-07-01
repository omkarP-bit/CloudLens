export async function sendWebhookAlert(
  webhookUrl: string,
  budgetName: string,
  threshold: number,
  percentUsed: number,
  spent: number,
  limit: number,
  currency: string,
  budgetId: string,
  accountId: string,
  userId: string
): Promise<void> {
  const payload = {
    event: 'budget_alert',
    budgetId,
    accountId,
    userId,
    budgetName,
    threshold,
    percentUsed,
    spent,
    limit,
    currency,
    timestamp: new Date().toISOString(),
  };

  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`Webhook returned ${res.status}: ${await res.text()}`);
  }
}
