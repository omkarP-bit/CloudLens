export async function insertAuditLog(supabase, entry) {
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
