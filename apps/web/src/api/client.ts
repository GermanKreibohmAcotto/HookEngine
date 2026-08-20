import { translateApiError } from './errorMessages';

const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | undefined>;
}

export async function apiFetch<T>(
  apiKey: string,
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const url = new URL(path, API_BASE_URL);
  if (options.query) {
    for (const [key, value] of Object.entries(options.query)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }
  }

  const response = await fetch(url, {
    method: options.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const parsed: unknown = await response.json().catch(() => null);
    const code =
      parsed !== null &&
      typeof parsed === 'object' &&
      'code' in parsed &&
      typeof parsed.code === 'string'
        ? parsed.code
        : undefined;
    const details =
      parsed !== null &&
      typeof parsed === 'object' &&
      'details' in parsed &&
      typeof parsed.details === 'object' &&
      parsed.details !== null
        ? (parsed.details as Record<string, unknown>)
        : undefined;

    throw new ApiError(
      response.status,
      translateApiError(response.status, code, details),
      code,
      details,
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export function sseUrl(apiKey: string, path: string): string {
  const url = new URL(path, API_BASE_URL);
  url.searchParams.set('apiKey', apiKey);
  return url.toString();
}
