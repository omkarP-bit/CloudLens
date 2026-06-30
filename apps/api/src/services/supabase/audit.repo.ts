import type { SupabaseClient } from '@supabase/supabase-js';

export interface AuditLogEntry {
  user_id?: string | null;
  account_id: string;
  action: string;
  resource_type: string;
  resource_id: string;
  region: string;
  policy_result: 'ALLOW' | 'DENY' | 'WARN';
  policy_reason?: string;
  request_ip?: string;
  user_agent?: string;
  metadata?: Record<string, unknown>;
}

export async function insertAuditLog(supabase: SupabaseClient, entry: AuditLogEntry): Promise<void> {
  const { error } = await supabase.from('audit_logs').insert({
    user_id: entry.user_id ?? null,
    account_id: entry.account_id,
    action: entry.action,
    resource_type: entry.resource_type,
    resource_id: entry.resource_id,
    region: entry.region,
    policy_result: entry.policy_result,
    policy_reason: entry.policy_reason ?? null,
    request_ip: entry.request_ip ?? null,
    user_agent: entry.user_agent ?? null,
    metadata: entry.metadata ?? {},
  });

  if (error) {
    console.error('[AuditRepo] insert failed:', error);
  }
}
