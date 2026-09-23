import { NextResponse } from 'next/server';

import { authorize, dbError } from '@/lib/api';
import { INVITATION_COLUMNS } from '@/lib/columns';

export async function GET() {
  const auth = await authorize('manage_users');
  if (!auth.ok) return auth.response;
  const { supabase } = auth;

  const [users, invitations, roles] = await Promise.all([
    supabase
      .from('users')
      .select('id, full_name, email, is_active, last_login_at, created_at, role_id, roles(name, is_owner), user_branches(branch_id)')
      .order('is_active', { ascending: false })
      .order('full_name'),
    supabase
      .from('user_invitations')
      .select(INVITATION_COLUMNS)
      .eq('status', 'pending')
      .order('created_at', { ascending: false }),
    supabase.from('roles').select('id, name, description, is_owner').order('name'),
  ]);

  const error = users.error ?? invitations.error ?? roles.error;
  if (error) return dbError(error);

  return NextResponse.json({ users: users.data, invitations: invitations.data, roles: roles.data });
}
