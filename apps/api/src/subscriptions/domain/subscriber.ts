export interface Subscriber {
  readonly id: string;
  readonly name: string;
  readonly targetUrl: string;
  readonly secretEncrypted: string;
  /** Set during the grace period after a secret rotation; deliveries sign with both. */
  readonly previousSecretEncrypted: string | null;
  readonly previousSecretExpiresAt: Date | null;
  readonly eventTypes: readonly string[];
  readonly isActive: boolean;
  readonly timeoutMs: number;
  readonly maxRetries: number;
  readonly rateLimitPerSec: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface NewSubscriber {
  readonly name: string;
  readonly targetUrl: string;
  readonly secretEncrypted: string;
  readonly eventTypes: readonly string[];
  readonly timeoutMs?: number | undefined;
  readonly maxRetries?: number | undefined;
  readonly rateLimitPerSec?: number | undefined;
}

export interface SubscriberPatch {
  readonly name?: string | undefined;
  readonly targetUrl?: string | undefined;
  readonly eventTypes?: readonly string[] | undefined;
  readonly isActive?: boolean | undefined;
  readonly timeoutMs?: number | undefined;
  readonly maxRetries?: number | undefined;
  readonly rateLimitPerSec?: number | undefined;
}
