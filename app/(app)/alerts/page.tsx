import { Suspense } from 'react';

import { AlertsManager } from '@/components/alerts/AlertsManager';
import { LoadingBlock } from '@/components/ui/Feedback';
import { requireProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export const metadata = { title: 'Alertas' };

export default async function AlertsPage() {
  await requireProfile();
  const { data } = await createClient().from('branches').select('id, name').order('name');
  return (
    <Suspense fallback={<LoadingBlock />}>
      <AlertsManager branches={data ?? []} />
    </Suspense>
  );
}
