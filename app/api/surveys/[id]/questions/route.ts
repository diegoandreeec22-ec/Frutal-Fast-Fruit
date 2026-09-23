import { NextResponse } from 'next/server';
import { z } from 'zod';

import { authorize, dbError, jsonError, parseBody } from '@/lib/api';
import { QUESTION_COLUMNS } from '@/lib/columns';
import { createQuestionSchema, normalizeQuestion } from '@/lib/validators/survey';

type Ctx = { params: { id: string } };

export async function POST(request: Request, { params }: Ctx) {
  const auth = await authorize('manage_surveys', 'manage_surveys_local');
  if (!auth.ok) return auth.response;
  if (!z.string().uuid().safeParse(params.id).success) return jsonError('No encontrado', 404);

  const body = await parseBody(request, createQuestionSchema);
  if (!body.ok) return body.response;

  // Nueva pregunta al final
  const { data: last } = await auth.supabase
    .from('survey_questions')
    .select('order_index')
    .eq('survey_id', params.id)
    .order('order_index', { ascending: false })
    .limit(1)
    .maybeSingle();

  const question = normalizeQuestion({
    ...body.data,
    order_index: body.data.order_index || (last?.order_index ?? 0) + 1,
  });

  const { data, error } = await auth.supabase
    .from('survey_questions')
    .insert({ ...question, survey_id: params.id })
    .select(QUESTION_COLUMNS)
    .single();
  if (error) return dbError(error);

  return NextResponse.json({ question: data }, { status: 201 });
}
