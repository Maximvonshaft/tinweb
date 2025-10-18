import { useCallback } from 'react';
import { useAppConfig } from '@/providers/config-provider';
import { useAuthStore } from '@/stores/auth';

export interface Envelope<T> {
  code: number;
  message: string;
  data: T;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function buildUrl(base: string, path: string): string {
  if (path.startsWith('http')) return path;
  return `${base.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
}

export function useApiClient() {
  const { API_BASE_URL } = useAppConfig();
  const token = useAuthStore((state) => state.accessToken);

  return useCallback(
    async <T>(path: string, init: RequestInit = {}): Promise<T> => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 45_000);
      try {
        const response = await fetch(buildUrl(API_BASE_URL, path), {
          ...init,
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            ...(init.headers ?? {}),
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });

        const text = await response.text();
        const payload = text ? (JSON.parse(text) as Envelope<T>) : ({} as Envelope<T>);

        if (!response.ok || (payload.code !== undefined && payload.code !== 0)) {
          throw new ApiError(payload.message ?? response.statusText, response.status, payload.code);
        }

        return payload.data;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          throw new ApiError('请求超时', 408);
        }
        if (error instanceof ApiError) throw error;
        throw new ApiError((error as Error).message ?? '未知错误', 500);
      } finally {
        clearTimeout(timeout);
      }
    },
    [API_BASE_URL, token],
  );
}
