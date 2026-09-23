'use client';

import { ShieldCheck } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import type { AlertRow } from '@/components/dashboard/AlertsList';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, PageHeader } from '@/components/ui/Card';
import { EmptyState, LoadingBlock, Notice } from '@/components/ui/Feedback';
import { Field, Select, Textarea } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Table, Td, Th } from '@/components/ui/Table';
import { useAuth } from '@/contexts/AuthContext';
import { api, errorText } from '@/lib/fetcher';
import { ALERT_STATUS_LABEL, SEVERITY_LABEL, formatDateTime, timeAgo } from '@/lib/utils';
import type { AlertStatus } from '@/types/database';

export function AlertsManager({ branches }: { branches: Array<{ id: string; name: string }> }) {
  const params = useSearchParams();
  const router = useRouter();
  const { can, profile } = useAuth();

  const [status, setStatus] = useState(params.get('status') ?? 'active');
  const [severity, setSeverity] = useState(params.get('severity') ?? '');
  const [branch, setBranch] = useState(params.get('branch') ?? '');
  const escalated = params.get('escalated') === '1';

  const [alerts, setAlerts] = useState<AlertRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<AlertRow | null>(null);

  const load = useCallback(async () => {
    const qs = new URLSearchParams({ status });
    if (severity) qs.set('severity', severity);
    if (branch) qs.set('branch', branch);
    if (escalated) qs.set('escalated', '1');
    try {
      const d = await api<{ alerts: AlertRow[] }>(`/api/alerts?${qs}`);
      setAlerts(d.alerts);
    } catch (e) {
      setError(errorText(e));
      setAlerts([]);
    }
  }, [status, severity, branch, escalated]);

  useEffect(() => {
    load();
  }, [load]);

  // Enlace directo desde email/notificación: /alerts?id=<uuid>
  useEffect(() => {
    const id = params.get('id');
    if (!id) return;
    api<{ alerts: AlertRow[] }>(`/api/alerts?status=all&id=${encodeURIComponent(id)}`)
      .then((d) => d.alerts[0] && setSelected(d.alerts[0]))
      .catch(() => null);
  }, [params]);

  const canManage = useCallback(
    (a: AlertRow) =>
      can('manage_alerts_regional') || (can('manage_alerts_local') && profile.branch_ids.includes(a.branch_id)),
    [can, profile.branch_ids],
  );

  const counts = useMemo(() => {
    const list = alerts ?? [];
    return { critical: list.filter((a) => a.severity === 'critical').length, total: list.length };
  }, [alerts]);

  function closeModal() {
    setSelected(null);
    if (params.get('id')) router.replace('/alerts');
  }

  return (
    <>
      <PageHeader
        title="Alertas"
        description="Calificaciones por debajo de los umbrales configurados en cada pregunta"
        action={
          <>
            <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-40" aria-label="Estado">
              <option value="active">Activas</option>
              <option value="open">Abiertas</option>
              <option value="in_review">En revisión</option>
              <option value="resolved">Resueltas</option>
              <option value="all">Todas</option>
            </Select>
            <Select value={severity} onChange={(e) => setSeverity(e.target.value)} className="w-40" aria-label="Severidad">
              <option value="">Toda severidad</option>
              <option value="critical">Críticas</option>
              <option value="warning">Advertencias</option>
            </Select>
            {branches.length > 1 && (
              <Select value={branch} onChange={(e) => setBranch(e.target.value)} className="w-48" aria-label="Sucursal">
                <option value="">Todas las sucursales</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </Select>
            )}
          </>
        }
      />

      {escalated && (
        <Notice tone="warning" className="mb-4">
          Mostrando solo alertas escaladas a casa matriz.{' '}
          <button className="font-semibold underline" onClick={() => router.replace('/alerts')}>
            Quitar filtro
          </button>
        </Notice>
      )}
      {error && <Notice tone="error" className="mb-4">{error}</Notice>}

      <Card>
        {alerts === null ? (
          <LoadingBlock />
        ) : alerts.length === 0 ? (
          <EmptyState icon={ShieldCheck} title="No hay alertas con estos filtros" />
        ) : (
          <>
            <p className="border-b border-gray-100 px-5 py-3 text-sm text-gray-500">
              {counts.total} alertas · <span className="font-medium text-red-600">{counts.critical} críticas</span>
            </p>
            <Table>
              <thead>
                <tr>
                  <Th>Severidad</Th>
                  <Th>Pregunta</Th>
                  <Th>Sucursal</Th>
                  <Th className="text-right">Nota</Th>
                  <Th>Estado</Th>
                  <Th>Recibida</Th>
                  <Th />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {alerts.map((a) => (
                  <tr key={a.id} className="hover:bg-gray-50">
                    <Td>
                      <Badge tone={a.severity === 'critical' ? 'red' : 'amber'}>{SEVERITY_LABEL[a.severity]}</Badge>
                    </Td>
                    <Td className="max-w-xs">
                      <p className="truncate font-medium text-gray-900">{a.survey_questions?.question_text ?? a.metric_type}</p>
                      {a.responses?.comments && <p className="truncate text-xs text-gray-500">“{a.responses.comments}”</p>}
                    </Td>
                    <Td className="whitespace-nowrap">{a.branches?.name}</Td>
                    <Td className="tabular text-right font-semibold">{a.metric_value}</Td>
                    <Td>
                      <div className="flex flex-wrap gap-1">
                        <Badge tone={a.status === 'resolved' ? 'green' : a.status === 'in_review' ? 'blue' : 'gray'}>
                          {ALERT_STATUS_LABEL[a.status]}
                        </Badge>
                        {a.escalated_to_hq && <Badge tone="purple">Escalada HQ</Badge>}
                      </div>
                    </Td>
                    <Td className="whitespace-nowrap text-gray-500" title={formatDateTime(a.created_at)}>
                      {timeAgo(a.created_at)}
                    </Td>
                    <Td className="text-right">
                      <Button size="sm" variant="outline" onClick={() => setSelected(a)}>
                        {canManage(a) && a.status !== 'resolved' ? 'Gestionar' : 'Ver'}
                      </Button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </>
        )}
      </Card>

      {selected && (
        <AlertDetail
          alert={selected}
          canManage={canManage(selected)}
          onClose={closeModal}
          onSaved={() => {
            closeModal();
            load();
          }}
        />
      )}
    </>
  );
}

function AlertDetail({
  alert,
  canManage,
  onClose,
  onSaved,
}: {
  alert: AlertRow;
  canManage: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [status, setStatus] = useState<AlertStatus>(alert.status);
  const [note, setNote] = useState(alert.resolution_note ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await api(`/api/alerts/${alert.id}`, { method: 'PUT', json: { status, resolution_note: note || null } });
      onSaved();
    } catch (e) {
      setError(errorText(e));
      setSaving(false);
    }
  }

  const rows: Array<[string, ReactNode]> = [
    ['Sucursal', alert.branches?.name],
    ['Pregunta', alert.survey_questions?.question_text ?? alert.metric_type],
    ['Calificación', `${alert.metric_value} (umbral ${alert.threshold})`],
    ['Mesa', alert.responses?.table_number ?? '—'],
    ['Comentario del cliente', alert.responses?.comments ? `“${alert.responses.comments}”` : '—'],
    ['Recibida', formatDateTime(alert.created_at)],
    ['Escalada a HQ', alert.escalated_to_hq ? formatDateTime(alert.escalated_at) : 'No'],
    ['Resuelta', formatDateTime(alert.resolved_at)],
  ];

  return (
    <Modal
      open
      onClose={onClose}
      title={`Alerta ${SEVERITY_LABEL[alert.severity].toLowerCase()}`}
      footer={
        canManage ? (
          <>
            <Button variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={save} loading={saving}>
              Guardar
            </Button>
          </>
        ) : (
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
        )
      }
    >
      <dl className="grid grid-cols-3 gap-x-3 gap-y-2 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-gray-500">{k}</dt>
            <dd className="col-span-2 text-gray-900">{v}</dd>
          </div>
        ))}
      </dl>

      {canManage ? (
        <div className="mt-5 space-y-4 border-t border-gray-100 pt-4">
          {error && <Notice tone="error">{error}</Notice>}
          <Field label="Estado" htmlFor="status">
            <Select id="status" value={status} onChange={(e) => setStatus(e.target.value as AlertStatus)}>
              <option value="open">Abierta</option>
              <option value="in_review">En revisión</option>
              <option value="resolved">Resuelta</option>
            </Select>
          </Field>
          <Field
            label="Nota de seguimiento"
            htmlFor="note"
            hint={status === 'resolved' ? 'Obligatoria para resolver: ¿qué se hizo?' : undefined}
          >
            <Textarea id="note" maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
        </div>
      ) : (
        alert.resolution_note && (
          <div className="mt-5 rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
            <p className="mb-1 font-medium">Nota</p>
            {alert.resolution_note}
          </div>
        )
      )}
    </Modal>
  );
}
