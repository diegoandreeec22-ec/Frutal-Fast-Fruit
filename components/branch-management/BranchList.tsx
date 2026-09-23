'use client';

import { Building2, Plus, QrCode } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import { BranchForm } from '@/components/branch-management/BranchForm';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, PageHeader } from '@/components/ui/Card';
import { EmptyState, LoadingBlock, Notice } from '@/components/ui/Feedback';
import { Table, Td, Th } from '@/components/ui/Table';
import { useAuth } from '@/contexts/AuthContext';
import { api, errorText } from '@/lib/fetcher';
import type { Branch, Survey } from '@/types/database';

export function BranchList() {
  const { can } = useAuth();
  const canManage = can('manage_branches');
  const [branches, setBranches] = useState<Branch[] | null>(null);
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [editing, setEditing] = useState<Branch | 'new' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [b, s] = await Promise.all([
        api<{ branches: Branch[] }>('/api/branches'),
        api<{ surveys: Survey[] }>('/api/surveys'),
      ]);
      setBranches(b.branches);
      setSurveys(s.surveys);
    } catch (e) {
      setError(errorText(e));
      setBranches([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function toggle(b: Branch) {
    if (b.is_active && !confirm(`¿Desactivar ${b.name}? Su QR dejará de funcionar. El historial se conserva.`)) return;
    try {
      await api(`/api/branches/${b.id}`, { method: 'PUT', json: { is_active: !b.is_active } });
      load();
    } catch (e) {
      setError(errorText(e));
    }
  }

  const surveyName = (id: string | null) => surveys.find((s) => s.id === id)?.name;

  return (
    <>
      <PageHeader
        title="Sucursales"
        description="Cada sucursal tiene su propio enlace y QR de encuesta"
        action={
          canManage && (
            <Button onClick={() => setEditing('new')}>
              <Plus className="h-4 w-4" /> Nueva sucursal
            </Button>
          )
        }
      />
      {error && <Notice tone="error" className="mb-4">{error}</Notice>}

      <Card>
        {branches === null ? (
          <LoadingBlock />
        ) : branches.length === 0 ? (
          <EmptyState icon={Building2} title="Sin sucursales" description={canManage ? 'Crea tu primera sucursal.' : 'No tienes sucursales asignadas.'} />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Sucursal</Th>
                <Th>Enlace público</Th>
                <Th>Encuesta predeterminada</Th>
                <Th>Estado</Th>
                <Th />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {branches.map((b) => (
                <tr key={b.id} className={b.is_active ? '' : 'opacity-60'}>
                  <Td>
                    <p className="font-medium text-gray-900">{b.name}</p>
                    {b.address && <p className="text-xs text-gray-500">{b.address}</p>}
                  </Td>
                  <Td>
                    <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">/s/{b.slug}</code>
                  </Td>
                  <Td>{surveyName(b.default_survey_id) ?? <span className="text-gray-400">Automática (Salón)</span>}</Td>
                  <Td>{b.is_active ? <Badge tone="green">Activa</Badge> : <Badge tone="red">Inactiva</Badge>}</Td>
                  <Td className="whitespace-nowrap text-right">
                    <Link href={`/qr?branch=${b.id}`}>
                      <Button size="sm" variant="ghost" disabled={!b.is_active}>
                        <QrCode className="h-4 w-4" /> QR
                      </Button>
                    </Link>
                    {canManage && (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => setEditing(b)}>
                          Editar
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => toggle(b)}>
                          {b.is_active ? 'Desactivar' : 'Activar'}
                        </Button>
                      </>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      {editing && (
        <BranchForm
          branch={editing === 'new' ? null : editing}
          surveys={surveys.filter(
            (s) => s.is_active && s.is_public && (!s.branch_id || (editing !== 'new' && s.branch_id === editing.id)),
          )}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </>
  );
}
