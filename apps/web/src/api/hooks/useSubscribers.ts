import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useRequiredApiKey } from '../../auth/ApiKeyContext';
import { apiFetch } from '../client';
import type { CreatedSubscriber, Subscriber } from '../types';

export interface SubscriberInput {
  name: string;
  targetUrl: string;
  eventTypes: string[];
  timeoutMs?: number;
  maxRetries?: number;
  rateLimitPerSec?: number;
}

export type SubscriberPatch = Partial<SubscriberInput> & { isActive?: boolean };

export function useSubscribers() {
  const apiKey = useRequiredApiKey();
  return useQuery({
    queryKey: ['subscribers'],
    queryFn: () => apiFetch<Subscriber[]>(apiKey, '/api/v1/subscribers'),
  });
}

export function useCreateSubscriber() {
  const apiKey = useRequiredApiKey();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SubscriberInput) =>
      apiFetch<CreatedSubscriber>(apiKey, '/api/v1/subscribers', { method: 'POST', body: input }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['subscribers'] });
    },
  });
}

export function useUpdateSubscriber() {
  const apiKey = useRequiredApiKey();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: SubscriberPatch }) =>
      apiFetch<Subscriber>(apiKey, `/api/v1/subscribers/${id}`, { method: 'PATCH', body: patch }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['subscribers'] });
    },
  });
}

export function useDeleteSubscriber() {
  const apiKey = useRequiredApiKey();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(apiKey, `/api/v1/subscribers/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['subscribers'] });
    },
  });
}

export function useRotateSecret() {
  const apiKey = useRequiredApiKey();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<CreatedSubscriber>(apiKey, `/api/v1/subscribers/${id}/rotate-secret`, {
        method: 'POST',
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['subscribers'] });
    },
  });
}
