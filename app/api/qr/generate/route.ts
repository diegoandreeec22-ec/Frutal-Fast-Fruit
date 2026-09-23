import { NextResponse } from 'next/server';
import { z } from 'zod';

import { authorize, jsonError, parseBody } from '@/lib/api';
import { appUrl } from '@/lib/utils';

const schema = z.object({
  branch_id: z.string().uuid(),
  survey_id: z.string().uuid().nullable().optional(),
  table_number: z.number().int().min(1).max(999).nullable().optional(),
});

// Devuelve la URL pública que se codifica en el QR. Si no se indica encuesta,
// la página pública usa la predeterminada de la sucursal.
export async function POST(request: Request) {
  const auth = await authorize();
  if (!auth.ok) return auth.response;

  const body = await parseBody(request, schema);
  if (!body.ok) return body.response;
  const { branch_id, survey_id, table_number } = body.data;

  const { data: branch } = await auth.supabase
    .from('branches')
    .select('id, slug, name, is_active')
    .eq('id', branch_id)
    .maybeSingle();
  if (!branch) return jsonError('Sucursal no encontrada', 404);
  if (!branch.is_active) return jsonError('La sucursal está inactiva');

  if (survey_id) {
    const { data: survey } = await auth.supabase
      .from('surveys')
      .select('id, is_active, is_public, branch_id')
      .eq('id', survey_id)
      .maybeSingle();
    if (!survey || !survey.is_active || !survey.is_public) return jsonError('Encuesta no disponible');
    if (survey.branch_id && survey.branch_id !== branch.id) {
      return jsonError('Esa encuesta pertenece a otra sucursal');
    }
  }

  const params = new URLSearchParams();
  if (survey_id) params.set('e', survey_id);
  if (table_number) params.set('mesa', String(table_number));
  const qs = params.toString();

  return NextResponse.json({
    url: `${appUrl()}/s/${branch.slug}${qs ? `?${qs}` : ''}`,
    branch: { id: branch.id, name: branch.name, slug: branch.slug },
  });
}
