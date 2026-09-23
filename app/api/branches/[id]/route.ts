import { NextResponse } from 'next/server';
import { z } from 'zod';

import { authorize, dbError, jsonError, parseBody } from '@/lib/api';
import { BRANCH_COLUMNS } from '@/lib/columns';
import { updateBranchSchema } from '@/lib/validators/branch';

type Ctx = { params: { id: string } };

export async function PUT(request: Request, { params }: Ctx) {
  const auth = await authorize('manage_branches');
  if (!auth.ok) return auth.response;
  if (!z.string().uuid().safeParse(params.id).success) return jsonError('No encontrado', 404);

  const body = await parseBody(request, updateBranchSchema);
  if (!body.ok) return body.response;

  const { data, error } = await auth.supabase
    .from('branches')
    .update(body.data)
    .eq('id', params.id)
    .select(BRANCH_COLUMNS)
    .single();
  if (error) return dbError(error);

  return NextResponse.json({ branch: data });
}

// Las sucursales nunca se borran: se desactivan.
export async function DELETE(_request: Request, { params }: Ctx) {
  const auth = await authorize('manage_branches');
  if (!auth.ok) return auth.response;
  if (!z.string().uuid().safeParse(params.id).success) return jsonError('No encontrado', 404);

  const { data, error } = await auth.supabase
    .from('branches')
    .update({ is_active: false })
    .eq('id', params.id)
    .select('id')
    .single();
  if (error) return dbError(error);

  return NextResponse.json({ branch: data });
}
