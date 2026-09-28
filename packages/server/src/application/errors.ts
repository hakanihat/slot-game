import type { ApiErrorCode } from '@gem-rush/shared';

const STATUS_BY_CODE: Record<ApiErrorCode, number> = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  INSUFFICIENT_FUNDS: 402,
  INVALID_BET: 422,
  REFILL_NOT_ALLOWED: 409,
  NOT_FOUND: 404,
  FORBIDDEN: 403,
  BONUS_IN_PROGRESS: 409,
  NO_BONUS: 409,
  INVALID_PICK: 422,
  INTERNAL: 500,
};

/** An expected, client-facing failure. Anything else is treated as a 500. */
export class AppError extends Error {
  readonly statusCode: number;

  constructor(
    readonly code: ApiErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = STATUS_BY_CODE[code];
  }
}
