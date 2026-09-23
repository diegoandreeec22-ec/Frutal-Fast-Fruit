import { timingSafeEqual } from 'node:crypto';

import { NextResponse } from 'next/server';

import { jsonError } from '@/lib/api';
import { dispatchPendingNotifications } from '@/lib/email/sender';
import { createAdminClient } from '@/lib/supabase/admin';

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get('authorization') ?? '';
  if (!secret || secret.length < 16) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(header);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

// Despachador de emails pendientes. Lo llama un cron (Vercel Cron o pg_cron)
// con "Authorization: Bearer <CRON_SECRET>". Nunca es público.
async function handle(request: Request) {
  if (!authorized(request)) return jsonError('No autorizado', 401);
  try {
    const result = await dispatchPendingNotifications(createAdminClient(), 50);
    return NextResponse.json(result);
  } catch (e) {
    console.error('[notifications/send]', e);
    return jsonError('Error al despachar notificaciones', 500);
  }
}

export const POST = handle;
// Vercel Cron hace GET
export const GET = handle;
export const dynamic = 'force-dynamic';
