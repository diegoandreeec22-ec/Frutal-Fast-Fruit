import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { authorize, dbError, jsonError } from '@/lib/api';

const querySchema = z.object({
  branch: z.string().uuid().optional(),
  survey: z.string().uuid().optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  page: z.coerce.number().int().min(0).max(10_000).default(0),
  size: z.coerce.number().int().min(1).max(100).default(25),
});

export async function GET(request: NextRequest) {
  const auth = await authorize('view_all_responses', 'view_own_responses');
  if (!auth.ok) return auth.response;

  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return jsonError('Filtros inválidos');
  const q = parsed.data;

  let query = auth.supabase
    .from('responses')
    .select(
      'id, branch_id, survey_id, table_number, channel, source_type, comments, created_at, branches(name), surveys(name), response_answers(answer_value, survey_questions(question_text, question_type, order_index, scale_max))',
      { count: 'exact' },
    )
    .order('created_at', { ascending: false })
    .range(q.page * q.size, q.page * q.size + q.size - 1);

  if (q.branch) query = query.eq('branch_id', q.branch);
  if (q.survey) query = query.eq('survey_id', q.survey);
  if (q.from) query = query.gte('created_at', q.from);
  if (q.to) query = query.lt('created_at', q.to);

  const { data, error, count } = await query;
  if (error) return dbError(error);

  return NextResponse.json({ responses: data, total: count ?? 0 });
}
