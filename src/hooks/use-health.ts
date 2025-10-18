import { useQuery } from '@tanstack/react-query';
import { useApiClient } from './use-api-client';
import type { HealthSummary } from '@/types/api';

export function useHealthQuery() {
  const client = useApiClient();
  return useQuery({
    queryKey: ['health'],
    queryFn: () => client<HealthSummary>('health'),
    staleTime: 60_000,
  });
}
