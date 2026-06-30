import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../lib/api.js';

export interface CostSummary {
  totalMtd: number;
  forecastedMonthEnd: number;
  currency: string;
}

export interface DailyTrend {
  date: string;
  amount: number;
}

export interface ServiceCost {
  service: string;
  amount: number;
  percentage: number;
}

export interface TopService extends ServiceCost {
  previousAmount: number;
  change: number;
}

export function useCostSummary(accountId: string | null) {
  return useQuery<CostSummary>({
    queryKey: ['costs', 'summary', accountId],
    queryFn: () =>
      apiRequest<CostSummary>(`/api/costs/summary?accountId=${accountId}`),
    enabled: !!accountId,
    staleTime: 60_000,
    refetchInterval: 300_000,
  });
}

export function useCostTrends(accountId: string | null, days: number = 30) {
  return useQuery<DailyTrend[]>({
    queryKey: ['costs', 'trends', accountId, days],
    queryFn: () =>
      apiRequest<DailyTrend[]>(`/api/costs/trends?accountId=${accountId}&days=${days}`),
    enabled: !!accountId,
    staleTime: 60_000,
    refetchInterval: 300_000,
  });
}

export function useServiceBreakdown(accountId: string | null) {
  return useQuery<ServiceCost[]>({
    queryKey: ['costs', 'breakdown', accountId],
    queryFn: () =>
      apiRequest<ServiceCost[]>(`/api/costs/breakdown?accountId=${accountId}`),
    enabled: !!accountId,
    staleTime: 60_000,
    refetchInterval: 300_000,
  });
}

export function useTopServices(accountId: string | null, limit: number = 10) {
  return useQuery<TopService[]>({
    queryKey: ['costs', 'top-services', accountId, limit],
    queryFn: () =>
      apiRequest<TopService[]>(`/api/costs/top-services?accountId=${accountId}&limit=${limit}`),
    enabled: !!accountId,
    staleTime: 60_000,
    refetchInterval: 300_000,
  });
}
