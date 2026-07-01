export async function sendSlackAlert(
  webhookUrl: string,
  budgetName: string,
  threshold: number,
  percentUsed: number,
  spent: number,
  limit: number,
  currency: string
): Promise<void> {
  const payload = {
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: `🚨 Budget Alert: ${budgetName}`, emoji: true },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Threshold:*\n${threshold}%` },
          { type: 'mrkdwn', text: `*Usage:*\n${percentUsed}%` },
          { type: 'mrkdwn', text: `*Spent:*\n${currency} ${spent.toLocaleString()}` },
          { type: 'mrkdwn', text: `*Limit:*\n${currency} ${limit.toLocaleString()}` },
        ],
      },
    ],
  };

  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`Slack webhook returned ${res.status}: ${await res.text()}`);
  }
}
