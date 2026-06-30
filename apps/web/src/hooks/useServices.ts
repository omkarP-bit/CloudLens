import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../lib/api.js';

export type ResourceType = 'EC2' | 'RDS' | 'ECS' | 'Lambda' | 'S3' | 'ElastiCache';

export interface Resource {
  id: string;
  type: ResourceType;
  name: string;
  region: string;
  state: string;
  accountId: string;
  metadata: Record<string, any>;
  estimatedMonthlyCost: number | null;
  tags: Record<string, string>;
  launchTime: string | null;
}

export interface ServicesResponse {
  resources: Resource[];
  total: number;
  cachedAt: string;
}

interface UseServicesOptions {
  accountId: string | null;
  region?: string;
  type?: ResourceType;
  state?: string;
}

export function useServices(options: UseServicesOptions) {
  const { accountId, region, type, state } = options;

  const params = new URLSearchParams();
  if (accountId) params.set('accountId', accountId);
  if (region) params.set('region', region);
  if (type) params.set('type', type);
  if (state) params.set('state', state);

  return useQuery<ServicesResponse>({
    queryKey: ['services', accountId, region, type, state],
    queryFn: () => apiRequest<ServicesResponse>(`/api/services?${params.toString()}`),
    enabled: !!accountId,
    staleTime: 60_000,
    refetchInterval: 300_000,
  });
}
