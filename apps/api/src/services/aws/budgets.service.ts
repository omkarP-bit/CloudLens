import {
  BudgetsClient,
  CreateBudgetCommand,
  UpdateBudgetCommand,
  DescribeBudgetCommand,
  DeleteBudgetCommand,
  type Budget,
} from '@aws-sdk/client-budgets';
import type { AWSCredentials } from '../supabase/accounts.repo.js';

function buildClient(creds: AWSCredentials) {
  return new BudgetsClient({
    region: 'us-east-1',
    credentials: {
      accessKeyId: creds.accessKeyId,
      secretAccessKey: creds.secretAccessKey,
      sessionToken: creds.sessionToken,
    },
  });
}

function isMock(creds: AWSCredentials): boolean {
  return creds.accessKeyId.startsWith('mock_') || creds.secretAccessKey.startsWith('mock_');
}

function mapPeriodToAws(period: string): 'DAILY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY' {
  const map: Record<string, 'DAILY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY'> = {
    DAILY: 'DAILY',
    MONTHLY: 'MONTHLY',
    QUARTERLY: 'QUARTERLY',
    ANNUALLY: 'ANNUALLY',
  };
  return map[period] || 'MONTHLY';
}

export async function syncBudgetToAws(
  creds: AWSCredentials,
  accountId: string,
  budgetName: string,
  limitAmount: number,
  period: string,
  existingAwsBudgetId: string | null
): Promise<string | null> {
  if (isMock(creds)) {
    return `mock-aws-budget-${Date.now()}`;
  }

  try {
    const client = buildClient(creds);
    const budgetPeriod = mapPeriodToAws(period);
    const awsAccountId = accountId;

    const budget: Budget = {
      BudgetName: budgetName,
      BudgetLimit: {
        Amount: String(limitAmount),
        Unit: 'USD',
      },
      TimeUnit: budgetPeriod,
      BudgetType: 'COST',
      CostFilters: {},
      CostTypes: {
        IncludeTax: true,
        IncludeSubscription: true,
        UseBlended: true,
        IncludeRefund: false,
        IncludeCredit: false,
        IncludeSupport: true,
        IncludeDiscount: true,
        IncludeOtherSubscription: true,
        IncludeUpfront: true,
        IncludeRecurring: true,
      },
      TimePeriod: {
        Start: new Date(`${new Date().toISOString().slice(0, 7)}-01`),
      },
    };

    if (existingAwsBudgetId) {
      await client.send(new UpdateBudgetCommand({
        AccountId: awsAccountId,
        NewBudget: budget,
      }));
      return existingAwsBudgetId;
    }

    await client.send(new CreateBudgetCommand({
      AccountId: awsAccountId,
      Budget: budget,
      NotificationsWithSubscribers: [],
    }));

    return budgetName;
  } catch (err: any) {
    console.warn('AWS Budgets sync failed (non-blocking):', err.message);
    return existingAwsBudgetId || `local-${Date.now()}`;
  }
}

export async function deleteAwsBudget(
  creds: AWSCredentials,
  awsBudgetId: string
): Promise<void> {
  if (isMock(creds)) return;

  try {
    const client = buildClient(creds);
    await client.send(new DeleteBudgetCommand({
      AccountId: (creds as any).awsAccountId || '',
      BudgetName: awsBudgetId,
    }));
  } catch (err: any) {
    console.warn('AWS Budgets delete failed (non-blocking):', err.message);
  }
}
