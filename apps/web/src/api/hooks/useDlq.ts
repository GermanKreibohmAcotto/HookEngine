import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useRequiredApiKey } from '../../auth/ApiKeyContext';
import { apiFetch } from '../client';
import type { BulkRetryResult, DeliverySummary, Page } from '../types';

export function useDlq(limit = 50, offset = 0) {
  const apiKey = useRequiredApiKey();
  return useQuery({
    queryKey: ['dlq', limit, offset],
    queryFn: () =>
      apiFetch<Page<DeliverySummary>>(apiKey, '/api/v1/dlq', { query: { limit, offset } }),
    placeholderData: (previous) => previous,
  });
}

function invalidateDlq(queryClient: ReturnType<typeof useQueryClient>): void {
  void queryClient.invalidateQueries({ queryKey: ['dlq'] });
  void queryClient.invalidateQueries({ queryKey: ['deliveries'] });
}

export function useRetryDeadLetter() {
  const apiKey = useRequiredApiKey();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (deliveryId: string) =>
      apiFetch<{ retried: true }>(apiKey, `/api/v1/dlq/${deliveryId}/retry`, { method: 'POST' }),
    onSuccess: () => invalidateDlq(queryClient),
  });
}

export function useBulkRetryDeadLetters() {
  const apiKey = useRequiredApiKey();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (deliveryIds: string[]) =>
      apiFetch<BulkRetryResult>(apiKey, '/api/v1/dlq/bulk-retry', {
        method: 'POST',
        body: { deliveryIds },
      }),
    onSuccess: () => invalidateDlq(queryClient),
  });
}
