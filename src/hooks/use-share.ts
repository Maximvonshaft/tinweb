import { useMutation, useQuery } from '@tanstack/react-query';
import { ApiError } from './use-api-client';
import type { ShareDetail, ShareUnlockResponse, ShareDownloadInfo } from '@/types/api';

async function requestShare<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
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
}

export function useShareDetail(token: string | undefined) {
  return useQuery({
    queryKey: ['share', token],
    enabled: Boolean(token),
    queryFn: () => requestShare<ShareDetail>(`/s/${token}`),
  });
}

export function useShareUnlock(token: string | undefined) {
  return useMutation({
    mutationFn: (payload: { password: string }) =>
      requestShare<ShareUnlockResponse>(`/s/${token}/unlock`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
  });
}

export async function fetchShareDownload(token: string, sessionToken: string | null) {
  return requestShare<ShareDownloadInfo>(`/s/${token}/download`, {
    headers: sessionToken ? { 'X-Share-Session': sessionToken } : undefined,
  });
}
