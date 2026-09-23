'use client';

import { ArrowDown, ArrowLeft, ArrowUp, ListChecks, Pencil, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import { QuestionBuilder } from '@/components/survey-builder/QuestionBuilder';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { EmptyState, LoadingBlock, Notice } from '@/components/ui/Feedback';
import { Checkbox, Field, Input, Select, Textarea } from '@/components/ui/Input';
import { api, errorText } from '@/lib/fetcher';
import { SURVEY_TYPE_LABEL } from '@/lib/utils';
import type { Survey, SurveyQuestion, SurveyType } from '@/types/database';

const TYPE_LABEL: Record<string, string> = {
  nps: 'NPS',
  rating: 'Calificación',
  multiple_choice: 'Opción múltiple',
  text: 'Texto libre',
};

export function SurveyEditor({ surveyId }: { surveyId: string }) {
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [questions, setQuestions] = useState<SurveyQuestion[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [editing, setEditing] = useState<SurveyQuestion | 'new' | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await api<{ survey: Survey; questions: SurveyQuestion[]; can_manage: boolean }>(`/api/surveys/${surveyId}`);
      setSurvey(d.survey);
      setQuestions(d.questions);
      setCanManage(d.can_manage);
    } catch {
      setNotFound(true);
    }
  }, [surveyId]);

  useEffect(() => {
    load();
  }, [load]);

  async function move(index: number, dir: -1 | 1) {
    const a = questions[index];
    const b = questions[index + dir];
    if (!a || !b) return;
    // Renumera 1..n y guarda solo las preguntas cuyo índice cambió
    const reordered = [...questions];
    reordered[index] = b;
    reordered[index + dir] = a;
    setQuestions(reordered);
    try {
      await Promise.all(
        reordered
          .map((q, i) => ({ q, order: i + 1 }))
          .filter(({ q, order }) => q.order_index !== order)
          .map(({ q, order }) => api(`/api/surveys/questions/${q.id}`, { method: 'PUT', json: { order_index: order } })),
      );
    } catch (e) {
      setError(errorText(e));
    }
    load();
  }

  async function remove(q: SurveyQuestion) {
    if (!confirm(`¿Quitar la pregunta "${q.question_text}"? Las respuestas anteriores se conservan.`)) return;
    try {
      await api(`/api/surveys/questions/${q.id}`, { method: 'DELETE' });
      load();
    } catch (e) {
      setError(errorText(e));
    }
  }

  if (notFound) {
    return (
      <Card>
        <EmptyState title="Encuesta no encontrada" action={<Link href="/surveys" className="text-sm font-medium text-brand-700">Volver</Link>} />
      </Card>
    );
  }
  if (!survey) return <LoadingBlock />;

  return (
    <div className="space-y-6">
      <Link href="/surveys" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
        <ArrowLeft className="h-4 w-4" /> Encuestas
      </Link>
      {error && <Notice tone="error">{error}</Notice>}
      {!canManage && <Notice tone="info">Solo lectura: no tienes permiso para editar esta encuesta.</Notice>}

      <SurveyDetails survey={survey} canManage={canManage} onSaved={setSurvey} />

      <Card>
        <CardHeader
          title="Preguntas"
          description="Se muestran al cliente en este orden"
          action={
            canManage && (
              <Button size="sm" onClick={() => setEditing('new')}>
                <Plus className="h-4 w-4" /> Agregar pregunta
              </Button>
            )
          }
        />
        {questions.length === 0 ? (
          <EmptyState icon={ListChecks} title="Sin preguntas" description="Agrega al menos una pregunta para poder publicar la encuesta." />
        ) : (
          <ol className="divide-y divide-gray-100">
            {questions.map((q, i) => (
              <li key={q.id} className="flex items-start gap-3 px-5 py-4">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-800">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-gray-900">{q.question_text}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <Badge>{TYPE_LABEL[q.question_type]}</Badge>
                    {(q.question_type === 'nps' || q.question_type === 'rating') && (
                      <Badge tone="blue">
                        Escala {q.scale_min}–{q.scale_max}
                      </Badge>
                    )}
                    {q.critical_threshold !== null && <Badge tone="red">Crítica ≤ {q.critical_threshold}</Badge>}
                    {q.warning_threshold !== null && <Badge tone="amber">Advertencia ≤ {q.warning_threshold}</Badge>}
                    {q.question_type === 'multiple_choice' && <Badge tone="purple">{q.options?.length ?? 0} opciones</Badge>}
                    {!q.is_required && <Badge>Opcional</Badge>}
                  </div>
                </div>
                {canManage && (
                  <div className="flex shrink-0 items-center">
                    <Button size="sm" variant="ghost" aria-label="Subir" disabled={i === 0} onClick={() => move(i, -1)}>
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" aria-label="Bajar" disabled={i === questions.length - 1} onClick={() => move(i, 1)}>
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" aria-label="Editar" onClick={() => setEditing(q)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" aria-label="Quitar" onClick={() => remove(q)}>
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ol>
        )}
      </Card>

      {editing && (
        <QuestionBuilder
          surveyId={survey.id}
          question={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function SurveyDetails({ survey, canManage, onSaved }: { survey: Survey; canManage: boolean; onSaved: (s: Survey) => void }) {
  const [name, setName] = useState(survey.name);
  const [description, setDescription] = useState(survey.description ?? '');
  const [type, setType] = useState<SurveyType>(survey.survey_type);
  const [isPublic, setIsPublic] = useState(survey.is_public);
  const [isActive, setIsActive] = useState(survey.is_active);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const d = await api<{ survey: Survey }>(`/api/surveys/${survey.id}`, {
        method: 'PUT',
        json: { name, description: description || null, survey_type: type, is_public: isPublic, is_active: isActive },
      });
      onSaved(d.survey);
      setMsg({ tone: 'success', text: 'Cambios guardados' });
    } catch (e) {
      setMsg({ tone: 'error', text: errorText(e) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader title="Datos de la encuesta" />
      <CardBody className="space-y-4">
        {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Nombre" htmlFor="name">
            <Input id="name" value={name} maxLength={120} disabled={!canManage} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Tipo" htmlFor="type">
            <Select id="type" value={type} disabled={!canManage} onChange={(e) => setType(e.target.value as SurveyType)}>
              {Object.entries(SURVEY_TYPE_LABEL).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Mensaje de bienvenida" htmlFor="desc">
          <Textarea id="desc" value={description} maxLength={500} disabled={!canManage} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <div className="flex flex-wrap gap-6">
          <Checkbox label="Pública (se puede responder por QR)" checked={isPublic} disabled={!canManage} onChange={setIsPublic} />
          <Checkbox label="Activa" checked={isActive} disabled={!canManage} onChange={setIsActive} />
        </div>
        {canManage && (
          <div className="flex justify-end">
            <Button onClick={save} loading={saving}>
              Guardar cambios
            </Button>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
