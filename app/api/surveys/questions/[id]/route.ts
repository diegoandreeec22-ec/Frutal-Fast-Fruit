import { NextResponse } from 'next/server';
import { z } from 'zod';

import { authorize, dbError, jsonError, parseBody } from '@/lib/api';
import { QUESTION_COLUMNS } from '@/lib/columns';
import { normalizeQuestion, updateQuestionSchema } from '@/lib/validators/survey';

type Ctx = { params: { id: string } };

export async function PUT(request: Request, { params }: Ctx) {
  const auth = await authorize('manage_surveys', 'manage_surveys_local');
  if (!auth.ok) return auth.response;
  if (!z.string().uuid().safeParse(params.id).success) return jsonError('No encontrado', 404);

  const body = await parseBody(request, updateQuestionSchema);
  if (!body.ok) return body.response;

  const { data, error } = await auth.supabase
    .from('survey_questions')
    .update(normalizeQuestion(body.data))
    .eq('id', params.id)
    .select(QUESTION_COLUMNS)
    .single();
  if (error) return dbError(error);

  return NextResponse.json({ question: data });
}

// Se desactiva (no se borra) para no romper las respuestas históricas.
export async function DELETE(_request: Request, { params }: Ctx) {
  const auth = await authorize('manage_surveys', 'manage_surveys_local');
  if (!auth.ok) return auth.response;
  if (!z.string().uuid().safeParse(params.id).success) return jsonError('No encontrado', 404);

  const { data, error } = await auth.supabase
    .from('survey_questions')
    .update({ is_active: false })
    .eq('id', params.id)
    .select('id')
    .single();
  if (error) return dbError(error);

  return NextResponse.json({ question: data });
}
