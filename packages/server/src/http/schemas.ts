import { CHEAT_SCENARIOS } from '@gem-rush/shared';
import { z } from 'zod';
import { AppError } from '../application/errors.js';

export const SpinRequestSchema = z.object({
  bet: z.number().int().positive(),
  cheat: z.enum(CHEAT_SCENARIOS).optional(),
});

/** Parses untrusted input, converting validation failures into a 400. */
export function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new AppError('BAD_REQUEST', z.prettifyError(result.error));
  }
  return result.data;
}
