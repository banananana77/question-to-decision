import 'server-only';
import { z } from 'zod';

const envSchema = z.object({
  ANTHROPIC_API_KEY: z.string().min(1, 'ANTHROPIC_API_KEY is required'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Optional overrides
  DEMO_MAX_REQUESTS_PER_DAY: z.string().optional(),
  DEMO_MAX_TOKENS_PER_REQUEST: z.string().optional(),
});

type Env = z.infer<typeof envSchema>;

let env: Env;

export function getEnv(): Env {
  if (!env) {
    const parsed = envSchema.safeParse(process.env);
    if (!parsed.success) {
      console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors);
      throw new Error('Invalid environment variables');
    }
    env = parsed.data;
  }
  return env;
}

// Helper functions
export const isDev = () => getEnv().NODE_ENV === 'development';
export const isProd = () => getEnv().NODE_ENV === 'production';
