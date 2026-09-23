import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { authorize, dbError, jsonError } from '@/lib/api';
import { ALERT_COLUMNS } from '@/lib/columns';

const querySchema = z.object({
  status: z.enum(['open', 'in_review', 'resolved', 'active', 'all']).default('active'),
  severity: z.enum(['critical', 'warning']).optional(),
  branch: z.string().uuid().optional(),
  escalated: z.enum(['1']).optional(),
  id: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

export async function GET(request: NextRequest) {
  const auth = await authorize();
  if (!auth.ok) return auth.response;

  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return jsonError('Filtros inválidos');
  const q = parsed.data;

  let query = auth.supabase
    .from('alerts')
    .select(`${ALERT_COLUMNS}, branches(name), survey_questions(question_text), responses(table_number, comments)`)
    .order('created_at', { ascending: false })
    .limit(q.limit);

  if (q.id) query = query.eq('id', q.id);
  if (q.status === 'active') query = query.neq('status', 'resolved');
  else if (q.status !== 'all') query = query.eq('status', q.status);
  if (q.severity) query = query.eq('severity', q.severity);
  if (q.branch) query = query.eq('branch_id', q.branch);
  if (q.escalated) query = query.eq('escalated_to_hq', true);

  const { data, error } = await query;
  if (error) return dbError(error);

  return NextResponse.json({ alerts: data });
}
