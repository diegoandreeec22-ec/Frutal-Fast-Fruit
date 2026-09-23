'use client';

import { CheckCircle2, Loader2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';

import { LogoMark } from '@/components/Logo';
import { QuestionRenderer, type AnswerValue } from '@/components/survey/QuestionRenderer';
import { cn } from '@/lib/utils';
import type { PublicSurvey } from '@/types/database';

type SourceType = 'qr' | 'nfc_dynamic' | 'direct' | 'link';

export function PublicSurveyForm({
  data,
  tableNumber,
  sourceType,
}: {
  data: PublicSurvey;
  tableNumber: number | null;
  sourceType: SourceType;
}) {
  const color = data.company.primary_color || '#2E7D32';
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [missing, setMissing] = useState<string[]>([]);
  const [honeypot, setHoneypot] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const isAnswered = (v: AnswerValue | undefined) =>
    v !== undefined && v !== null && !(typeof v === 'string' && v.trim() === '');

  const required = data.questions.filter((q) => q.is_required);
  const answeredRequired = required.filter((q) => isAnswered(answers[q.id])).length;
  const progress = required.length ? Math.round((answeredRequired / required.length) * 100) : 100;

  function set(id: string, v: AnswerValue) {
    setAnswers((prev) => ({ ...prev, [id]: v }));
    setMissing((prev) => prev.filter((m) => m !== id));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const miss = required.filter((q) => !isAnswered(answers[q.id])).map((q) => q.id);
    if (miss.length) {
      setMissing(miss);
      document.getElementById(`q-${miss[0]}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    setSending(true);
    setError(null);
    const clean = Object.fromEntries(Object.entries(answers).filter(([, v]) => isAnswered(v)));
    try {
      const res = await fetch('/api/surveys/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branch_id: data.branch.id,
          survey_id: data.survey.id,
          answers: clean,
          table_number: tableNumber,
          source_type: sourceType,
          website: honeypot,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? 'No pudimos enviar tu respuesta');
      setDone(true);
      window.scrollTo({ top: 0 });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  }

  const header = (
    <header className="px-5 pb-6 pt-8 text-white" style={{ backgroundColor: color }}>
      <div className="mx-auto flex max-w-xl items-center gap-3">
        {data.company.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={data.company.logo_url} alt="" className="h-12 w-12 rounded-xl bg-white object-cover" />
        ) : (
          <LogoMark className="h-12 w-12 rounded-xl ring-2 ring-white/40" />
        )}
        <div>
          <p className="text-lg font-bold leading-tight">{data.company.name}</p>
          <p className="text-sm opacity-90">
            {data.branch.name}
            {tableNumber ? ` · Mesa ${tableNumber}` : ''}
          </p>
        </div>
      </div>
    </header>
  );

  if (done) {
    return (
      <main className="min-h-screen bg-gray-50">
        {header}
        <div className="mx-auto -mt-3 max-w-xl px-4">
          <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
            <CheckCircle2 className="mx-auto h-16 w-16" style={{ color }} />
            <h1 className="mt-4 text-2xl font-bold text-gray-900">¡Gracias por tu opinión!</h1>
            <p className="mt-2 text-gray-600">Nos ayuda a mejorar cada día. ¡Te esperamos pronto! 🍓🥭🍍</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 pb-28">
      {header}
      <div className="sticky top-0 z-10 h-1.5 bg-gray-200">
        <div className="h-full transition-all duration-300" style={{ width: `${progress}%`, backgroundColor: color }} />
      </div>

      <form onSubmit={onSubmit} className="mx-auto max-w-xl space-y-4 px-4 pt-5" noValidate>
        <div className="px-1">
          <h1 className="text-xl font-bold text-gray-900">{data.survey.name}</h1>
          {data.survey.description && <p className="mt-1 text-gray-600">{data.survey.description}</p>}
        </div>

        {data.questions.map((q, i) => (
          <section
            key={q.id}
            id={`q-${q.id}`}
            className={cn(
              'rounded-2xl bg-white p-5 shadow-sm ring-1 transition-colors',
              missing.includes(q.id) ? 'ring-2 ring-red-400' : 'ring-gray-100',
            )}
          >
            <p className="mb-4 font-semibold text-gray-900">
              <span className="mr-1 text-gray-400">{i + 1}.</span> {q.question_text}
              {!q.is_required && <span className="ml-1 text-xs font-normal text-gray-400">(opcional)</span>}
            </p>
            <QuestionRenderer question={q} value={answers[q.id] ?? null} onChange={(v) => set(q.id, v)} color={color} />
            {missing.includes(q.id) && <p className="mt-2 text-sm text-red-600">Esta pregunta es obligatoria</p>}
          </section>
        ))}

        {/* Honeypot anti-bots: invisible para personas */}
        <div className="absolute -left-[9999px] h-0 overflow-hidden" aria-hidden>
          <label>
            No llenar
            <input tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
          </label>
        </div>

        {error && (
          <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">
            {error}
          </p>
        )}

        <div className="fixed inset-x-0 bottom-0 border-t border-gray-200 bg-white/95 p-4 backdrop-blur">
          <button
            type="submit"
            disabled={sending}
            className="mx-auto flex h-14 w-full max-w-xl items-center justify-center gap-2 rounded-2xl text-lg font-semibold text-white shadow-lg disabled:opacity-70"
            style={{ backgroundColor: color }}
          >
            {sending && <Loader2 className="h-5 w-5 animate-spin" />}
            Enviar opinión
          </button>
        </div>
      </form>
    </main>
  );
}
