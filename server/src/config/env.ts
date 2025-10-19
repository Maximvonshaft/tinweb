import { config as loadEnv } from 'dotenv';
import { z } from 'zod';

loadEnv();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.string().transform((value) => Number.parseInt(value, 10)).default('4000'),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(16),
  JWT_EXPIRES_IN: z.string().transform((value) => Number.parseInt(value, 10)).default('3600'),
  DEFAULT_TENANT: z.string().default('default')
});

const parsed = envSchema.safeParse({
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.PORT ?? '4000',
  DATABASE_URL: process.env.DATABASE_URL ?? 'file:./dev.db',
  JWT_SECRET: process.env.JWT_SECRET ?? 'change-me-change-me',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN ?? '3600',
  DEFAULT_TENANT: process.env.DEFAULT_TENANT ?? 'default'
});

if (!parsed.success) {
  console.error('环境变量校验失败', parsed.error.flatten().fieldErrors);
  throw new Error('Invalid environment configuration');
}

export const env = parsed.data;
