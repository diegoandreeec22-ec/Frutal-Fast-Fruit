import { AppLayout } from '@/components/Layout';
import { AuthProvider } from '@/contexts/AuthContext';
import { requireProfile } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile();
  return (
    <AuthProvider profile={profile}>
      <AppLayout>{children}</AppLayout>
    </AuthProvider>
  );
}
