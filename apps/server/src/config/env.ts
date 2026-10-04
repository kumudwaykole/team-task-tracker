import 'dotenv/config';
import { z } from 'zod';

const PLACEHOLDER_SECRET_PREFIX = 'replace-with';

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    DATABASE_URL: z.string().min(1),
    // Comma separated list of allowed CORS origins.
    CLIENT_URL: z
      .string()
      .min(1)
      .default('http://localhost:3000')
      .transform((value) =>
        value
          .split(',')
          .map((origin) => origin.trim())
          .filter(Boolean),
      ),
    JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
    JWT_EXPIRES_IN: z
      .string()
      .regex(/^\d+[smhd]$/, 'JWT_EXPIRES_IN must look like 15m, 12h or 1d')
      .default('1d'),
    BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(14).default(12),
  })
  .refine(
    (env) => env.NODE_ENV !== 'production' || !env.JWT_SECRET.startsWith(PLACEHOLDER_SECRET_PREFIX),
    { path: ['JWT_SECRET'], message: 'JWT_SECRET still has the placeholder value' },
  );

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:');
  for (const issue of parsed.error.issues) {
    console.error(`  ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = parsed.data;
export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
