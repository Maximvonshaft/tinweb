import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApiClient } from './use-api-client';
import type { FileItem, FileListResponse } from '@/types/api';
import type { ApiError } from './use-api-client';

export interface FilesQueryInput {
  disk: string;
  parentId: string | number | null;
  deleted?: boolean;
  search?: string;
}

function buildQuery(params: Record<string, unknown>): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    search.set(key, String(value));
  });
  return search.toString();
}

export function useFilesQuery(params: FilesQueryInput) {
  const client = useApiClient();

  return useInfiniteQuery<FileListResponse, ApiError>({
    queryKey: ['files', params],
    initialPageParam: '',
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
    queryFn: async ({ pageParam }) => {
      const query = buildQuery({
        disk: params.disk,
        parent_id: params.parentId,
        deleted: params.deleted ? 'true' : undefined,
        q: params.search,
        cursor: pageParam || undefined,
      });
      const endpoint = query ? `files?${query}` : 'files';
      return client<FileListResponse>(endpoint);
    },
  });
}

export function useCreateFolderMutation() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { name: string; disk: string; parent_id: string | number | null }) =>
      client<FileItem>('files/folders', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['files'] });
    },
  });
}

export function useRenameMutation(id: string | number) {
  const client = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { name: string }) =>
      client<FileItem>(`files/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['files'] });
    },
  });
}

export function useDeleteMutation() {
  const client = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { id: string | number; force?: boolean }) =>
      client<null>(`files/${payload.id}${payload.force ? '?force=true' : ''}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['files'] });
    },
  });
}

export function useRestoreMutation() {
  const client = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { id: string | number }) =>
      client<FileItem>(`files/restore/${payload.id}`, {
        method: 'POST',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['files'] });
    },
  });
}
