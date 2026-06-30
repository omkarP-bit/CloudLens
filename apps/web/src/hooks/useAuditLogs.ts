import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase.js';
import { apiRequest } from '../lib/api.js';

export interface AuditLogEntry {
  id: string;
  user_id: string | null;
  account_id: string;
  action: string;
  resource_type: string;
  resource_id: string;
  region: string;
  policy_result: 'ALLOW' | 'DENY' | 'WARN';
  policy_reason: string | null;
  request_ip: string | null;
  user_agent: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

interface AuditLogsResponse {
  logs: AuditLogEntry[];
  total: number;
  offset: number;
  limit: number;
}

export function useAuditLogs(accountId?: string | null) {
  const [realtimeLogs, setRealtimeLogs] = useState<AuditLogEntry[]>([]);

  const query = useQuery<AuditLogsResponse>({
    queryKey: ['audit-logs', accountId],
    queryFn: () => {
      const params = new URLSearchParams({ limit: '50', offset: '0' });
      if (accountId) params.set('accountId', accountId);
      return apiRequest<AuditLogsResponse>(`/api/audit-logs?${params.toString()}`);
    },
    staleTime: 30_000,
  });

  useEffect(() => {
    const channel = supabase
      .channel('audit-logs-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'audit_logs' },
        (payload) => {
          setRealtimeLogs((prev) => [payload.new as AuditLogEntry, ...prev].slice(0, 50));
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, []);

  const allLogs = [...realtimeLogs, ...(query.data?.logs || [])].filter(
    (log, index, self) => self.findIndex((l) => l.id === log.id) === index
  );

  return {
    logs: allLogs,
    total: query.data?.total || 0,
    isLoading: query.isLoading,
    error: query.error,
  };
}
