'use client';

import { Upload } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

import { LogoMark } from '@/components/Logo';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader, PageHeader } from '@/components/ui/Card';
import { Notice } from '@/components/ui/Feedback';
import { Field, Input } from '@/components/ui/Input';
import { api, errorText } from '@/lib/fetcher';
import type { Company } from '@/types/database';

export function SettingsForm({ company }: { company: Company }) {
  const router = useRouter();
  const [name, setName] = useState(company.name);
  const [color, setColor] = useState(company.primary_color);
  const [sla, setSla] = useState(company.sla_hours);
  const [logoUrl, setLogoUrl] = useState(company.logo_url);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      await api('/api/settings', { method: 'PUT', json: { name, primary_color: color, sla_hours: sla } });
      setMsg({ tone: 'success', text: 'Configuración guardada' });
      router.refresh();
    } catch (e) {
      setMsg({ tone: 'error', text: errorText(e) });
    } finally {
      setSaving(false);
    }
  }

  async function upload(file: File) {
    setUploading(true);
    setMsg(null);
    const form = new FormData();
    form.append('file', file);
    try {
      const res = await fetch('/api/settings/logo', { method: 'POST', body: form });
      const data = (await res.json()) as { logo_url?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Error al subir');
      setLogoUrl(data.logo_url ?? null);
      setMsg({ tone: 'success', text: 'Logo actualizado' });
      router.refresh();
    } catch (e) {
      setMsg({ tone: 'error', text: (e as Error).message });
    } finally {
      setUploading(false);
    }
  }

  async function removeLogo() {
    try {
      await api('/api/settings', { method: 'PUT', json: { logo_url: null } });
      setLogoUrl(null);
      router.refresh();
    } catch (e) {
      setMsg({ tone: 'error', text: errorText(e) });
    }
  }

  return (
    <>
      <PageHeader title="Configuración" description="Marca y parámetros de la empresa" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Marca" description="Se muestra en el panel y en la encuesta pública" />
          <CardBody className="space-y-5">
            {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
            <div className="flex items-center gap-4">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt="Logo" className="h-16 w-16 rounded-xl border border-gray-200 object-cover" />
              ) : (
                <LogoMark className="h-16 w-16" />
              )}
              <div className="flex flex-wrap gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
                />
                <Button variant="outline" size="sm" loading={uploading} onClick={() => fileRef.current?.click()}>
                  <Upload className="h-4 w-4" /> Subir logo
                </Button>
                {logoUrl && (
                  <Button variant="ghost" size="sm" onClick={removeLogo}>
                    Quitar
                  </Button>
                )}
                <p className="w-full text-xs text-gray-500">PNG, JPG o WEBP · máx. 1 MB · cuadrado</p>
              </div>
            </div>
            <Field label="Nombre comercial" htmlFor="c-name">
              <Input id="c-name" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Color principal" htmlFor="c-color" hint="Color de botones y acentos en la encuesta pública">
              <div className="flex gap-2">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value.toUpperCase())}
                  className="h-10 w-14 cursor-pointer rounded-lg border border-gray-300"
                  aria-label="Selector de color"
                />
                <Input id="c-color" value={color} maxLength={7} onChange={(e) => setColor(e.target.value)} />
              </div>
            </Field>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Alertas" description="Parámetros de seguimiento" />
          <CardBody className="space-y-5">
            <Field
              label="SLA de resolución (horas)"
              htmlFor="c-sla"
              hint="Tiempo objetivo para resolver una alerta. Se usa en la métrica “SLA de alertas”."
            >
              <Input id="c-sla" type="number" min={1} max={720} value={sla} onChange={(e) => setSla(Number(e.target.value))} />
            </Field>
            <div className="rounded-lg bg-gray-50 p-4 text-sm text-gray-600">
              <p className="font-medium text-gray-800">Regla de escalamiento</p>
              <p className="mt-1">
                Cuando una sucursal acumula <strong>3 respuestas con alerta crítica en 7 días</strong>, se escala de inmediato a
                casa matriz y se notifica por correo al gerente del local y a los gerentes de HQ.
              </p>
            </div>
            <div className="text-sm text-gray-500">
              Zona horaria: <strong>{company.timezone}</strong> · Formato: <strong>{company.locale}</strong>
            </div>
          </CardBody>
        </Card>
      </div>
      <div className="mt-6 flex justify-end">
        <Button onClick={save} loading={saving}>
          Guardar configuración
        </Button>
      </div>
    </>
  );
}
