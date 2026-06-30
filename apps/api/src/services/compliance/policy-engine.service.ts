import { supabaseAdmin } from '../../config/supabase.js';

export interface PolicyResult {
  result: 'ALLOW' | 'DENY' | 'WARN';
  reason: string;
  matchedPolicyId?: string;
  matchedPolicyName?: string;
  severity?: string;
}

export interface Condition {
  field: string;
  operator: string;
  value: unknown;
}

export interface RuleDefinition {
  conditions: {
    all?: Condition[];
    any?: Condition[];
    not?: RuleDefinition;
  };
}

export interface ActionContext {
  userId: string;
  accountId: string;
  resourceType: string;
  resourceId: string;
  action: string;
  region: string;
}

export function getFieldValue(ctx: ActionContext, field: string): unknown {
  switch (field) {
    case 'action': return ctx.action;
    case 'resourceType': return ctx.resourceType;
    case 'resourceId': return ctx.resourceId;
    case 'region': return ctx.region;
    case 'time': {
      const now = new Date();
      return now.getUTCHours();
    }
    case 'dayOfWeek': {
      return new Date().getUTCDay();
    }
    default: return undefined;
  }
}

export function evaluateCondition(ctx: ActionContext, condition: Condition): boolean {
  const fieldValue = getFieldValue(ctx, condition.field);
  const { operator, value } = condition;

  switch (operator) {
    case 'equals':
      return fieldValue === value;
    case 'not_equals':
      return fieldValue !== value;
    case 'in':
      return Array.isArray(value) && value.includes(fieldValue);
    case 'not_in':
      return Array.isArray(value) && !value.includes(fieldValue);
    case 'contains':
      return typeof fieldValue === 'string' && typeof value === 'string' && fieldValue.includes(value);
    case 'starts_with':
      return typeof fieldValue === 'string' && typeof value === 'string' && fieldValue.startsWith(value);
    case 'ends_with':
      return typeof fieldValue === 'string' && typeof value === 'string' && fieldValue.endsWith(value);
    case 'greater_than':
      return typeof fieldValue === 'number' && typeof value === 'number' && fieldValue > value;
    case 'less_than':
      return typeof fieldValue === 'number' && typeof value === 'number' && fieldValue < value;
    default:
      return false;
  }
}

export function evaluateRuleDefinition(ctx: ActionContext, def: RuleDefinition): boolean {
  if (def.conditions.not) {
    return !evaluateRuleDefinition(ctx, def.conditions.not);
  }

  if (def.conditions.all) {
    return def.conditions.all.every((c) => evaluateCondition(ctx, c));
  }

  if (def.conditions.any) {
    return def.conditions.any.some((c) => evaluateCondition(ctx, c));
  }

  return true;
}

export async function evaluateAction(
  userId: string,
  accountId: string,
  resourceType: string,
  resourceId: string,
  action: string,
  region: string
): Promise<PolicyResult> {
  const ctx: ActionContext = { userId, accountId, resourceType, resourceId, action, region };

  const { data: policies, error } = await supabaseAdmin
    .from('compliance_policies')
    .select('id, name, rule_definition, action, severity, account_id')
    .eq('enabled', true);

  if (error) {
    console.error('[PolicyEngine] Failed to fetch policies:', error);
    return { result: 'ALLOW', reason: 'Policy engine error — defaulting to allow' };
  }

  if (!policies || policies.length === 0) {
    return { result: 'ALLOW', reason: 'No policies defined — all actions allowed' };
  }

  for (const policy of policies) {
    if (policy.account_id && policy.account_id !== accountId) continue;

    try {
      const def = policy.rule_definition as RuleDefinition;
      const matched = evaluateRuleDefinition(ctx, def);

      if (matched) {
        return {
          result: policy.action as 'ALLOW' | 'DENY' | 'WARN',
          reason: `Matched policy "${policy.name}" — ${policy.action}`,
          matchedPolicyId: policy.id,
          matchedPolicyName: policy.name,
          severity: policy.severity,
        };
      }
    } catch (err) {
      console.error(`[PolicyEngine] Error evaluating policy "${policy.name}":`, err);
      continue;
    }
  }

  return { result: 'ALLOW', reason: 'No matching policies — default allow' };
}

export async function evaluateActionDry(
  ctx: ActionContext,
  policy: { id: string; name: string; rule_definition: RuleDefinition; action: string; severity: string; account_id: string | null }
): Promise<PolicyResult | null> {
  if (policy.account_id && policy.account_id !== ctx.accountId) return null;

  try {
    const matched = evaluateRuleDefinition(ctx, policy.rule_definition);

    if (matched) {
      return {
        result: policy.action as 'ALLOW' | 'DENY' | 'WARN',
        reason: `Matched policy "${policy.name}" — ${policy.action}`,
        matchedPolicyId: policy.id,
        matchedPolicyName: policy.name,
        severity: policy.severity,
      };
    }
  } catch (err) {
    console.error(`[PolicyEngine] Error evaluating policy "${policy.name}":`, err);
  }

  return null;
}
