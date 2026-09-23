'use client';

import { Plus, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';

import { ThresholdConfig } from '@/components/survey-builder/ThresholdConfig';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Feedback';
import { Checkbox, Field, Input, Select } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { api, errorText } from '@/lib/fetcher';
import { slugify } from '@/lib/utils';
import type { ChoiceOption, QuestionType, SurveyQuestion } from '@/types/database';

const TYPES: Array<{ value: QuestionType; label: string; hint: string }> = [
  { value: 'nps', label: 'NPS (0 a 10)', hint: '¿Qué tan probable es que nos recomiendes?' },
  { value: 'rating', label: 'Calificación (estrellas)', hint: 'Escala configurable, normalmente 1 a 5' },
  { value: 'multiple_choice', label: 'Opción múltiple', hint: 'El cliente elige una opción' },
  { value: 'text', label: 'Texto libre', hint: 'Comentario abierto' },
];

export function QuestionBuilder({
  surveyId,
  question,
  onClose,
  onSaved,
}: {
  surveyId: string;
  question: SurveyQuestion | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [text, setText] = useState(question?.question_text ?? '');
  const [type, setType] = useState<QuestionType>(question?.question_type ?? 'rating');
  const [scaleMin, setScaleMin] = useState(question?.scale_min ?? 1);
  const [scaleMax, setScaleMax] = useState(question?.scale_max ?? 5);
  const [critical, setCritical] = useState<number | null>(question?.critical_threshold ?? (question ? null : 2));
  const [warning, setWarning] = useState<number | null>(question?.warning_threshold ?? (question ? null : 3));
  const [required, setRequired] = useState(question?.is_required ?? true);
  const [options, setOptions] = useState<ChoiceOption[]>(question?.options ?? [{ label: '', value: '' }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function changeType(next: QuestionType) {
    setType(next);
    if (next === 'nps') {
      setScaleMin(0);
      setScaleMax(10);
      setCritical(4);
      setWarning(6);
    } else if (next === 'rating') {
      setScaleMin(1);
      setScaleMax(5);
      setCritical(2);
      setWarning(3);
    } else {
      setCritical(null);
      setWarning(null);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const cleanOptions = options
      .filter((o) => o.label.trim())
      .map((o) => ({ label: o.label.trim(), value: o.value || slugify(o.label).replace(/-/g, '_') || 'opcion' }));

    const payload = {
      question_text: text,
      question_type: type,
      scale_min: scaleMin,
      scale_max: scaleMax,
      critical_threshold: type === 'nps' || type === 'rating' ? critical : null,
      warning_threshold: type === 'nps' || type === 'rating' ? warning : null,
      is_required: required,
      options: type === 'multiple_choice' ? cleanOptions : null,
    };
    try {
      if (question) {
        await api(`/api/surveys/questions/${question.id}`, { method: 'PUT', json: payload });
      } else {
        await api(`/api/surveys/${surveyId}/questions`, { method: 'POST', json: payload });
      }
      onSaved();
    } catch (err) {
      setError(errorText(err));
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={question ? 'Editar pregunta' : 'Nueva pregunta'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="question-form" loading={saving}>
            Guardar pregunta
          </Button>
        </>
      }
    >
      <form id="question-form" onSubmit={onSubmit} className="space-y-4">
        {error && <Notice tone="error">{error}</Notice>}
        {question && (
          <Notice tone="warning">Cambiar el texto o la escala afecta cómo se leen las respuestas anteriores.</Notice>
        )}
        <Field label="Pregunta" htmlFor="q-text">
          <Input id="q-text" required maxLength={300} value={text} onChange={(e) => setText(e.target.value)} />
        </Field>
        <Field label="Tipo" htmlFor="q-type" hint={TYPES.find((t) => t.value === type)?.hint}>
          <Select id="q-type" value={type} onChange={(e) => changeType(e.target.value as QuestionType)}>
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
        </Field>

        {type === 'rating' && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Escala mínima" htmlFor="q-min">
              <Input id="q-min" type="number" min={0} max={9} value={scaleMin} onChange={(e) => setScaleMin(Number(e.target.value))} />
            </Field>
            <Field label="Escala máxima" htmlFor="q-max">
              <Input id="q-max" type="number" min={1} max={10} value={scaleMax} onChange={(e) => setScaleMax(Number(e.target.value))} />
            </Field>
          </div>
        )}

        {(type === 'nps' || type === 'rating') && (
          <ThresholdConfig
            min={scaleMin}
            max={scaleMax}
            critical={critical}
            warning={warning}
            onChange={({ critical: c, warning: w }) => {
              setCritical(c);
              setWarning(w);
            }}
          />
        )}

        {type === 'multiple_choice' && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700">Opciones</p>
            {options.map((o, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  value={o.label}
                  maxLength={80}
                  placeholder={`Opción ${i + 1}`}
                  onChange={(e) =>
                    setOptions((prev) => prev.map((p, j) => (j === i ? { ...p, label: e.target.value } : p)))
                  }
                />
                <Button
                  variant="ghost"
                  aria-label="Quitar opción"
                  onClick={() => setOptions((prev) => prev.filter((_, j) => j !== i))}
                  disabled={options.length <= 1}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button variant="secondary" size="sm" onClick={() => setOptions((prev) => [...prev, { label: '', value: '' }])}>
              <Plus className="h-4 w-4" /> Agregar opción
            </Button>
          </div>
        )}

        <Checkbox label="Respuesta obligatoria" checked={required} onChange={setRequired} />
      </form>
    </Modal>
  );
}
