'use client';

import { Copy, Download, Printer } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader, PageHeader } from '@/components/ui/Card';
import { EmptyState, Notice } from '@/components/ui/Feedback';
import { Field, Input, Select } from '@/components/ui/Input';
import { api, errorText } from '@/lib/fetcher';
import { SURVEY_TYPE_LABEL, slugify } from '@/lib/utils';
import type { SurveyType } from '@/types/database';

interface Props {
  branches: Array<{ id: string; name: string; slug: string }>;
  surveys: Array<{ id: string; name: string; survey_type: SurveyType; branch_id: string | null }>;
  initialBranch?: string;
}

export function QrGenerator({ branches, surveys, initialBranch }: Props) {
  const [branchId, setBranchId] = useState(
    branches.find((b) => b.id === initialBranch)?.id ?? branches[0]?.id ?? '',
  );
  const [surveyId, setSurveyId] = useState('');
  const [table, setTable] = useState('');
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const canvasWrap = useRef<HTMLDivElement>(null);

  const branch = branches.find((b) => b.id === branchId);
  const availableSurveys = surveys.filter((s) => !s.branch_id || s.branch_id === branchId);

  useEffect(() => {
    if (!branchId) return;
    const tableNumber = table ? Number(table) : null;
    if (tableNumber !== null && (!Number.isInteger(tableNumber) || tableNumber < 1 || tableNumber > 999)) {
      setError('La mesa debe ser un número entre 1 y 999');
      return;
    }
    setError(null);
    const handle = setTimeout(() => {
      api<{ url: string }>('/api/qr/generate', {
        method: 'POST',
        json: { branch_id: branchId, survey_id: surveyId || null, table_number: tableNumber },
      })
        .then((d) => setUrl(d.url))
        .catch((e) => setError(errorText(e)));
    }, 250);
    return () => clearTimeout(handle);
  }, [branchId, surveyId, table]);

  function download() {
    const canvas = canvasWrap.current?.querySelector('canvas');
    if (!canvas || !branch) return;
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `qr-${branch.slug}${table ? `-mesa-${table}` : ''}${surveyId ? `-${slugify(surveys.find((s) => s.id === surveyId)?.name ?? '')}` : ''}.png`;
    a.click();
  }

  async function copy() {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (branches.length === 0) {
    return (
      <>
        <PageHeader title="Códigos QR" />
        <Card>
          <EmptyState title="No hay sucursales activas" />
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Códigos QR" description="Genera el QR para mesas, mostrador o bolsas de delivery" />
      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="no-print lg:col-span-2">
          <CardHeader title="Configuración" />
          <CardBody className="space-y-4">
            <Field label="Sucursal" htmlFor="qr-branch">
              <Select
                id="qr-branch"
                value={branchId}
                onChange={(e) => {
                  setBranchId(e.target.value);
                  setSurveyId('');
                }}
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Encuesta" htmlFor="qr-survey" hint="Si eliges “Predeterminada”, podrás cambiar la encuesta luego sin reimprimir el QR.">
              <Select id="qr-survey" value={surveyId} onChange={(e) => setSurveyId(e.target.value)}>
                <option value="">Predeterminada de la sucursal</option>
                {availableSurveys.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} · {SURVEY_TYPE_LABEL[s.survey_type]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Número de mesa (opcional)" htmlFor="qr-table">
              <Input id="qr-table" type="number" min={1} max={999} value={table} onChange={(e) => setTable(e.target.value)} />
            </Field>
            {error && <Notice tone="error">{error}</Notice>}
          </CardBody>
        </Card>

        <Card className="lg:col-span-3">
          <CardBody className="flex flex-col items-center py-8 text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-brand-700">Frutal Fast Fruit</p>
            <h2 className="mt-1 text-xl font-bold text-gray-900">¿Cómo estuvo tu experiencia?</h2>
            <p className="mb-5 text-sm text-gray-500">
              Escanea y cuéntanos · {branch?.name}
              {table ? ` · Mesa ${table}` : ''}
            </p>
            <div ref={canvasWrap} className="rounded-2xl border-4 border-brand-700 bg-white p-4">
              {url ? (
                <QRCodeCanvas value={url} size={240} level="M" marginSize={1} fgColor="#1B5E20" />
              ) : (
                <div className="h-[240px] w-[240px] animate-pulse rounded bg-gray-100" />
              )}
            </div>
            {url && <p className="mt-4 break-all text-xs text-gray-500">{url}</p>}
            <div className="no-print mt-6 flex flex-wrap justify-center gap-2">
              <Button onClick={download} disabled={!url}>
                <Download className="h-4 w-4" /> Descargar PNG
              </Button>
              <Button variant="outline" onClick={() => window.print()} disabled={!url}>
                <Printer className="h-4 w-4" /> Imprimir
              </Button>
              <Button variant="ghost" onClick={copy} disabled={!url}>
                <Copy className="h-4 w-4" /> {copied ? '¡Copiado!' : 'Copiar enlace'}
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
