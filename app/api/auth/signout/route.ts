import { NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';

export async function POST() {
  await createClient().auth.signOut();
  return NextResponse.json({ ok: true });
}
