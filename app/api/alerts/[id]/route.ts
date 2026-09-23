import { NextResponse } from 'next/server';
import { z } from 'zod';

import { authorize, dbError, jsonError, parseBody } from '@/lib/api';
import { ALERT_COLUMNS } from '@/lib/columns';

type Ctx = { params: { id: string } };

const updateAlertSchema = z
  .object({
    status: z.enum(['open', 'in_review', 'resolved']).optional(),
    resolution_note: z.string().trim().max(2000).nullable().optional(),
  })
  .refine((v) => v.status !== undefined || v.resolution_note !== undefined, 'Nada que actualizar');

// Solo cambia estado y nota. Severidad, valores y escalamiento son inmutables (GRANT por columna).
export async function PUT(request: Request, { params }: Ctx) {
  const auth = await authorize('manage_alerts_local', 'manage_alerts_regional');
  if (!auth.ok) return auth.response;
  if (!z.string().uuid().safeParse(params.id).success) return jsonError('No encontrado', 404);

  const body = await parseBody(request, updateAlertSchema);
  if (!body.ok) return body.response;

  if (body.data.status === 'resolved' && !body.data.resolution_note) {
    return jsonError('Agrega una nota de resolución');
  }

  const { data, error } = await auth.supabase
    .from('alerts')
    .update(body.data)
    .eq('id', params.id)
    .select(ALERT_COLUMNS)
    .single();
  if (error) return dbError(error);

  return NextResponse.json({ alert: data });
}
