import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../lib/api.js';

export interface CompliancePolicy {
  id: string;
  user_id: string;
  account_id: string | null;
  name: string;
  description: string | null;
  is_builtin: boolean;
  enabled: boolean;
  framework: string | null;
  rule_definition: Record<string, unknown>;
  action: 'ALLOW' | 'DENY' | 'WARN';
  severity: 'low' | 'medium' | 'high' | 'critical';
  created_at: string;
  updated_at: string;
}

export interface ComplianceFinding {
  id: string;
  policy_id: string;
  account_id: string;
  resource_id: string;
  resource_type: string;
  region: string;
  status: 'PASS' | 'FAIL' | 'WARN' | 'SKIPPED';
  detail: string | null;
  scanned_at: string;
}

export interface ComplianceStats {
  totalPolicies: number;
  enabledPolicies: number;
  totalFindings: number;
  passCount: number;
  failCount: number;
  warnCount: number;
  skippedCount: number;
}

export function useCompliancePolicies(accountId: string | null) {
  const params = accountId ? `?accountId=${accountId}` : '';

  return useQuery<CompliancePolicy[]>({
    queryKey: ['compliance-policies', accountId],
    queryFn: () => apiRequest<CompliancePolicy[]>(`/api/compliance/policies${params}`),
    staleTime: 30_000,
  });
}

export function useCompliancePolicy(id: string) {
  return useQuery<CompliancePolicy>({
    queryKey: ['compliance-policy', id],
    queryFn: () => apiRequest<CompliancePolicy>(`/api/compliance/policies/${id}`),
    enabled: !!id,
  });
}

export function useCreateCompliancePolicy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      name: string;
      description?: string | null;
      framework?: string | null;
      accountId?: string | null;
      ruleDefinition: Record<string, unknown>;
      action: 'ALLOW' | 'DENY' | 'WARN';
      severity?: string;
    }) => apiRequest<CompliancePolicy>('/api/compliance/policies', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['compliance-policies'] });
    },
  });
}

export function useUpdateCompliancePolicy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      apiRequest<CompliancePolicy>(`/api/compliance/policies/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['compliance-policies'] });
      queryClient.invalidateQueries({ queryKey: ['compliance-policy'] });
    },
  });
}

export function useDeleteCompliancePolicy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      apiRequest<void>(`/api/compliance/policies/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['compliance-policies'] });
    },
  });
}

export function useComplianceFindings(
  accountId: string | null,
  options: { status?: string; limit?: number; offset?: number } = {}
) {
  const params = new URLSearchParams();
  if (accountId) params.set('accountId', accountId);
  if (options.status) params.set('status', options.status);
  if (options.limit) params.set('limit', String(options.limit));
  if (options.offset) params.set('offset', String(options.offset));

  return useQuery<{ findings: ComplianceFinding[]; total: number }>({
    queryKey: ['compliance-findings', accountId, options],
    queryFn: () => apiRequest(`/api/compliance/findings?${params.toString()}`),
    staleTime: 30_000,
  });
}

export function useComplianceStats(accountId: string | null) {
  const params = accountId ? `?accountId=${accountId}` : '';

  return useQuery<ComplianceStats>({
    queryKey: ['compliance-stats', accountId],
    queryFn: () => apiRequest<ComplianceStats>(`/api/compliance/stats${params}`),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}
