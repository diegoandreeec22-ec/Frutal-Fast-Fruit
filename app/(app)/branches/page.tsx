import { BranchList } from '@/components/branch-management/BranchList';
import { requireProfile } from '@/lib/auth';

export const metadata = { title: 'Sucursales' };

export default async function BranchesPage() {
  await requireProfile();
  return <BranchList />;
}
