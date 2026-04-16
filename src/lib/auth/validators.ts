import { z } from 'zod';

export const registerNumberSchema = z
  .string()
  .trim()
  .min(4, 'Register number must be at least 4 characters')
  .max(20, 'Register number must be at most 20 characters')
  .regex(/^[a-zA-Z0-9-]+$/, 'Register number can only contain letters, numbers, and hyphens');

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password is too long')
  .regex(/[A-Za-z]/, 'Password must include at least one letter')
  .regex(/[0-9]/, 'Password must include at least one number');

export const registerSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name must be at least 2 characters').max(80, 'Full name is too long'),
  registerNumber: registerNumberSchema,
  email: z.string().trim().email('Enter a valid email address'),
  password: passwordSchema,
});

export const loginSchema = z.object({
  registerNumber: registerNumberSchema,
  password: z.string().min(1, 'Password is required'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;