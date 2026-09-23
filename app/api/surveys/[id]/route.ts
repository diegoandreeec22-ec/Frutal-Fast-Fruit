import { NextResponse } from 'next/server';
import { z } from 'zod';

import { authorize, dbError, jsonError, parseBody } from '@/lib/api';
import { QUESTION_COLUMNS, SURVEY_COLUMNS } from '@/lib/columns';
import { updateSurveySchema } from '@/lib/validators/survey';

type Ctx = { params: { id: string } };

function validId(id: string) {
  return z.string().uuid().safeParse(id).success;
}

export async function GET(_request: Request, { params }: Ctx) {
  const auth = await authorize();
  if (!auth.ok) return auth.response;
  if (!validId(params.id)) return jsonError('No encontrado', 404);

  const { data: survey, error } = await auth.supabase
    .from('surveys')
    .select(SURVEY_COLUMNS)
    .eq('id', params.id)
    .single();
  if (error) return dbError(error);

  const { data: questions, error: qError } = await auth.supabase
    .from('survey_questions')
    .select(QUESTION_COLUMNS)
    .eq('survey_id', params.id)
    .eq('is_active', true)
    .order('order_index')
    .order('created_at');
  if (qError) return dbError(qError);

  const { data: canManage } = await auth.supabase.rpc('can_manage_survey', { p_survey_id: params.id });

  return NextResponse.json({ survey, questions, can_manage: canManage === true });
}

export async function PUT(request: Request, { params }: Ctx) {
  const auth = await authorize('manage_surveys', 'manage_surveys_local');
  if (!auth.ok) return auth.response;
  if (!validId(params.id)) return jsonError('No encontrado', 404);

  const body = await parseBody(request, updateSurveySchema);
  if (!body.ok) return body.response;

  const { data, error } = await auth.supabase
    .from('surveys')
    .update(body.data)
    .eq('id', params.id)
    .select(SURVEY_COLUMNS)
    .single();
  if (error) return dbError(error);

  return NextResponse.json({ survey: data });
}

// Nunca se borra: se desactiva para conservar el histórico de respuestas.
export async function DELETE(_request: Request, { params }: Ctx) {
  const auth = await authorize('manage_surveys', 'manage_surveys_local');
  if (!auth.ok) return auth.response;
  if (!validId(params.id)) return jsonError('No encontrado', 404);

  const { data, error } = await auth.supabase
    .from('surveys')
    .update({ is_active: false })
    .eq('id', params.id)
    .select('id')
    .single();
  if (error) return dbError(error);

  return NextResponse.json({ survey: data });
}
