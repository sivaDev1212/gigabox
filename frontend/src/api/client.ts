import axios from 'axios';
import type { ApiError } from '../types';

export const api = axios.create({
  baseURL: '/api',
});

export function toApiError(error: unknown): ApiError {
  if (axios.isAxiosError(error)) {
    const payload = error.response?.data as { error?: ApiError } | undefined;
    if (payload?.error) return payload.error;
    return { code: 'NETWORK_ERROR', message: error.message };
  }
  return { code: 'NETWORK_ERROR', message: 'Request failed' };
}
