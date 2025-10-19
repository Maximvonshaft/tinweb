import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useApiClient } from './use-api-client';

interface UploadOptions {
  disk: string;
  parentId: string | null;
}

interface UploadResultItem {
  id: number | string;
  name: string;
  path: string;
}

interface UploadResponse {
  uploaded: UploadResultItem[];
}

export function useFileUpload() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useCallback(
    async (fileList: FileList | File[], options: UploadOptions): Promise<UploadResultItem[]> => {
      const files = Array.from(fileList);
      if (files.length === 0) {
        return [];
      }
      const formData = new FormData();
      if (options.disk) {
        formData.append('disk', options.disk);
      }
      if (options.parentId !== null && options.parentId !== undefined) {
        formData.append('parent_id', options.parentId);
      }
      for (const file of files) {
        formData.append('files', file);
      }
      const response = await client<UploadResponse>('files/upload', {
        method: 'POST',
        body: formData,
      });
      await queryClient.invalidateQueries({ queryKey: ['files'] });
      return response.uploaded;
    },
    [client, queryClient],
  );
}
