export type DeliveryStatus = 'pending' | 'delivering' | 'succeeded' | 'failed' | 'dead';

export interface Subscriber {
  id: string;
  name: string;
  targetUrl: string;
  eventTypes: string[];
  isActive: boolean;
  timeoutMs: number;
  maxRetries: number;
  rateLimitPerSec: number;
  previousSecretExpiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreatedSubscriber extends Subscriber {
  secret: string;
}

export interface DeliverySummary {
  deliveryId: string;
  status: DeliveryStatus;
  attemptCount: number;
  nextAttemptAt: string | null;
  createdAt: string;
  completedAt: string | null;
  event: { id: string; eventType: string; payload: Record<string, unknown> };
  subscriber: { id: string; name: string; targetUrl: string };
}

export interface DeliveryAttempt {
  id: string;
  attemptNumber: number;
  requestHeaders: Record<string, string>;
  responseStatus: number | null;
  responseBodyTruncated: string | null;
  latencyMs: number | null;
  errorMessage: string | null;
  attemptedAt: string;
}

export interface DeliveryDetail extends DeliverySummary {
  attempts: DeliveryAttempt[];
}

export interface Page<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface MetricsOverview {
  windowMinutes: number;
  byStatus: Record<string, number>;
  successRate: number | null;
  latencyMs: { p50: number | null; p95: number | null; p99: number | null };
  statusCodeDistribution: Record<string, number>;
}

export interface BulkRetryResult {
  retried: string[];
  notFound: string[];
}

export interface DeliveryStreamEvent {
  deliveryId: string;
  subscriberId: string;
  subscriberName: string;
  eventType: string;
  status: DeliveryStatus;
  attemptNumber: number;
  responseStatus: number | null;
  latencyMs: number | null;
  attemptedAt: string;
}
