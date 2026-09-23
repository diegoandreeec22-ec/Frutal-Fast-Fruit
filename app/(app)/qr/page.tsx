import { QrGenerator } from '@/components/qr/QrGenerator';
import { requireProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export const metadata = { title: 'Códigos QR' };

export default async function QrPage({ searchParams }: { searchParams: { branch?: string } }) {
  await requireProfile();
  const supabase = createClient();
  const [branches, surveys] = await Promise.all([
    supabase.from('branches').select('id, name, slug').eq('is_active', true).order('name'),
    supabase
      .from('surveys')
      .select('id, name, survey_type, branch_id')
      .eq('is_active', true)
      .eq('is_public', true)
      .order('name'),
  ]);
  return <QrGenerator branches={branches.data ?? []} surveys={surveys.data ?? []} initialBranch={searchParams.branch} />;
}
