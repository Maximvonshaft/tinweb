import { useMutation } from '@tanstack/react-query';
import { useApiClient, ApiError } from './use-api-client';
import type { LoginResponse } from '@/types/api';

export interface LoginPayload {
  username: string;
  password: string;
}

export function useLoginMutation() {
  const client = useApiClient();
  return useMutation<LoginResponse, ApiError, LoginPayload>({
    mutationFn: (payload) =>
      client<LoginResponse>('auth/login', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
  });
}
