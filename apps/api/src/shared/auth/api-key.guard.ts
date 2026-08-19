import { timingSafeEqual } from 'node:crypto';

import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Env } from '../config/env.schema';

interface RequestWithHeaders {
  headers: Record<string, string | undefined>;
}

export function timingSafeEqualStrings(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) {
    // Compare against itself anyway so a length mismatch doesn't return faster
    // than a same-length mismatch and leak the expected key's length via timing.
    timingSafeEqual(bufferA, bufferA);
    return false;
  }
  return timingSafeEqual(bufferA, bufferB);
}

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly config: ConfigService<Env, true>) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithHeaders>();
    const header = request.headers.authorization;

    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or malformed Authorization header');
    }

    const presented = header.slice('Bearer '.length);
    const expected = this.config.get('INGEST_API_KEY', { infer: true });

    if (!timingSafeEqualStrings(presented, expected)) {
      throw new UnauthorizedException('Invalid API key');
    }

    return true;
  }
}
