import { describe, expect, it, vi } from 'vitest';

import { validateEnv } from './env.schema';

const validEnv = {
  NODE_ENV: 'test',
  HTTP_PORT: '3000',
  CORS_ORIGIN: 'http://localhost:5173',
  DATABASE_URL: 'postgres://user:pass@localhost:5432/db',
  REDIS_URL: 'redis://localhost:6379',
  INGEST_API_KEY: 'a'.repeat(32),
  SECRET_ENCRYPTION_KEY: '0'.repeat(64),
};

describe('validateEnv', () => {
  it('parses a valid environment and applies defaults', () => {
    const env = validateEnv(validEnv);

    expect(env.HTTP_PORT).toBe(3000);
    expect(env.WORKER_CONCURRENCY).toBe(10);
    expect(env.DELIVERY_DEFAULT_MAX_RETRIES).toBe(8);
    expect(env.LOG_LEVEL).toBe('info');
  });

  it('exits the process when a required var is missing', () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    validateEnv({ ...validEnv, DATABASE_URL: undefined });

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalled();

    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('rejects a SECRET_ENCRYPTION_KEY that is not 64 hex characters', () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    validateEnv({ ...validEnv, SECRET_ENCRYPTION_KEY: 'not-hex' });

    expect(exitSpy).toHaveBeenCalledWith(1);
    exitSpy.mockRestore();
  });
});
