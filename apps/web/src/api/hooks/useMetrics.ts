import { useQuery } from '@tanstack/react-query';

import { useRequiredApiKey } from '../../auth/ApiKeyContext';
import { apiFetch } from '../client';
import type { MetricsOverview } from '../types';

export function useMetrics(windowMinutes = 60) {
  const apiKey = useRequiredApiKey();
  return useQuery({
    queryKey: ['metrics', windowMinutes],
    queryFn: () =>
      apiFetch<MetricsOverview>(apiKey, '/api/v1/metrics/overview', { query: { windowMinutes } }),
    refetchInterval: 15_000,
  });
}
