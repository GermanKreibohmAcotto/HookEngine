import { z } from 'zod';

/**
 * The process refuses to start if this doesn't parse — a missing or malformed
 * env var should fail loudly at boot, not surface as a 500 at 3am.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  HTTP_PORT: z.coerce.number().int().positive().default(3000),
  CORS_ORIGIN: z.string().min(1),

  DATABASE_URL: z.url(),
  REDIS_URL: z.url({ protocol: /^rediss?$/ }),

  INGEST_API_KEY: z.string().min(16, 'INGEST_API_KEY must be at least 16 characters'),

  /** 32-byte AES-256-GCM key, hex-encoded, used to encrypt subscriber secrets at rest. */
  SECRET_ENCRYPTION_KEY: z
    .string()
    .regex(
      /^[0-9a-fA-F]{64}$/,
      'SECRET_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)',
    ),

  WORKER_CONCURRENCY: z.coerce.number().int().positive().default(10),
  DELIVERY_DEFAULT_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
  DELIVERY_DEFAULT_MAX_RETRIES: z.coerce.number().int().positive().default(8),

  /** Consecutive-window 5xx/timeout failures before a subscriber's circuit trips open. */
  CIRCUIT_BREAKER_FAILURE_THRESHOLD: z.coerce.number().int().positive().default(5),
  /** Sliding window the failure count above is measured over. */
  CIRCUIT_BREAKER_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  /** How long the circuit stays open before allowing a single half-open probe. */
  CIRCUIT_BREAKER_COOLDOWN_MS: z.coerce.number().int().positive().default(30_000),

  /** How long a rotated-out subscriber secret keeps signing alongside the new one. */
  SECRET_ROTATION_GRACE_PERIOD_MS: z.coerce.number().int().positive().default(86_400_000),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(raw);

  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    console.error(`Invalid environment configuration, refusing to start:\n${issues}`);
    process.exit(1);
  }

  return result.data;
}
