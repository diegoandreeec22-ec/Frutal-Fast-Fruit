import { NextResponse } from 'next/server';
import { z } from 'zod';

import { authorize, jsonError } from '@/lib/api';
import { createAdminClient } from '@/lib/supabase/admin';

type Ctx = { params: { id: string } };

// Revocar una invitación pendiente
export async function DELETE(_request: Request, { params }: Ctx) {
  const auth = await authorize('manage_users');
  if (!auth.ok) return auth.response;
  if (!z.string().uuid().safeParse(params.id).success) return jsonError('No encontrado', 404);

  const { data } = await createAdminClient()
    .from('user_invitations')
    .update({ status: 'revoked' })
    .eq('id', params.id)
    .eq('company_id', auth.profile.company_id)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle();
  if (!data) return jsonError('Invitación no encontrada o ya usada', 404);

  return NextResponse.json({ ok: true });
}
