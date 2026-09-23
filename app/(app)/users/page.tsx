import { UsersManager } from '@/components/users/UsersManager';
import { requireProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export const metadata = { title: 'Usuarios' };

export default async function UsersPage() {
  await requireProfile('manage_users');
  const { data } = await createClient().from('branches').select('id, name').eq('is_active', true).order('name');
  return <UsersManager branches={data ?? []} />;
}
