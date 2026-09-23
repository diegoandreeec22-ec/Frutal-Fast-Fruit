import { ResponsesList } from '@/components/survey/ResponsesList';
import { requireProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export const metadata = { title: 'Respuestas' };

export default async function ResponsesPage() {
  await requireProfile('view_all_responses', 'view_own_responses');
  const { data } = await createClient().from('branches').select('id, name').order('name');
  return <ResponsesList branches={data ?? []} />;
}
