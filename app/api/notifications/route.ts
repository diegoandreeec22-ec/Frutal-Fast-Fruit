import { NextResponse } from 'next/server';
import { z } from 'zod';

import { authorize, dbError, parseBody } from '@/lib/api';
import { NOTIFICATION_COLUMNS } from '@/lib/columns';

// Bandeja in-app del usuario actual (RLS: solo las suyas).
export async function GET() {
  const auth = await authorize();
  if (!auth.ok) return auth.response;

  const { data, error } = await auth.supabase
    .from('notifications')
    .select(NOTIFICATION_COLUMNS)
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) return dbError(error);

  const unread = (data ?? []).filter((n) => !n.read_at).length;
  return NextResponse.json({ notifications: data, unread });
}

const markSchema = z.object({
  ids: z.array(z.string().uuid()).max(100).optional(),
  all: z.boolean().optional(),
});

export async function PATCH(request: Request) {
  const auth = await authorize();
  if (!auth.ok) return auth.response;

  const body = await parseBody(request, markSchema);
  if (!body.ok) return body.response;

  let query = auth.supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .is('read_at', null)
    .eq('user_id', auth.profile.id);
  if (!body.data.all) query = query.in('id', body.data.ids ?? []);

  const { error } = await query;
  if (error) return dbError(error);

  return NextResponse.json({ ok: true });
}
