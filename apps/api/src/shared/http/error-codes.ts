import { BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';

/**
 * Stable, language-independent discriminator for every error body the API
 * can return. `message` stays in English (it's the HTTP contract for
 * integrators of any language); `code` is what a client-side UI translates
 * on top of it without parsing English prose.
 */
export type ErrorCode =
  | 'VALIDATION_FAILED'
  | 'SUBSCRIBER_NOT_FOUND'
  | 'DELIVERY_NOT_FOUND'
  | 'DEAD_DELIVERY_NOT_FOUND'
  | 'IDEMPOTENCY_KEY_REQUIRED'
  | 'IDEMPOTENCY_CONFLICT'
  | 'AUTH_HEADER_MISSING'
  | 'AUTH_KEY_INVALID'
  | 'TARGET_URL_INVALID'
  | 'TARGET_URL_UNSUPPORTED_PROTOCOL'
  | 'TARGET_URL_LOCALHOST'
  | 'TARGET_URL_PRIVATE_ADDRESS'
  | 'TARGET_URL_DNS_FAILED'
  | 'TARGET_URL_RESOLVES_PRIVATE';

/** Preserves the {statusCode, error, message} shape Nest generates for a plain-string NotFoundException, plus `code`. */
export function notFoundError(message: string, code: ErrorCode): NotFoundException {
  return new NotFoundException({ statusCode: 404, error: 'Not Found', message, code });
}

export function badRequestError(
  message: string,
  code: ErrorCode,
  details?: Record<string, unknown>,
): BadRequestException {
  return new BadRequestException({
    statusCode: 400,
    error: 'Bad Request',
    message,
    code,
    ...(details ? { details } : {}),
  });
}

export function unauthorizedError(message: string, code: ErrorCode): UnauthorizedException {
  return new UnauthorizedException({ statusCode: 401, error: 'Unauthorized', message, code });
}
