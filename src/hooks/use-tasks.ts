import { useQuery } from '@tanstack/react-query';
import { useApiClient } from './use-api-client';
import type { TaskStatus } from '@/types/api';

export function useTaskStatusQuery(taskId: string, enabled = true) {
  const client = useApiClient();
  return useQuery<TaskStatus, Error, TaskStatus, readonly ['task', string]>({
    queryKey: ['task', taskId] as const,
    enabled,
    queryFn: () => client<TaskStatus>(`tasks/${taskId}`),
    refetchInterval: (data: TaskStatus | undefined) => {
      if (!data) return 2000;
      if (data.status === 'succeed' || data.status === 'failed') return false;
      return 2000;
    },
    retry: (failureCount, error) => {
      if ((error as { status?: number }).status === 404) return false;
      return failureCount < 3;
    },
  });
}
