import { DashboardView } from '@/components/dashboard/DashboardView';
import { requireProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export const metadata = { title: 'Dashboard de local' };

export default async function BranchDashboardPage() {
  const profile = await requireProfile('view_own_dashboard', 'view_hq_dashboard');
  // Solo las sucursales asignadas (para HQ, RLS devolvería todas; aquí filtramos a las suyas)
  let query = createClient().from('branches').select('id, name').eq('is_active', true).order('name');
  if (!profile.permissions.includes('view_all_branches')) query = query.in('id', profile.branch_ids);
  const { data } = await query;
  return <DashboardView scope="branch" branches={data ?? []} />;
}
