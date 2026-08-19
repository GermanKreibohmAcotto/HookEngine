export interface DeliveryAttempt {
  readonly id: string;
  readonly deliveryId: string;
  readonly attemptNumber: number;
  readonly requestHeaders: Record<string, string>;
  readonly responseStatus: number | null;
  readonly responseBodyTruncated: string | null;
  readonly latencyMs: number | null;
  readonly errorMessage: string | null;
  readonly attemptedAt: Date;
}
