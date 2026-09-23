import { z } from 'zod';

export const sendInvitationSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  full_name: z.string().trim().min(1).max(120).optional(),
  role_id: z.string().uuid(),
  branch_ids: z.array(z.string().uuid()).max(200).default([]),
});

export const passwordSchema = z
  .string()
  .min(10, 'Mínimo 10 caracteres')
  .max(72)
  .regex(/[A-Za-z]/, 'Debe incluir letras')
  .regex(/[0-9]/, 'Debe incluir números');

export const acceptInvitationSchema = z.object({
  token: z.string().min(20).max(200),
  full_name: z.string().trim().min(1).max(120),
  password: passwordSchema,
});

export const updateUserSchema = z
  .object({
    role_id: z.string().uuid(),
    branch_ids: z.array(z.string().uuid()).max(200),
    is_active: z.boolean(),
  })
  .partial();

export const signInSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(200),
});
