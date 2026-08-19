export type DeliveryStatus = 'pending' | 'delivering' | 'succeeded' | 'failed' | 'dead';

export interface Delivery {
  readonly id: string;
  readonly eventId: string;
  readonly subscriberId: string;
  readonly status: DeliveryStatus;
  readonly attemptCount: number;
  readonly nextAttemptAt: Date | null;
  readonly createdAt: Date;
  readonly completedAt: Date | null;
}
