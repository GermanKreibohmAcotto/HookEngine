import { useQuery } from '@tanstack/react-query';

import { useRequiredApiKey } from '../../auth/ApiKeyContext';
import { apiFetch } from '../client';
import type { DeliveryDetail, DeliveryStatus, DeliverySummary, Page } from '../types';

export interface DeliveryFilter {
  status?: DeliveryStatus;
  subscriberId?: string;
  limit?: number;
  offset?: number;
}

export function useDeliveries(filter: DeliveryFilter) {
  const apiKey = useRequiredApiKey();
  return useQuery({
    queryKey: ['deliveries', filter],
    queryFn: () =>
      apiFetch<Page<DeliverySummary>>(apiKey, '/api/v1/deliveries', {
        query: {
          status: filter.status,
          subscriberId: filter.subscriberId,
          limit: filter.limit ?? 50,
          offset: filter.offset ?? 0,
        },
      }),
    placeholderData: (previous) => previous,
  });
}

export function useDelivery(id: string | null) {
  const apiKey = useRequiredApiKey();
  return useQuery({
    queryKey: ['delivery', id],
    queryFn: () => apiFetch<DeliveryDetail>(apiKey, `/api/v1/deliveries/${id}`),
    enabled: id !== null,
  });
}
