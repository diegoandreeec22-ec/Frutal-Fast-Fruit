import { SurveysManager } from '@/components/survey-builder/SurveysManager';
import { requireProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export const metadata = { title: 'Encuestas' };

export default async function SurveysPage() {
  await requireProfile();
  const { data } = await createClient().from('branches').select('id, name, slug').eq('is_active', true).order('name');
  return <SurveysManager branches={data ?? []} />;
}
