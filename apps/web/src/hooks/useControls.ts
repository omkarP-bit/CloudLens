import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../lib/api.js';

export interface ActionResponse {
  success: boolean;
  message: string;
  action: string;
  resourceType: string;
  resourceId: string;
  region: string;
}

interface ExecuteActionParams {
  resourceType: string;
  resourceId: string;
  action: 'STOP' | 'START' | 'TERMINATE' | 'REBOOT';
  accountId: string;
  region: string;
}

export function useControls() {
  const queryClient = useQueryClient();

  const executeMutation = useMutation<ActionResponse, Error, ExecuteActionParams>({
    mutationFn: ({ resourceType, resourceId, action, accountId, region }) =>
      apiRequest<ActionResponse>(`/api/controls/${resourceType}/${resourceId}/action`, {
        method: 'POST',
        body: JSON.stringify({ action, accountId, region }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
    },
  });

  return {
    executeAction: executeMutation.mutateAsync,
    isExecuting: executeMutation.isPending,
    lastResult: executeMutation.data,
    error: executeMutation.error,
    reset: executeMutation.reset,
  };
}
