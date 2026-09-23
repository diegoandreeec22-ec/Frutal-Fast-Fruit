import { SurveyEditor } from '@/components/survey-builder/SurveyEditor';
import { requireProfile } from '@/lib/auth';

export const metadata = { title: 'Editor de encuesta' };

export default async function SurveyEditorPage({ params }: { params: { id: string } }) {
  await requireProfile();
  return <SurveyEditor surveyId={params.id} />;
}
