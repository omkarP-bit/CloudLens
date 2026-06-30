import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  evaluateAction,
  evaluateActionDry,
  evaluateCondition,
  evaluateRuleDefinition,
  getFieldValue,
  type ActionContext,
  type Condition,
  type RuleDefinition,
} from './policy-engine.service.js';

vi.mock('../../config/supabase.js', () => ({
  supabaseAdmin: {},
}));

function makeCtx(overrides: Partial<ActionContext> = {}): ActionContext {
  return {
    userId: 'user-1',
    accountId: 'acct-1',
    resourceType: 'EC2',
    resourceId: 'i-1234567890abcdef0',
    action: 'STOP',
    region: 'us-east-1',
    ...overrides,
  };
}

describe('getFieldValue', () => {
  const ctx = makeCtx();

  it('returns action', () => {
    expect(getFieldValue(ctx, 'action')).toBe('STOP');
  });

  it('returns resourceType', () => {
    expect(getFieldValue(ctx, 'resourceType')).toBe('EC2');
  });

  it('returns resourceId', () => {
    expect(getFieldValue(ctx, 'resourceId')).toBe('i-1234567890abcdef0');
  });

  it('returns region', () => {
    expect(getFieldValue(ctx, 'region')).toBe('us-east-1');
  });

  it('returns time as number', () => {
    const val = getFieldValue(ctx, 'time');
    expect(typeof val).toBe('number');
    expect(val).toBeGreaterThanOrEqual(0);
    expect(val).toBeLessThanOrEqual(23);
  });

  it('returns dayOfWeek as number', () => {
    const val = getFieldValue(ctx, 'dayOfWeek');
    expect(typeof val).toBe('number');
    expect(val).toBeGreaterThanOrEqual(0);
    expect(val).toBeLessThanOrEqual(6);
  });

  it('returns undefined for unknown field', () => {
    expect(getFieldValue(ctx, 'nonexistent')).toBeUndefined();
  });
});

describe('evaluateCondition', () => {
  const ctx = makeCtx();

  it('equals — matches', () => {
    expect(evaluateCondition(ctx, { field: 'action', operator: 'equals', value: 'STOP' })).toBe(true);
  });

  it('equals — no match', () => {
    expect(evaluateCondition(ctx, { field: 'action', operator: 'equals', value: 'TERMINATE' })).toBe(false);
  });

  it('not_equals — matches', () => {
    expect(evaluateCondition(ctx, { field: 'action', operator: 'not_equals', value: 'TERMINATE' })).toBe(true);
  });

  it('not_equals — no match', () => {
    expect(evaluateCondition(ctx, { field: 'action', operator: 'not_equals', value: 'STOP' })).toBe(false);
  });

  it('in — matches', () => {
    expect(evaluateCondition(ctx, { field: 'action', operator: 'in', value: ['STOP', 'TERMINATE'] })).toBe(true);
  });

  it('in — no match', () => {
    expect(evaluateCondition(ctx, { field: 'action', operator: 'in', value: ['START', 'REBOOT'] })).toBe(false);
  });

  it('not_in — matches', () => {
    expect(evaluateCondition(ctx, { field: 'region', operator: 'not_in', value: ['eu-west-1', 'ap-southeast-1'] })).toBe(true);
  });

  it('not_in — no match', () => {
    expect(evaluateCondition(ctx, { field: 'region', operator: 'not_in', value: ['us-east-1', 'eu-west-1'] })).toBe(false);
  });

  it('contains — matches', () => {
    expect(evaluateCondition(ctx, { field: 'resourceId', operator: 'contains', value: '1234567890' })).toBe(true);
  });

  it('contains — no match', () => {
    expect(evaluateCondition(ctx, { field: 'resourceId', operator: 'contains', value: 'zzzz' })).toBe(false);
  });

  it('starts_with — matches', () => {
    expect(evaluateCondition(ctx, { field: 'resourceId', operator: 'starts_with', value: 'i-' })).toBe(true);
  });

  it('starts_with — no match', () => {
    expect(evaluateCondition(ctx, { field: 'resourceId', operator: 'starts_with', value: 'vol-' })).toBe(false);
  });

  it('ends_with — matches', () => {
    expect(evaluateCondition(ctx, { field: 'resourceId', operator: 'ends_with', value: 'abcdef0' })).toBe(true);
  });

  it('ends_with — no match', () => {
    expect(evaluateCondition(ctx, { field: 'resourceId', operator: 'ends_with', value: 'xyz' })).toBe(false);
  });

  it('greater_than — matches', () => {
    const nightCtx = makeCtx();
    vi.setSystemTime(new Date('2025-01-01T20:00:00Z'));
    try {
      expect(evaluateCondition(nightCtx, { field: 'time', operator: 'greater_than', value: 18 })).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('greater_than — no match', () => {
    const morningCtx = makeCtx();
    vi.setSystemTime(new Date('2025-01-01T08:00:00Z'));
    try {
      expect(evaluateCondition(morningCtx, { field: 'time', operator: 'greater_than', value: 18 })).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('less_than — matches', () => {
    const morningCtx = makeCtx();
    vi.setSystemTime(new Date('2025-01-01T08:00:00Z'));
    try {
      expect(evaluateCondition(morningCtx, { field: 'time', operator: 'less_than', value: 18 })).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('less_than — no match', () => {
    const nightCtx = makeCtx();
    vi.setSystemTime(new Date('2025-01-01T20:00:00Z'));
    try {
      expect(evaluateCondition(nightCtx, { field: 'time', operator: 'less_than', value: 18 })).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('returns false for unknown operator', () => {
    expect(evaluateCondition(ctx, { field: 'action', operator: 'invalid_op', value: 'STOP' })).toBe(false);
  });

  it('handles dayOfWeek conditions', () => {
    vi.setSystemTime(new Date('2025-01-06T12:00:00Z'));
    const monday = makeCtx();
    try {
      expect(evaluateCondition(monday, { field: 'dayOfWeek', operator: 'equals', value: 1 })).toBe(true);
      expect(evaluateCondition(monday, { field: 'dayOfWeek', operator: 'equals', value: 0 })).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('evaluateRuleDefinition', () => {
  const ctx = makeCtx();

  it('returns true when no conditions (empty rule)', () => {
    expect(evaluateRuleDefinition(ctx, { conditions: {} })).toBe(true);
  });

  it('evaluates all conditions (AND) — all pass', () => {
    const def: RuleDefinition = {
      conditions: {
        all: [
          { field: 'action', operator: 'equals', value: 'STOP' },
          { field: 'region', operator: 'in', value: ['us-east-1', 'us-west-2'] },
        ],
      },
    };
    expect(evaluateRuleDefinition(ctx, def)).toBe(true);
  });

  it('evaluates all conditions (AND) — one fails', () => {
    const def: RuleDefinition = {
      conditions: {
        all: [
          { field: 'action', operator: 'equals', value: 'STOP' },
          { field: 'region', operator: 'equals', value: 'eu-west-1' },
        ],
      },
    };
    expect(evaluateRuleDefinition(ctx, def)).toBe(false);
  });

  it('evaluates any conditions (OR) — one passes', () => {
    const def: RuleDefinition = {
      conditions: {
        any: [
          { field: 'action', operator: 'equals', value: 'TERMINATE' },
          { field: 'region', operator: 'equals', value: 'us-east-1' },
        ],
      },
    };
    expect(evaluateRuleDefinition(ctx, def)).toBe(true);
  });

  it('evaluates any conditions (OR) — none pass', () => {
    const def: RuleDefinition = {
      conditions: {
        any: [
          { field: 'action', operator: 'equals', value: 'TERMINATE' },
          { field: 'region', operator: 'equals', value: 'eu-west-1' },
        ],
      },
    };
    expect(evaluateRuleDefinition(ctx, def)).toBe(false);
  });

  it('evaluates not conditions', () => {
    const def: RuleDefinition = {
      conditions: {
        not: {
          conditions: {
            all: [
              { field: 'action', operator: 'equals', value: 'TERMINATE' },
            ],
          },
        },
      },
    };
    expect(evaluateRuleDefinition(ctx, def)).toBe(true);
  });

  it('not condition — reverses match', () => {
    const def: RuleDefinition = {
      conditions: {
        not: {
          conditions: {
            all: [
              { field: 'action', operator: 'equals', value: 'STOP' },
            ],
          },
        },
      },
    };
    expect(evaluateRuleDefinition(ctx, def)).toBe(false);
  });

  it('complex nested rule with not', () => {
    const def: RuleDefinition = {
      conditions: {
        all: [
          { field: 'action', operator: 'in', value: ['STOP', 'TERMINATE'] },
        ],
        not: {
          conditions: {
            any: [
              { field: 'region', operator: 'equals', value: 'eu-west-1' },
              { field: 'resourceType', operator: 'equals', value: 'Lambda' },
            ],
          },
        },
      },
    };
    expect(evaluateRuleDefinition(ctx, def)).toBe(true);
  });

  it('complex nested rule that should not match', () => {
    const def: RuleDefinition = {
      conditions: {
        all: [
          { field: 'action', operator: 'in', value: ['STOP', 'TERMINATE'] },
        ],
        not: {
          conditions: {
            any: [
              { field: 'region', operator: 'equals', value: 'us-east-1' },
            ],
          },
        },
      },
    };
    expect(evaluateRuleDefinition(ctx, def)).toBe(false);
  });
});

describe('evaluateActionDry', () => {
  const ctx = makeCtx();

  it('returns null for non-matching policy', async () => {
    const policy = {
      id: 'pol-1',
      name: 'Block Terminations',
      rule_definition: { conditions: { all: [{ field: 'action', operator: 'equals', value: 'TERMINATE' }] } },
      action: 'DENY',
      severity: 'high',
      account_id: null,
    };
    const result = await evaluateActionDry(ctx, policy as any);
    expect(result).toBeNull();
  });

  it('returns PolicyResult for matching policy', async () => {
    const policy = {
      id: 'pol-1',
      name: 'Block Terminations',
      rule_definition: { conditions: { all: [{ field: 'action', operator: 'equals', value: 'STOP' }] } },
      action: 'DENY',
      severity: 'critical',
      account_id: null,
    };
    const result = await evaluateActionDry(ctx, policy as any);
    expect(result).not.toBeNull();
    expect(result!.result).toBe('DENY');
    expect(result!.matchedPolicyId).toBe('pol-1');
    expect(result!.matchedPolicyName).toBe('Block Terminations');
    expect(result!.severity).toBe('critical');
  });

  it('skips policy scoped to a different account', async () => {
    const policy = {
      id: 'pol-2',
      name: 'Other Account Policy',
      rule_definition: { conditions: { all: [{ field: 'action', operator: 'equals', value: 'STOP' }] } },
      action: 'DENY',
      severity: 'medium',
      account_id: 'acct-999',
    };
    const result = await evaluateActionDry(ctx, policy as any);
    expect(result).toBeNull();
  });

  it('matches policy scoped to the same account', async () => {
    const policy = {
      id: 'pol-3',
      name: 'This Account Policy',
      rule_definition: { conditions: { all: [{ field: 'action', operator: 'equals', value: 'STOP' }] } },
      action: 'WARN',
      severity: 'low',
      account_id: 'acct-1',
    };
    const result = await evaluateActionDry(ctx, policy as any);
    expect(result).not.toBeNull();
    expect(result!.result).toBe('WARN');
  });
});

describe('evaluateAction', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns ALLOW when no policies exist', async () => {
    const mockFrom = vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ data: [], error: null })),
      })),
    }));

    const supabaseModule = await import('../../config/supabase.js');
    (supabaseModule.supabaseAdmin as any).from = mockFrom;

    const result = await evaluateAction('user-1', 'acct-1', 'EC2', 'i-abc', 'STOP', 'us-east-1');
    expect(result.result).toBe('ALLOW');
    expect(result.reason).toContain('No policies defined');
  });

  it('returns ALLOW on fetch error', async () => {
    const mockFrom = vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ data: null, error: new Error('DB error') })),
      })),
    }));

    const supabaseModule = await import('../../config/supabase.js');
    (supabaseModule.supabaseAdmin as any).from = mockFrom;

    const result = await evaluateAction('user-1', 'acct-1', 'EC2', 'i-abc', 'STOP', 'us-east-1');
    expect(result.result).toBe('ALLOW');
    expect(result.reason).toContain('error');
  });

  it('returns the matched policy action', async () => {
    const policies = [
      {
        id: 'pol-deny',
        name: 'Block All Stops',
        rule_definition: { conditions: { all: [{ field: 'action', operator: 'equals', value: 'STOP' }] } },
        action: 'DENY',
        severity: 'high',
        account_id: null,
      },
    ];

    const mockFrom = vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ data: policies, error: null })),
      })),
    }));

    const supabaseModule = await import('../../config/supabase.js');
    (supabaseModule.supabaseAdmin as any).from = mockFrom;

    const result = await evaluateAction('user-1', 'acct-1', 'EC2', 'i-abc', 'STOP', 'us-east-1');
    expect(result.result).toBe('DENY');
    expect(result.matchedPolicyId).toBe('pol-deny');
    expect(result.reason).toContain('Block All Stops');
  });

  it('respects policy ordering — first match wins', async () => {
    const policies = [
      { id: 'pol-1', name: 'Allow EC2', rule_definition: { conditions: { all: [{ field: 'resourceType', operator: 'equals', value: 'EC2' }] } }, action: 'ALLOW', severity: 'low', account_id: null },
      { id: 'pol-2', name: 'Deny All', rule_definition: { conditions: { all: [] } }, action: 'DENY', severity: 'critical', account_id: null },
    ];

    const mockFrom = vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ data: policies, error: null })),
      })),
    }));

    const supabaseModule = await import('../../config/supabase.js');
    (supabaseModule.supabaseAdmin as any).from = mockFrom;

    const result = await evaluateAction('user-1', 'acct-1', 'EC2', 'i-abc', 'STOP', 'us-east-1');
    expect(result.result).toBe('ALLOW');
    expect(result.matchedPolicyId).toBe('pol-1');
  });

  it('skips policies scoped to other accounts', async () => {
    const policies = [
      { id: 'pol-other', name: 'Other Account', rule_definition: { conditions: { all: [] } }, action: 'DENY', severity: 'high', account_id: 'acct-999' },
    ];

    const mockFrom = vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ data: policies, error: null })),
      })),
    }));

    const supabaseModule = await import('../../config/supabase.js');
    (supabaseModule.supabaseAdmin as any).from = mockFrom;

    const result = await evaluateAction('user-1', 'acct-1', 'EC2', 'i-abc', 'STOP', 'us-east-1');
    expect(result.result).toBe('ALLOW');
    expect(result.reason).toContain('No matching policies');
  });
});
