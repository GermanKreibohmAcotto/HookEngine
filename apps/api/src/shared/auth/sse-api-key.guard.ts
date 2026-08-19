import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Env } from '../config/env.schema';
import { timingSafeEqualStrings } from './api-key.guard';

interface RequestWithAuth {
  headers: Record<string, string | undefined>;
  query: Record<string, string | undefined>;
}

/**
 * The browser's native EventSource can't set an Authorization header, so the
 * SSE stream alone accepts the key as `?apiKey=`. Every other endpoint keeps
 * using ApiKeyGuard (header-only) — query strings end up in logs and referrer
 * headers, so this fallback is deliberately not available anywhere else.
 */
@Injectable()
export class SseApiKeyGuard implements CanActivate {
  constructor(private readonly config: ConfigService<Env, true>) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithAuth>();
    const header = request.headers.authorization;
    const presented = header?.startsWith('Bearer ')
      ? header.slice('Bearer '.length)
      : request.query.apiKey;

    if (!presented) {
      throw new UnauthorizedException('Missing API key');
    }

    const expected = this.config.get('INGEST_API_KEY', { infer: true });
    if (!timingSafeEqualStrings(presented, expected)) {
      throw new UnauthorizedException('Invalid API key');
    }

    return true;
  }
}
