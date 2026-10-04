import { z } from 'zod';

// Trim and lowercase before checking the format, so " Asha@Example.com " is accepted and stored normalized.
const email = z.string().trim().toLowerCase().pipe(z.email('Invalid email').max(255));

// bcrypt ignores everything after 72 bytes, so cap the length in bytes as well as characters.
const newPassword = z
  .string()
  .min(8, 'Must be at least 8 characters')
  .max(72, 'Must be at most 72 characters')
  .refine((value) => Buffer.byteLength(value, 'utf8') <= 72, 'Password is too long')
  .regex(/[a-z]/, 'Must contain a lowercase letter')
  .regex(/[A-Z]/, 'Must contain an uppercase letter')
  .regex(/[0-9]/, 'Must contain a digit');

// `.strict()` rejects unknown fields, e.g. a client sending `"role": "ADMIN"` at register.
export const registerSchema = z
  .object({
    name: z.string().trim().min(2, 'Must be at least 2 characters').max(100),
    email,
    password: newPassword,
  })
  .strict();

export const loginSchema = z
  .object({
    email,
    password: z.string().min(1, 'Password is required').max(72),
  })
  .strict();

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
