import { redirect } from 'next/navigation';

import { can, requireProfile } from '@/lib/auth';

export default async function DashboardIndex() {
  const profile = await requireProfile();
  if (can(profile, 'view_hq_dashboard')) redirect('/dashboard/hq');
  if (can(profile, 'view_own_dashboard')) redirect('/dashboard/branch');
  redirect('/alerts');
}
