'use client';

import { Activity, BarChart3, Clock, MessageSquareText, ShieldAlert, Smile, Star } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { AlertsList } from '@/components/dashboard/AlertsList';
import { BranchNpsChart } from '@/components/dashboard/charts/BranchNpsChart';
import { TrendChart } from '@/components/dashboard/charts/TrendChart';
import { MetricsCard } from '@/components/dashboard/MetricsCard';
import { Badge } from '@/components/ui/Badge';
import { Card, CardBody, CardHeader, PageHeader } from '@/components/ui/Card';
import { EmptyState, LoadingBlock, Notice } from '@/components/ui/Feedback';
import { Select } from '@/components/ui/Input';
import { Table, Td, Th } from '@/components/ui/Table';
import { api, errorText } from '@/lib/fetcher';
import { formatNumber, limaDayStartIso, todayInLima } from '@/lib/utils';
import type { DashboardMetrics } from '@/types/database';

const RANGES = [
  { value: '7', label: 'Últimos 7 días' },
  { value: '30', label: 'Últimos 30 días' },
  { value: '90', label: 'Últimos 90 días' },
];

function npsTone(nps: number | null) {
  if (nps === null) return 'gray' as const;
  if (nps >= 50) return 'green' as const;
  if (nps >= 0) return 'orange' as const;
  return 'red' as const;
}

export function DashboardView({
  scope,
  branches,
}: {
  scope: 'hq' | 'branch';
  branches: Array<{ id: string; name: string }>;
}) {
  const [range, setRange] = useState('30');
  const [branchId, setBranchId] = useState<string>(scope === 'branch' && branches.length === 1 ? branches[0].id : '');
  const [data, setData] = useState<DashboardMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const from = limaDayStartIso(todayInLima(-(Number(range) - 1)));
    const to = limaDayStartIso(todayInLima(1));
    const qs = new URLSearchParams({ from, to });
    if (branchId) qs.set('branches', branchId);
    try {
      const res = await api<{ metrics: DashboardMetrics }>(`/api/dashboard/metrics?${qs}`);
      setData(res.metrics);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
  }, [range, branchId]);

  useEffect(() => {
    load();
  }, [load]);

  const t = data?.totals;

  return (
    <>
      <PageHeader
        title={scope === 'hq' ? 'Dashboard casa matriz' : 'Dashboard de local'}
        description={scope === 'hq' ? 'Todas las sucursales de la empresa' : 'Tus sucursales asignadas'}
        action={
          <>
            {branches.length > 1 && (
              <Select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="w-52" aria-label="Sucursal">
                <option value="">Todas las sucursales</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </Select>
            )}
            <Select value={range} onChange={(e) => setRange(e.target.value)} className="w-44" aria-label="Periodo">
              {RANGES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </Select>
          </>
        }
      />

      {error && <Notice tone="error" className="mb-4">{error}</Notice>}

      {loading && !data ? (
        <LoadingBlock />
      ) : branches.length === 0 ? (
        <Card>
          <EmptyState title="Sin sucursales asignadas" description="Pide a tu administrador que te asigne al menos una sucursal." />
        </Card>
      ) : (
        t && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
              <MetricsCard label="Respuestas" value={formatNumber(t.responses)} icon={MessageSquareText} tone="blue" />
              <MetricsCard label="NPS" value={formatNumber(t.nps, 0)} hint="-100 a 100" icon={Activity} tone={npsTone(t.nps)} />
              <MetricsCard label="CSAT" value={t.csat === null ? '—' : `${formatNumber(t.csat, 0)}%`} hint="Clientes satisfechos" icon={Smile} />
              <MetricsCard label="Calificación" value={t.avg_rating === null ? '—' : `${formatNumber(t.avg_rating, 1)} / 5`} icon={Star} tone="orange" />
              <MetricsCard
                label="Alertas abiertas"
                value={formatNumber(t.alerts_open)}
                hint={`${t.alerts_critical_open} críticas · ${t.alerts_escalated} escaladas`}
                icon={ShieldAlert}
                tone={t.alerts_critical_open > 0 ? 'red' : 'gray'}
              />
              <MetricsCard
                label="SLA de alertas"
                value={t.sla_pct === null ? '—' : `${formatNumber(t.sla_pct, 0)}%`}
                hint={`Resueltas en ≤ ${data?.sla_hours} h${t.avg_resolution_hours !== null ? ` · prom. ${formatNumber(t.avg_resolution_hours, 1)} h` : ''}`}
                icon={Clock}
                tone="blue"
              />
            </div>

            <div className="grid gap-6 xl:grid-cols-3">
              <Card className="xl:col-span-2">
                <CardHeader title="Tendencia" description="Respuestas por día y NPS diario (hora de Lima)" />
                <CardBody>
                  {data.trend.length === 0 ? (
                    <EmptyState icon={BarChart3} title="Sin respuestas en este periodo" description="Coloca los QR en tus mesas para empezar a recibir opiniones." />
                  ) : (
                    <TrendChart data={data.trend} />
                  )}
                </CardBody>
              </Card>
              <AlertsList branchId={branchId || undefined} />
            </div>

            {data.by_branch.length > 1 && (
              <Card>
                <CardHeader title="Ranking de sucursales" description="Ordenado por número de respuestas" />
                <div className="grid gap-4 p-5 lg:grid-cols-2">
                  <BranchNpsChart data={data.by_branch} />
                  <Table>
                    <thead>
                      <tr>
                        <Th>Sucursal</Th>
                        <Th className="text-right">Resp.</Th>
                        <Th className="text-right">NPS</Th>
                        <Th className="text-right">CSAT</Th>
                        <Th className="text-right">Alertas</Th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {data.by_branch.map((b) => (
                        <tr key={b.branch_id}>
                          <Td className="font-medium text-gray-900">{b.name}</Td>
                          <Td className="tabular text-right">{formatNumber(b.responses)}</Td>
                          <Td className="tabular text-right">{formatNumber(b.nps)}</Td>
                          <Td className="tabular text-right">{b.csat === null ? '—' : `${formatNumber(b.csat)}%`}</Td>
                          <Td className="text-right">
                            {b.alerts_open > 0 ? <Badge tone="red">{b.alerts_open}</Badge> : <span className="text-gray-400">0</span>}
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              </Card>
            )}
          </div>
        )
      )}
    </>
  );
}
