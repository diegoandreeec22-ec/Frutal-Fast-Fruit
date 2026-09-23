'use client';

import { ArrowUpRight, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { Badge } from '@/components/ui/Badge';
import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState, LoadingBlock } from '@/components/ui/Feedback';
import { api } from '@/lib/fetcher';
import { ALERT_STATUS_LABEL, SEVERITY_LABEL, timeAgo } from '@/lib/utils';
import type { Alert } from '@/types/database';

export type AlertRow = Alert & {
  branches: { name: string } | null;
  survey_questions: { question_text: string } | null;
  responses: { table_number: number | null; comments: string | null } | null;
};

export function AlertsList({ branchId, reloadKey }: { branchId?: string; reloadKey?: unknown }) {
  const [alerts, setAlerts] = useState<AlertRow[] | null>(null);

  useEffect(() => {
    const qs = new URLSearchParams({ status: 'active', limit: '6' });
    if (branchId) qs.set('branch', branchId);
    api<{ alerts: AlertRow[] }>(`/api/alerts?${qs}`)
      .then((d) => setAlerts(d.alerts))
      .catch(() => setAlerts([]));
  }, [branchId, reloadKey]);

  return (
    <Card>
      <CardHeader
        title="Alertas activas"
        description="Las más recientes sin resolver"
        action={
          <Link href="/alerts" className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline">
            Ver todas <ArrowUpRight className="h-4 w-4" />
          </Link>
        }
      />
      {alerts === null ? (
        <LoadingBlock />
      ) : alerts.length === 0 ? (
        <EmptyState icon={ShieldCheck} title="Sin alertas activas" description="¡Buen trabajo! No hay calificaciones bajas pendientes." />
      ) : (
        <ul className="divide-y divide-gray-100">
          {alerts.map((a) => (
            <li key={a.id}>
              <Link href={`/alerts?id=${a.id}`} className="flex items-start gap-3 px-5 py-3 hover:bg-gray-50">
                <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${a.severity === 'critical' ? 'bg-red-500' : 'bg-amber-400'}`} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900">
                    {a.survey_questions?.question_text ?? a.metric_type}
                  </p>
                  <p className="text-xs text-gray-500">
                    {a.branches?.name} · nota {a.metric_value}
                    {a.responses?.table_number ? ` · mesa ${a.responses.table_number}` : ''} · {timeAgo(a.created_at)}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <Badge tone={a.severity === 'critical' ? 'red' : 'amber'}>{SEVERITY_LABEL[a.severity]}</Badge>
                  {a.escalated_to_hq ? <Badge tone="purple">Escalada</Badge> : <Badge>{ALERT_STATUS_LABEL[a.status]}</Badge>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
