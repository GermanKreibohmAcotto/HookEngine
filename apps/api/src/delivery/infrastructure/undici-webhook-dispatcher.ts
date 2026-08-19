import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { request } from 'undici';

import type { Env } from '../../shared/config/env.schema';
import { parseEncryptionKey } from '../../subscriptions/domain/webhook-secret';
import type {
  DispatchContext,
  DispatchResult,
  WebhookDispatcher,
} from '../application/ports/webhook-dispatcher.port';
import { buildSignatureHeader } from '../domain/build-signature-header';
import { classifyNetworkError, classifyResponse } from '../domain/delivery-outcome';

const MAX_RESPONSE_BODY_BYTES = 8 * 1024;

@Injectable()
export class UndiciWebhookDispatcher implements WebhookDispatcher {
  constructor(private readonly config: ConfigService<Env, true>) {}

  async dispatch({ delivery, event, subscriber }: DispatchContext): Promise<DispatchResult> {
    const key = parseEncryptionKey(this.config.get('SECRET_ENCRYPTION_KEY', { infer: true }));
    const body = JSON.stringify(event.payload);
    const { timestamp, signatureHeader } = buildSignatureHeader(body, subscriber, key);

    const requestHeaders: Record<string, string> = {
      'content-type': 'application/json',
      'x-webhook-id': delivery.id,
      'x-webhook-event': event.eventType,
      'x-webhook-timestamp': String(timestamp),
      'x-webhook-signature': signatureHeader,
    };

    const startedAt = Date.now();

    try {
      const response = await request(subscriber.targetUrl, {
        method: 'POST',
        headers: requestHeaders,
        body,
        // No `maxRedirections` here — undici's base request() never follows
        // redirects unless you add its opt-in redirect interceptor, which we
        // deliberately don't: a redirect is the obvious way to bypass the
        // SSRF guard applied at subscriber registration.
        headersTimeout: subscriber.timeoutMs,
        bodyTimeout: subscriber.timeoutMs,
      });

      const responseBodyTruncated = await readBodyTruncated(response.body);
      const latencyMs = Date.now() - startedAt;
      const retryAfter = response.headers['retry-after'];

      return {
        requestHeaders,
        responseStatus: response.statusCode,
        responseBodyTruncated,
        latencyMs,
        outcome: classifyResponse(
          response.statusCode,
          Array.isArray(retryAfter) ? retryAfter[0] : retryAfter,
        ),
      };
    } catch (error) {
      return {
        requestHeaders,
        responseStatus: null,
        responseBodyTruncated: null,
        latencyMs: Date.now() - startedAt,
        outcome: classifyNetworkError(error),
      };
    }
  }
}

async function readBodyTruncated(body: AsyncIterable<Uint8Array>): Promise<string> {
  const chunks: Buffer[] = [];
  let total = 0;

  // Breaking out of a Node Readable's async iterator early triggers its
  // built-in cleanup (calls .return(), destroys the stream) — no manual
  // drain/dump needed.
  for await (const chunk of body) {
    chunks.push(Buffer.from(chunk));
    total += chunk.length;
    if (total >= MAX_RESPONSE_BODY_BYTES) break;
  }

  return Buffer.concat(chunks).subarray(0, MAX_RESPONSE_BODY_BYTES).toString('utf8');
}
