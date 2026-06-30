import { CostExplorerClient, GetCostAndUsageCommand, } from '@aws-sdk/client-cost-explorer';
function formatDate(d) {
    return d.toISOString().slice(0, 10);
}
function firstOfMonth(d = new Date()) {
    return formatDate(new Date(d.getFullYear(), d.getMonth(), 1));
}
function today() {
    return formatDate(new Date());
}
function daysAgo(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return formatDate(d);
}
function extractAmount(metrics) {
    if (!metrics)
        return 0;
    const amt = metrics.BlendedCost?.Amount || metrics.UnblendedCost?.Amount || metrics.AmortizedCost?.Amount;
    if (amt) {
        const parsed = parseFloat(amt);
        if (!isNaN(parsed))
            return parsed;
    }
    const firstKey = Object.keys(metrics)[0];
    if (firstKey) {
        const parsed = parseFloat(metrics[firstKey]?.Amount || '0');
        if (!isNaN(parsed))
            return parsed;
    }
    return 0;
}
function buildClient(creds) {
    return new CostExplorerClient({
        region: 'us-east-1',
        credentials: {
            accessKeyId: creds.accessKeyId,
            secretAccessKey: creds.secretAccessKey,
            sessionToken: creds.sessionToken,
        },
    });
}
async function fetchCostAndUsage(creds, input) {
    if (creds.accessKeyId.startsWith('mock_') || creds.secretAccessKey.startsWith('mock_')) {
        return [];
    }
    const { Start, End } = input.TimePeriod;
    if (Start && End && Start >= End) {
        return [];
    }
    const client = buildClient(creds);
    const command = new GetCostAndUsageCommand(input);
    const response = await client.send(command);
    const resultsByTime = response.ResultsByTime || [];
    const amounts = [];
    for (const period of resultsByTime) {
        const total = period.Groups
            ? period.Groups.reduce((sum, g) => {
                return sum + extractAmount(g.Metrics);
            }, 0)
            : extractAmount(period.Total);
        amounts.push({ time: period.TimePeriod?.Start || '', amount: total });
    }
    return amounts;
}
async function fetchGroupedCost(creds, input) {
    if (creds.accessKeyId.startsWith('mock_') || creds.secretAccessKey.startsWith('mock_')) {
        return [];
    }
    const { Start, End } = input.TimePeriod;
    if (Start && End && Start >= End) {
        return [];
    }
    const client = buildClient(creds);
    const command = new GetCostAndUsageCommand(input);
    const response = await client.send(command);
    const groups = [];
    for (const period of response.ResultsByTime || []) {
        for (const group of period.Groups || []) {
            const service = group.Keys?.[0] || 'Unknown';
            const amount = extractAmount(group.Metrics);
            const existing = groups.find((g) => g.service === service);
            if (existing) {
                existing.amount += amount;
            }
            else {
                groups.push({ service, amount });
            }
        }
    }
    return groups;
}
export async function getCostSummary(creds) {
    if (creds.accessKeyId.startsWith('mock_') || creds.secretAccessKey.startsWith('mock_')) {
        return {
            totalMtd: 3412.88,
            forecastedMonthEnd: 5200.0,
            currency: 'USD',
        };
    }
    const start = firstOfMonth();
    const end = today();
    const amounts = await fetchCostAndUsage(creds, {
        TimePeriod: { Start: start, End: end },
        Granularity: 'MONTHLY',
        Metrics: ['BlendedCost', 'UnblendedCost', 'AmortizedCost'],
    });
    const totalMtd = amounts.length > 0 ? amounts[0].amount : 0;
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const dayOfMonth = now.getDate();
    const forecastedMonthEnd = dayOfMonth > 0
        ? Math.round((totalMtd / dayOfMonth) * daysInMonth * 100) / 100
        : 0;
    return { totalMtd, forecastedMonthEnd, currency: 'USD' };
}
export async function getDailyTrends(creds, days = 30) {
    if (creds.accessKeyId.startsWith('mock_') || creds.secretAccessKey.startsWith('mock_')) {
        const now = new Date();
        const trends = [];
        for (let i = days - 1; i >= 0; i--) {
            const d = new Date(now);
            d.setDate(d.getDate() - i);
            trends.push({
                date: formatDate(d),
                amount: Math.round((Math.random() * 200 + 50) * 100) / 100,
            });
        }
        return trends;
    }
    const amounts = await fetchCostAndUsage(creds, {
        TimePeriod: { Start: daysAgo(days), End: today() },
        Granularity: 'DAILY',
        Metrics: ['BlendedCost', 'UnblendedCost', 'AmortizedCost'],
    });
    return amounts.map((a) => ({ date: a.time, amount: a.amount }));
}
export async function getServiceBreakdown(creds) {
    if (creds.accessKeyId.startsWith('mock_') || creds.secretAccessKey.startsWith('mock_')) {
        const services = [
            { service: 'Amazon EC2', amount: 1820.50 },
            { service: 'Amazon S3', amount: 612.30 },
            { service: 'AWS Lambda', amount: 345.10 },
            { service: 'Amazon RDS', amount: 280.40 },
            { service: 'Amazon ECS', amount: 198.20 },
            { service: 'Amazon ElastiCache', amount: 95.60 },
            { service: 'AWS CloudWatch', amount: 42.80 },
            { service: 'Other', amount: 17.98 },
        ];
        const total = services.reduce((s, x) => s + x.amount, 0);
        return services.map((s) => ({
            ...s,
            percentage: Math.round((s.amount / total) * 10000) / 100,
        }));
    }
    const start = firstOfMonth();
    const end = today();
    const groups = await fetchGroupedCost(creds, {
        TimePeriod: { Start: start, End: end },
        Granularity: 'MONTHLY',
        Metrics: ['BlendedCost', 'UnblendedCost', 'AmortizedCost'],
        GroupBy: [{ Type: 'DIMENSION', Key: 'SERVICE' }],
    });
    const total = groups.reduce((s, g) => s + g.amount, 0);
    return groups
        .map((g) => ({
        service: g.service,
        amount: Math.round(g.amount * 100) / 100,
        percentage: total > 0 ? Math.round((g.amount / total) * 10000) / 100 : 0,
    }))
        .sort((a, b) => b.amount - a.amount);
}
const CREDIT_RECORD_TYPES = new Set(['Credit', 'Refund', 'Discount']);
function extractCreditAmount(groups) {
    let total = 0;
    for (const g of groups) {
        if (g.Keys?.some((k) => CREDIT_RECORD_TYPES.has(k))) {
            total += extractAmount(g.Metrics);
        }
    }
    return Math.abs(total);
}
export async function getCredits(creds) {
    if (creds.accessKeyId.startsWith('mock_') || creds.secretAccessKey.startsWith('mock_')) {
        return { totalCreditsMtd: 245.30 };
    }
    const start = firstOfMonth();
    const end = today();
    const groups = await fetchGroupedCost(creds, {
        TimePeriod: { Start: start, End: end },
        Granularity: 'MONTHLY',
        Metrics: ['UnblendedCost'],
        GroupBy: [{ Type: 'DIMENSION', Key: 'RECORD_TYPE' }],
    });
    let total = 0;
    for (const g of groups) {
        if (CREDIT_RECORD_TYPES.has(g.service)) {
            total += Math.abs(g.amount);
        }
    }
    return { totalCreditsMtd: Math.round(total * 100) / 100 };
}
export async function getDailyCredits(creds, days = 30) {
    if (creds.accessKeyId.startsWith('mock_') || creds.secretAccessKey.startsWith('mock_')) {
        const now = new Date();
        const data = [];
        for (let i = days - 1; i >= 0; i--) {
            const d = new Date(now);
            d.setDate(d.getDate() - i);
            data.push({
                date: formatDate(d),
                amount: Math.round(Math.random() * 30 * 100) / 100,
            });
        }
        return data;
    }
    const client = buildClient(creds);
    const command = new GetCostAndUsageCommand({
        TimePeriod: { Start: daysAgo(days), End: today() },
        Granularity: 'DAILY',
        Metrics: ['UnblendedCost'],
        GroupBy: [{ Type: 'DIMENSION', Key: 'RECORD_TYPE' }],
    });
    const response = await client.send(command);
    const credits = [];
    for (const period of response.ResultsByTime || []) {
        if (!period.Groups)
            continue;
        const creditAmt = extractCreditAmount(period.Groups);
        if (creditAmt > 0) {
            credits.push({ date: period.TimePeriod?.Start || '', amount: creditAmt });
        }
    }
    return credits;
}
export async function getTopServices(creds, limit = 10) {
    if (creds.accessKeyId.startsWith('mock_') || creds.secretAccessKey.startsWith('mock_')) {
        const services = [
            { service: 'Amazon EC2', amount: 1820.50, previousAmount: 1750.20 },
            { service: 'Amazon S3', amount: 612.30, previousAmount: 580.10 },
            { service: 'AWS Lambda', amount: 345.10, previousAmount: 310.40 },
            { service: 'Amazon RDS', amount: 280.40, previousAmount: 295.60 },
            { service: 'Amazon ECS', amount: 198.20, previousAmount: 210.50 },
            { service: 'Amazon ElastiCache', amount: 95.60, previousAmount: 88.30 },
            { service: 'AWS CloudWatch', amount: 42.80, previousAmount: 39.10 },
            { service: 'Other', amount: 17.98, previousAmount: 22.45 },
        ];
        return services.map((s) => ({
            ...s,
            percentage: Math.round((s.amount / services.reduce((sum, x) => sum + x.amount, 0)) * 10000) / 100,
            change: s.previousAmount > 0
                ? Math.round(((s.amount - s.previousAmount) / s.previousAmount) * 10000) / 100
                : 0,
        }));
    }
    const currentStart = firstOfMonth();
    const end = today();
    const prevMonth = new Date();
    prevMonth.setMonth(prevMonth.getMonth() - 1);
    const prevStart = firstOfMonth(prevMonth);
    const prevEnd = formatDate(new Date(prevMonth.getFullYear(), prevMonth.getMonth() + 1, 0));
    const [currentGroups, previousGroups] = await Promise.all([
        fetchGroupedCost(creds, {
            TimePeriod: { Start: currentStart, End: end },
            Granularity: 'MONTHLY',
            Metrics: ['BlendedCost', 'UnblendedCost', 'AmortizedCost'],
            GroupBy: [{ Type: 'DIMENSION', Key: 'SERVICE' }],
        }),
        fetchGroupedCost(creds, {
            TimePeriod: { Start: prevStart, End: prevEnd },
            Granularity: 'MONTHLY',
            Metrics: ['BlendedCost', 'UnblendedCost', 'AmortizedCost'],
            GroupBy: [{ Type: 'DIMENSION', Key: 'SERVICE' }],
        }),
    ]);
    const prevMap = new Map(previousGroups.map((g) => [g.service, g.amount]));
    const currentTotal = currentGroups.reduce((s, g) => s + g.amount, 0);
    return currentGroups
        .map((g) => {
        const prevAmt = prevMap.get(g.service) || 0;
        return {
            service: g.service,
            amount: Math.round(g.amount * 100) / 100,
            percentage: currentTotal > 0 ? Math.round((g.amount / currentTotal) * 10000) / 100 : 0,
            previousAmount: Math.round(prevAmt * 100) / 100,
            change: prevAmt > 0
                ? Math.round(((g.amount - prevAmt) / prevAmt) * 10000) / 100
                : 0,
        };
    })
        .sort((a, b) => b.amount - a.amount)
        .slice(0, limit);
}
