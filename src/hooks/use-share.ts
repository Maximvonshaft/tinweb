import { useCallback } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ApiError } from './use-api-client';
import { useAppConfig } from '@/providers/config-provider';
import type { ShareDetail, ShareUnlockResponse, ShareDownloadInfo } from '@/types/api';

function buildShareUrl(base: string, path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${base.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
}

function useShareRequest() {
  const { SHARE_API_BASE_URL } = useAppConfig();

  return useCallback(
    async <T>(path: string, init?: RequestInit): Promise<T> => {
      const response = await fetch(buildShareUrl(SHARE_API_BASE_URL, path), {
        headers: {
          'Content-Type': 'application/json',
          ...(init?.headers ?? {}),
        },
        ...init,
      });
      const text = await response.text();
      const payload = text ? (JSON.parse(text) as { code: number; message: string; data: T }) : null;
      if (!response.ok || !payload || payload.code !== 0) {
        throw new ApiError(payload?.message ?? response.statusText, response.status, payload?.code);
      }
      return payload.data;
    },
    [SHARE_API_BASE_URL],
  );
}

export function useShareDetail(token: string | undefined) {
  const requestShare = useShareRequest();
  return useQuery({
    queryKey: ['share', token],
    enabled: Boolean(token),
    queryFn: () => requestShare<ShareDetail>(`s/${token}`),
  });
}

export function useShareUnlock(token: string | undefined) {
  const requestShare = useShareRequest();
  return useMutation({
    mutationFn: (payload: { password: string }) =>
      requestShare<ShareUnlockResponse>(`s/${token}/unlock`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
  });
}

export function useShareDownload() {
  const requestShare = useShareRequest();

  return useCallback(
    (token: string, sessionToken: string | null) =>
      requestShare<ShareDownloadInfo>(`s/${token}/download`, {
        headers: sessionToken ? { 'X-Share-Session': sessionToken } : undefined,
      }),
    [requestShare],
  );
}
