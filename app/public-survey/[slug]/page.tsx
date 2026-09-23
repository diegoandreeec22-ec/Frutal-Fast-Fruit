import type { Metadata } from 'next';
import { z } from 'zod';

import { LogoMark } from '@/components/Logo';
import { PublicSurveyForm } from '@/components/survey/PublicSurveyForm';
import { createAnonClient } from '@/lib/supabase/server';
import type { PublicSurvey } from '@/types/database';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Encuesta', robots: { index: false, follow: false } };

type Props = { params: { slug: string }; searchParams: { e?: string; mesa?: string; src?: string } };

// Encuesta pública dinámica: /s/<slug-sucursal>?e=<encuesta>&mesa=<n>
// Si el QR no indica encuesta (o no es válida), usa la predeterminada de la sucursal.
export default async function PublicSurveyPage({ params, searchParams }: Props) {
  const slug = params.slug.toLowerCase().slice(0, 60);
  const surveyId = z.string().uuid().safeParse(searchParams.e).success ? searchParams.e! : null;
  const mesa = Number(searchParams.mesa);
  const tableNumber = Number.isInteger(mesa) && mesa >= 1 && mesa <= 999 ? mesa : null;
  const source = ['qr', 'nfc_dynamic', 'direct', 'link'].includes(searchParams.src ?? '') ? searchParams.src! : 'qr';

  const { data } = await createAnonClient().rpc('get_public_survey', { p_slug: slug, p_survey_id: surveyId });
  const survey = data as PublicSurvey | null;

  if (!survey || survey.questions.length === 0) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-brand-50 px-6 text-center">
        <LogoMark className="h-14 w-14" />
        <h1 className="mt-4 text-xl font-bold text-gray-900">Encuesta no disponible</h1>
        <p className="mt-2 max-w-xs text-sm text-gray-600">
          Este código no está activo en este momento. Por favor, avísale a nuestro personal. ¡Gracias!
        </p>
      </main>
    );
  }

  return <PublicSurveyForm data={survey} tableNumber={tableNumber} sourceType={source as 'qr'} />;
}
