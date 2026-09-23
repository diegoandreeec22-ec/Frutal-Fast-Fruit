import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { authorize, dbError, jsonError } from '@/lib/api';

const querySchema = z.object({
  from: z.string().datetime({ offset: true }),
  to: z.string().datetime({ offset: true }),
  branches: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(',').filter(Boolean) : null))
    .pipe(z.array(z.string().uuid()).max(200).nullable()),
});

// Métricas agregadas en SQL (dashboard_metrics es SECURITY INVOKER: RLS limita el scope).
export async function GET(request: NextRequest) {
  const auth = await authorize('view_hq_dashboard', 'view_own_dashboard');
  if (!auth.ok) return auth.response;

  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return jsonError('Parámetros inválidos', 400, parsed.error.flatten());
  const { from, to, branches } = parsed.data;

  if (new Date(to).getTime() - new Date(from).getTime() > 400 * 86_400_000) {
    return jsonError('El rango máximo es de 400 días');
  }

  const { data, error } = await auth.supabase.rpc('dashboard_metrics', {
    p_from: from,
    p_to: to,
    p_branch_ids: branches && branches.length ? branches : null,
  });
  if (error) return dbError(error);

  return NextResponse.json({ metrics: data });
}
