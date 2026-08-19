import { type ArgumentsHost, Catch, type ExceptionFilter, HttpStatus } from '@nestjs/common';

import { IdempotencyConflictError } from '../../events/domain/idempotency-conflict.error';
import { UnsafeTargetUrlError } from '../../subscriptions/domain/target-url';

interface MinimalResponse {
  status(code: number): { json(body: unknown): void };
}

type HandledDomainError = UnsafeTargetUrlError | IdempotencyConflictError;

/**
 * Translates domain invariant violations into HTTP responses in one place,
 * so use cases and repositories can just throw the domain error and stay
 * ignorant of HTTP status codes.
 */
@Catch(UnsafeTargetUrlError, IdempotencyConflictError)
export class DomainErrorFilter implements ExceptionFilter {
  catch(error: HandledDomainError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<MinimalResponse>();
    const status =
      error instanceof UnsafeTargetUrlError
        ? HttpStatus.BAD_REQUEST
        : HttpStatus.UNPROCESSABLE_ENTITY;

    response.status(status).json({ message: error.message, error: error.name });
  }
}
