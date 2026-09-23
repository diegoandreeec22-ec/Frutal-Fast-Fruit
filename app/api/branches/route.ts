import { NextResponse } from 'next/server';

import { authorize, dbError, parseBody } from '@/lib/api';
import { BRANCH_COLUMNS } from '@/lib/columns';
import { createBranchSchema } from '@/lib/validators/branch';

export async function GET() {
  const auth = await authorize();
  if (!auth.ok) return auth.response;

  // RLS: HQ ve todas las de su empresa; local solo las asignadas.
  const { data, error } = await auth.supabase
    .from('branches')
    .select(BRANCH_COLUMNS)
    .order('is_active', { ascending: false })
    .order('name');
  if (error) return dbError(error);

  return NextResponse.json({ branches: data });
}

export async function POST(request: Request) {
  const auth = await authorize('manage_branches');
  if (!auth.ok) return auth.response;

  const body = await parseBody(request, createBranchSchema);
  if (!body.ok) return body.response;

  const { data, error } = await auth.supabase
    .from('branches')
    .insert({ ...body.data, company_id: auth.profile.company_id })
    .select(BRANCH_COLUMNS)
    .single();
  if (error) return dbError(error);

  return NextResponse.json({ branch: data }, { status: 201 });
}
