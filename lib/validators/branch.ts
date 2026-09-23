import { z } from 'zod';

export const slugSchema = z
  .string()
  .trim()
  .min(2)
  .max(60)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Solo minúsculas, números y guiones');

export const createBranchSchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: slugSchema,
  address: z.string().trim().max(250).nullable().optional(),
  default_survey_id: z.string().uuid().nullable().optional(),
});

export const updateBranchSchema = createBranchSchema.partial().extend({
  is_active: z.boolean().optional(),
});
