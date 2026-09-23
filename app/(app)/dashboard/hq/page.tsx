import { DashboardView } from '@/components/dashboard/DashboardView';
import { requireProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export const metadata = { title: 'Dashboard HQ' };

export default async function HqDashboardPage() {
  await requireProfile('view_hq_dashboard');
  const { data } = await createClient().from('branches').select('id, name').eq('is_active', true).order('name');
  return <DashboardView scope="hq" branches={data ?? []} />;
}
