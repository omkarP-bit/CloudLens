import { BudgetsClient, CreateBudgetCommand, UpdateBudgetCommand, DeleteBudgetCommand, } from '@aws-sdk/client-budgets';
function buildClient(creds) {
    return new BudgetsClient({
        region: 'us-east-1',
        credentials: {
            accessKeyId: creds.accessKeyId,
            secretAccessKey: creds.secretAccessKey,
            sessionToken: creds.sessionToken,
        },
    });
}
function isMock(creds) {
    return creds.accessKeyId.startsWith('mock_') || creds.secretAccessKey.startsWith('mock_');
}
function mapPeriodToAws(period) {
    const map = {
        DAILY: 'DAILY',
        MONTHLY: 'MONTHLY',
        QUARTERLY: 'QUARTERLY',
        ANNUALLY: 'ANNUALLY',
    };
    return map[period] || 'MONTHLY';
}
export async function syncBudgetToAws(creds, accountId, budgetName, limitAmount, period, existingAwsBudgetId) {
    if (isMock(creds)) {
        return `mock-aws-budget-${Date.now()}`;
    }
    try {
        const client = buildClient(creds);
        const budgetPeriod = mapPeriodToAws(period);
        const awsAccountId = accountId;
        const budget = {
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
    }
    catch (err) {
        console.warn('AWS Budgets sync failed (non-blocking):', err.message);
        return existingAwsBudgetId || `local-${Date.now()}`;
    }
}
export async function deleteAwsBudget(creds, awsBudgetId) {
    if (isMock(creds))
        return;
    try {
        const client = buildClient(creds);
        await client.send(new DeleteBudgetCommand({
            AccountId: creds.awsAccountId || '',
            BudgetName: awsBudgetId,
        }));
    }
    catch (err) {
        console.warn('AWS Budgets delete failed (non-blocking):', err.message);
    }
}
