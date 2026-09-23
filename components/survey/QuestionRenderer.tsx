'use client';

import { MultipleChoiceQuestion } from '@/components/survey/MultipleChoiceQuestion';
import { NPSQuestion } from '@/components/survey/NPSQuestion';
import { RatingQuestion } from '@/components/survey/RatingQuestion';
import { TextQuestion } from '@/components/survey/TextQuestion';
import type { PublicSurvey } from '@/types/database';

export type AnswerValue = number | string | null;
export type PublicQuestion = PublicSurvey['questions'][number];

export function QuestionRenderer({
  question,
  value,
  onChange,
  color,
}: {
  question: PublicQuestion;
  value: AnswerValue;
  onChange: (v: AnswerValue) => void;
  color: string;
}) {
  switch (question.question_type) {
    case 'nps':
      return <NPSQuestion value={value as number | null} onChange={onChange} color={color} />;
    case 'rating':
      return (
        <RatingQuestion min={question.scale_min} max={question.scale_max} value={value as number | null} onChange={onChange} />
      );
    case 'multiple_choice':
      return (
        <MultipleChoiceQuestion options={question.options ?? []} value={value as string | null} onChange={onChange} color={color} />
      );
    case 'text':
      return <TextQuestion value={(value as string | null) ?? ''} onChange={onChange} />;
    default:
      return null;
  }
}
