'use client';

import { ChevronLeft, ChevronRight, MessageSquareText } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, PageHeader } from '@/components/ui/Card';
import { EmptyState, LoadingBlock, Notice } from '@/components/ui/Feedback';
import { Select } from '@/components/ui/Input';
import { api, errorText } from '@/lib/fetcher';
import { formatDateTime } from '@/lib/utils';

interface ResponseRow {
  id: string;
  table_number: number | null;
  channel: string;
  comments: string | null;
  created_at: string;
  branches: { name: string } | null;
  surveys: { name: string } | null;
  response_answers: Array<{
    answer_value: number | string;
    survey_questions: { question_text: string; question_type: string; order_index: number; scale_max: number } | null;
  }>;
}

const PAGE = 20;

function scoreTone(value: number, max: number) {
  const pct = value / max;
  if (pct >= 0.8) return 'green' as const;
  if (pct >= 0.6) return 'amber' as const;
  return 'red' as const;
}

export function ResponsesList({ branches }: { branches: Array<{ id: string; name: string }> }) {
  const [branch, setBranch] = useState('');
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<ResponseRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setRows(null);
    const qs = new URLSearchParams({ page: String(page), size: String(PAGE) });
    if (branch) qs.set('branch', branch);
    api<{ responses: ResponseRow[]; total: number }>(`/api/responses?${qs}`)
      .then((d) => {
        setRows(d.responses);
        setTotal(d.total);
      })
      .catch((e) => {
        setError(errorText(e));
        setRows([]);
      });
  }, [branch, page]);

  const pages = Math.max(1, Math.ceil(total / PAGE));

  return (
    <>
      <PageHeader
        title="Respuestas"
        description={`${total} respuestas recibidas`}
        action={
          branches.length > 1 && (
            <Select
              value={branch}
              onChange={(e) => {
                setBranch(e.target.value);
                setPage(0);
              }}
              className="w-52"
              aria-label="Sucursal"
            >
              <option value="">Todas las sucursales</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          )
        }
      />
      {error && <Notice tone="error" className="mb-4">{error}</Notice>}

      {rows === null ? (
        <LoadingBlock />
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState icon={MessageSquareText} title="Aún no hay respuestas" description="Las respuestas de los clientes aparecerán aquí." />
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => {
            const answers = [...r.response_answers].sort(
              (a, b) => (a.survey_questions?.order_index ?? 0) - (b.survey_questions?.order_index ?? 0),
            );
            return (
              <Card key={r.id} className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-semibold text-gray-900">{r.branches?.name}</span>
                    <Badge>{r.surveys?.name}</Badge>
                    {r.table_number && <Badge tone="blue">Mesa {r.table_number}</Badge>}
                  </div>
                  <span className="text-xs text-gray-500">{formatDateTime(r.created_at)}</span>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {answers.map((a, i) => {
                    const q = a.survey_questions;
                    const numeric = typeof a.answer_value === 'number';
                    return (
                      <div key={i} className="rounded-lg bg-gray-50 px-3 py-2">
                        <p className="line-clamp-1 text-xs text-gray-500" title={q?.question_text}>
                          {q?.question_text}
                        </p>
                        {numeric && q ? (
                          <Badge tone={scoreTone(a.answer_value as number, q.scale_max)} className="mt-1">
                            {a.answer_value} / {q.scale_max}
                          </Badge>
                        ) : (
                          <p className="mt-0.5 text-sm text-gray-800">{String(a.answer_value)}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
                {r.comments && <p className="mt-3 text-sm italic text-gray-700">“{r.comments}”</p>}
              </Card>
            );
          })}
          <div className="flex items-center justify-between pt-2">
            <p className="text-sm text-gray-500">
              Página {page + 1} de {pages}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft className="h-4 w-4" /> Anterior
              </Button>
              <Button variant="outline" size="sm" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}>
                Siguiente <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
