import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../lib/api.js';

export interface ScheduledAction {
  id: string;
  user_id: string;
  account_id: string;
  name: string;
  resource_type: 'EC2' | 'RDS' | 'ECS' | 'Lambda';
  resource_id: string;
  action: 'STOP' | 'START' | 'TERMINATE' | 'REBOOT';
  cron_expression: string;
  timezone: string;
  enabled: boolean;
  last_run_at: string | null;
  last_run_status: string | null;
  created_at: string;
}

interface CreateScheduledActionParams {
  account_id: string;
  name: string;
  resource_type: string;
  resource_id: string;
  action: string;
  cron_expression: string;
  timezone?: string;
}

export function useScheduledActions() {
  const queryClient = useQueryClient();

  const listQuery = useQuery<ScheduledAction[]>({
    queryKey: ['scheduled-actions'],
    queryFn: () => apiRequest<ScheduledAction[]>('/api/scheduled-actions'),
    staleTime: 30_000,
  });

  const createMutation = useMutation<ScheduledAction, Error, CreateScheduledActionParams>({
    mutationFn: (params) =>
      apiRequest<ScheduledAction>('/api/scheduled-actions', {
        method: 'POST',
        body: JSON.stringify(params),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-actions'] });
    },
  });

  const toggleMutation = useMutation<ScheduledAction, Error, string>({
    mutationFn: (id) =>
      apiRequest<ScheduledAction>(`/api/scheduled-actions/${id}/toggle`, {
        method: 'PATCH',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-actions'] });
    },
  });

  const deleteMutation = useMutation<void, Error, string>({
    mutationFn: (id) =>
      apiRequest<void>(`/api/scheduled-actions/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-actions'] });
    },
  });

  return {
    actions: listQuery.data || [],
    isLoading: listQuery.isLoading,
    error: listQuery.error,
    create: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    toggle: toggleMutation.mutateAsync,
    isToggling: toggleMutation.isPending,
    remove: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
  };
}
