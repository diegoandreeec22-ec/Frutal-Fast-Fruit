import { NextResponse } from 'next/server';
import { z } from 'zod';

import { authorize, dbError, parseBody } from '@/lib/api';

const schema = z
  .object({
    name: z.string().trim().min(1).max(120),
    primary_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Color hexadecimal, p. ej. #2E7D32'),
    sla_hours: z.number().int().min(1).max(720),
    logo_url: z.string().url().max(500).nullable(),
  })
  .partial();

export async function PUT(request: Request) {
  const auth = await authorize('manage_settings');
  if (!auth.ok) return auth.response;

  const body = await parseBody(request, schema);
  if (!body.ok) return body.response;

  const { data, error } = await auth.supabase
    .from('companies')
    .update(body.data)
    .eq('id', auth.profile.company_id)
    .select('id, name, logo_url, primary_color, timezone, locale, sla_hours')
    .single();
  if (error) return dbError(error);

  return NextResponse.json({ company: data });
}
