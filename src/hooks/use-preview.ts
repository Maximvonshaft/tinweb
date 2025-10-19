import { useQuery } from '@tanstack/react-query';
import { useApiClient } from './use-api-client';
import type { FilePreviewData } from '@/types/api';

export function useDriveFilePreview(fileId: number | string | null, enabled = true) {
  const client = useApiClient();
  return useQuery({
    queryKey: ['drive-preview', fileId],
    enabled: Boolean(fileId) && enabled,
    queryFn: () => client<FilePreviewData>(`files/${fileId}/preview`),
  });
}
