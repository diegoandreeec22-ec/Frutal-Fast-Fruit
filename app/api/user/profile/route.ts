import { NextResponse } from 'next/server';

import { authorize } from '@/lib/api';

export async function GET() {
  const auth = await authorize();
  if (!auth.ok) return auth.response;
  return NextResponse.json({ profile: auth.profile });
}
