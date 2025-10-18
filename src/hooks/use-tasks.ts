import { useQuery } from '@tanstack/react-query';
import { useApiClient } from './use-api-client';
import type { TaskStatus } from '@/types/api';

export function useTaskStatusQuery(taskId: string, enabled = true) {
  const client = useApiClient();
  return useQuery({
    queryKey: ['task', taskId],
    enabled,
    queryFn: () => client<TaskStatus>(`tasks/${taskId}`),
    refetchInterval: (query) => {
      const currentStatus = query.state.data?.status;
      if (!currentStatus) return 2000;
      if (currentStatus === 'succeed' || currentStatus === 'failed') return false;
      return 2000;
    },
    retry: (failureCount, error) => {
      if ((error as { status?: number }).status === 404) return false;
      return failureCount < 3;
    },
  });
}
