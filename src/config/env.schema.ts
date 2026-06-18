import { z } from 'zod';

/**
 * Schema for all environment variables the application depends on.
 * Validated once at startup so the rest of the codebase can trust the values.
 */
export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3000),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),
  CONVERSATION_STATE_TTL: z.coerce.number().int().positive().default(86400),

  WHATSAPP_PROVIDER: z.enum(['mock', 'meta']).default('mock'),
  WHATSAPP_VERIFY_TOKEN: z.string().default('local_verify_token'),
  WHATSAPP_ACCESS_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),

  LLM_PROVIDER: z.enum(['openai', 'mock']).default('openai'),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),
  LLM_MIN_CONFIDENCE: z.coerce.number().min(0).max(1).default(0.6),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Validates `process.env` against the schema. Throws a readable error and
 * aborts startup if anything required is missing or malformed.
 */
export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }

  // Cross-field checks that depend on the selected providers.
  const env = parsed.data;
  if (env.LLM_PROVIDER === 'openai' && !env.OPENAI_API_KEY) {
    throw new Error(
      'LLM_PROVIDER=openai requires OPENAI_API_KEY to be set. ' +
        'Set LLM_PROVIDER=mock for offline development.',
    );
  }
  if (
    env.WHATSAPP_PROVIDER === 'meta' &&
    (!env.WHATSAPP_ACCESS_TOKEN || !env.WHATSAPP_PHONE_NUMBER_ID)
  ) {
    throw new Error(
      'WHATSAPP_PROVIDER=meta requires WHATSAPP_ACCESS_TOKEN and ' +
        'WHATSAPP_PHONE_NUMBER_ID to be set.',
    );
  }

  return env;
}
