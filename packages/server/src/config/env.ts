import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const defaultClientDist = fileURLToPath(new URL('../../../client/dist', import.meta.url));

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().min(0).max(65535).default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  /** Demo credits for new sessions, in cents. */
  STARTING_BALANCE: z.coerce.number().int().positive().default(100_000),
  SESSION_IDLE_MINUTES: z.coerce.number().positive().default(120),
  /** Comma-separated list of allowed origins; unset = same-origin only. */
  CORS_ORIGIN: z.string().optional(),
  /** Built client to serve as static files; skipped when the folder is absent. */
  CLIENT_DIST: z.string().default(defaultClientDist),
});

export type Env = z.infer<typeof EnvSchema>;

/** Fails fast at boot with a readable message instead of misbehaving at runtime. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    throw new Error(`Invalid environment configuration:\n${z.prettifyError(parsed.error)}`);
  }
  return parsed.data;
}
