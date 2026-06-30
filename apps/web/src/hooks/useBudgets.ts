import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../lib/api.js';

export interface BudgetActual {
  id: string;
  budget_id: string;
  period_date: string;
  actual: number;
  forecasted: number | null;
  synced_at: string;
}

export interface Budget {
  id: string;
  user_id: string;
  account_id: string;
  name: string;
  scope_type: string;
  scope_value: string | null;
  period: string;
  limit_amount: number;
  currency: string;
  alert_thresholds: number[];
  alert_channels: Record<string, any>;
  is_template: boolean;
  template_name: string | null;
  aws_budget_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface BudgetWithActuals extends Budget {
  actuals: BudgetActual[];
  currentActual: number;
  forecastedActual: number | null;
  percentUsed: number;
}

export function useBudgets(accountId: string | null) {
  const params = accountId ? `?accountId=${accountId}` : '';

  return useQuery<BudgetWithActuals[]>({
    queryKey: ['budgets', accountId],
    queryFn: () => apiRequest<BudgetWithActuals[]>(`/api/budgets${params}`),
    enabled: !!accountId,
    staleTime: 30_000,
    refetchInterval: 120_000,
  });
}

export function useCreateBudget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      accountId: string;
      name: string;
      scopeType: string;
      scopeValue?: string;
      period: string;
      limitAmount: number;
      currency?: string;
      alertThresholds?: number[];
      alertChannels?: Record<string, any>;
      syncToAws?: boolean;
    }) => apiRequest<Budget>('/api/budgets', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
    },
  });
}

export function useUpdateBudget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      apiRequest<Budget>(`/api/budgets/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
    },
  });
}

export function useDeleteBudget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      apiRequest<void>(`/api/budgets/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
    },
  });
}
