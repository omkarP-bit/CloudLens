import { supabaseAdmin } from '../../config/supabase.js';
export async function listPolicies(userId, accountId) {
    let query = supabaseAdmin
        .from('compliance_policies')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
    if (accountId) {
        query = query.eq('account_id', accountId);
    }
    const { data, error } = await query;
    if (error)
        throw error;
    return data || [];
}
export async function getPolicy(id, userId) {
    const { data, error } = await supabaseAdmin
        .from('compliance_policies')
        .select('*')
        .eq('id', id)
        .eq('user_id', userId)
        .maybeSingle();
    if (error)
        throw error;
    return data;
}
export async function createPolicy(userId, data) {
    const { data: policy, error } = await supabaseAdmin
        .from('compliance_policies')
        .insert({
        user_id: userId,
        account_id: data.account_id ?? null,
        name: data.name,
        description: data.description ?? null,
        framework: data.framework ?? null,
        rule_definition: data.rule_definition,
        action: data.action,
        severity: data.severity ?? 'medium',
    })
        .select()
        .single();
    if (error)
        throw error;
    return policy;
}
export async function updatePolicy(id, userId, data) {
    const updateData = { ...data, updated_at: new Date().toISOString() };
    const { data: policy, error } = await supabaseAdmin
        .from('compliance_policies')
        .update(updateData)
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .single();
    if (error)
        throw error;
    return policy;
}
export async function deletePolicy(id, userId) {
    const { error } = await supabaseAdmin
        .from('compliance_policies')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);
    if (error)
        throw error;
}
export async function listFindings(userId, options = {}) {
    let query = supabaseAdmin
        .from('compliance_findings')
        .select('*', { count: 'exact' })
        .order('scanned_at', { ascending: false });
    const limit = options.limit ?? 50;
    const offset = options.offset ?? 0;
    if (options.accountId) {
        query = query.eq('account_id', options.accountId);
    }
    if (options.policyId) {
        query = query.eq('policy_id', options.policyId);
    }
    if (options.status) {
        query = query.eq('status', options.status);
    }
    const { data, error, count } = await query.range(offset, offset + limit - 1);
    if (error)
        throw error;
    return { findings: data || [], total: count ?? 0 };
}
export async function insertFindings(findings) {
    const { error } = await supabaseAdmin
        .from('compliance_findings')
        .insert(findings);
    if (error)
        throw error;
}
export async function getComplianceStats(userId, accountId) {
    let policyQuery = supabaseAdmin
        .from('compliance_policies')
        .select('id, enabled', { count: 'exact', head: true })
        .eq('user_id', userId);
    if (accountId) {
        policyQuery = policyQuery.eq('account_id', accountId);
    }
    const { count: totalPolicies } = await policyQuery;
    let enabledQuery = supabaseAdmin
        .from('compliance_policies')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('enabled', true);
    if (accountId) {
        enabledQuery = enabledQuery.eq('account_id', accountId);
    }
    const { count: enabledPolicies } = await enabledQuery;
    let findingsBase = supabaseAdmin
        .from('compliance_findings')
        .select('status', { count: 'exact', head: true });
    if (accountId) {
        findingsBase = findingsBase.eq('account_id', accountId);
    }
    const { count: totalFindings } = await findingsBase;
    async function countByStatus(status) {
        let q = supabaseAdmin
            .from('compliance_findings')
            .select('id', { count: 'exact', head: true })
            .eq('status', status);
        if (accountId) {
            q = q.eq('account_id', accountId);
        }
        const { count } = await q;
        return count ?? 0;
    }
    return {
        totalPolicies: totalPolicies ?? 0,
        enabledPolicies: enabledPolicies ?? 0,
        totalFindings: totalFindings ?? 0,
        passCount: await countByStatus('PASS'),
        failCount: await countByStatus('FAIL'),
        warnCount: await countByStatus('WARN'),
        skippedCount: await countByStatus('SKIPPED'),
    };
}
