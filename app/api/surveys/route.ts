import { NextResponse } from 'next/server';

import { authorize, dbError, jsonError, parseBody } from '@/lib/api';
import { can } from '@/lib/auth';
import { SURVEY_COLUMNS } from '@/lib/columns';
import { createSurveySchema } from '@/lib/validators/survey';

export async function GET() {
  const auth = await authorize();
  if (!auth.ok) return auth.response;

  const { data, error } = await auth.supabase
    .from('surveys')
    .select(`${SURVEY_COLUMNS}, survey_questions(count)`)
    .eq('survey_questions.is_active', true)
    .order('is_active', { ascending: false })
    .order('created_at', { ascending: true });
  if (error) return dbError(error);

  return NextResponse.json({ surveys: data });
}

export async function POST(request: Request) {
  const auth = await authorize('manage_surveys', 'manage_surveys_local');
  if (!auth.ok) return auth.response;

  const body = await parseBody(request, createSurveySchema);
  if (!body.ok) return body.response;

  const branchId = body.data.branch_id ?? null;
  if (!branchId && !can(auth.profile, 'manage_surveys')) {
    return jsonError('Solo puedes crear encuestas para tus sucursales', 403);
  }

  const { data, error } = await auth.supabase
    .from('surveys')
    .insert({
      company_id: auth.profile.company_id,
      branch_id: branchId,
      name: body.data.name,
      description: body.data.description ?? null,
      survey_type: body.data.survey_type,
      is_public: body.data.is_public,
    })
    .select(SURVEY_COLUMNS)
    .single();
  if (error) return dbError(error);

  return NextResponse.json({ survey: data }, { status: 201 });
}
