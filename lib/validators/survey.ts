import { z } from 'zod';

const uuid = z.string().uuid();

export const surveyTypeSchema = z.enum(['salon', 'delivery', 'takeout', 'corporate_event']);

export const createSurveySchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional().nullable(),
  survey_type: surveyTypeSchema.default('salon'),
  branch_id: uuid.optional().nullable(),
  is_public: z.boolean().default(true),
});

export const updateSurveySchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().max(500).nullable(),
    survey_type: surveyTypeSchema,
    is_public: z.boolean(),
    is_active: z.boolean(),
  })
  .partial();

const optionSchema = z.object({
  label: z.string().trim().min(1).max(80),
  value: z
    .string()
    .trim()
    .min(1)
    .max(40)
    .regex(/^[a-z0-9_-]+$/, 'Solo minúsculas, números, - y _'),
});

const questionBase = z.object({
  question_text: z.string().trim().min(1).max(300),
  question_type: z.enum(['nps', 'rating', 'text', 'multiple_choice']),
  order_index: z.number().int().min(0).max(1000).default(0),
  scale_min: z.number().int().min(0).max(10).default(1),
  scale_max: z.number().int().min(1).max(10).default(5),
  critical_threshold: z.number().min(0).max(10).nullable().optional(),
  warning_threshold: z.number().min(0).max(10).nullable().optional(),
  is_required: z.boolean().default(true),
  options: z.array(optionSchema).max(20).nullable().optional(),
});

function questionRefine(q: Partial<z.infer<typeof questionBase>>, ctx: z.RefinementCtx) {
  if (q.scale_min !== undefined && q.scale_max !== undefined && q.scale_min >= q.scale_max) {
    ctx.addIssue({ code: 'custom', message: 'La escala mínima debe ser menor que la máxima', path: ['scale_max'] });
  }
  if (
    q.critical_threshold != null &&
    q.warning_threshold != null &&
    q.critical_threshold > q.warning_threshold
  ) {
    ctx.addIssue({
      code: 'custom',
      message: 'El umbral crítico debe ser menor o igual al de advertencia',
      path: ['critical_threshold'],
    });
  }
  if (q.question_type === 'multiple_choice' && (!q.options || q.options.length === 0)) {
    ctx.addIssue({ code: 'custom', message: 'Agrega al menos una opción', path: ['options'] });
  }
}

// Normaliza la pregunta según su tipo (NPS siempre 0-10; texto/opción sin umbrales)
export function normalizeQuestion<T extends Partial<z.infer<typeof questionBase>>>(q: T): T {
  const out = { ...q };
  if (out.question_type === 'nps') {
    out.scale_min = 0;
    out.scale_max = 10;
  }
  if (out.question_type === 'text' || out.question_type === 'multiple_choice') {
    out.critical_threshold = null;
    out.warning_threshold = null;
  }
  if (out.question_type && out.question_type !== 'multiple_choice') {
    out.options = null;
  }
  return out;
}

export const createQuestionSchema = questionBase.superRefine(questionRefine);
export const updateQuestionSchema = questionBase
  .partial()
  .extend({ is_active: z.boolean().optional() })
  .superRefine(questionRefine);

export const submitSurveySchema = z.object({
  branch_id: uuid,
  survey_id: uuid,
  answers: z.record(uuid, z.union([z.number(), z.string().max(2000), z.null()])),
  table_number: z.number().int().min(1).max(999).nullable().optional(),
  source_type: z.enum(['qr', 'nfc_dynamic', 'direct', 'link']).default('qr'),
  comments: z.string().max(2000).nullable().optional(),
  visitor_email: z.string().email().max(254).nullable().optional().or(z.literal('')),
  visitor_phone: z.string().max(30).nullable().optional(),
  // honeypot anti-bots: si llega con texto se responde "ok" sin guardar nada
  website: z.string().max(200).optional(),
});
