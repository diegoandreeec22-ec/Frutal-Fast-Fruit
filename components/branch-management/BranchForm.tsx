'use client';

import { useState, type FormEvent } from 'react';

import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Feedback';
import { Field, Input, Select } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { api, errorText } from '@/lib/fetcher';
import { SURVEY_TYPE_LABEL, slugify } from '@/lib/utils';
import type { Branch, Survey } from '@/types/database';

export function BranchForm({
  branch,
  surveys,
  onClose,
  onSaved,
}: {
  branch: Branch | null;
  surveys: Survey[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(branch?.name ?? '');
  const [slug, setSlug] = useState(branch?.slug ?? '');
  const [slugTouched, setSlugTouched] = useState(!!branch);
  const [address, setAddress] = useState(branch?.address ?? '');
  const [defaultSurvey, setDefaultSurvey] = useState(branch?.default_survey_id ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const payload = { name, slug, address: address || null, default_survey_id: defaultSurvey || null };
    try {
      if (branch) await api(`/api/branches/${branch.id}`, { method: 'PUT', json: payload });
      else await api('/api/branches', { method: 'POST', json: payload });
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
      title={branch ? 'Editar sucursal' : 'Nueva sucursal'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="branch-form" loading={saving}>
            Guardar
          </Button>
        </>
      }
    >
      <form id="branch-form" onSubmit={onSubmit} className="space-y-4">
        {error && <Notice tone="error">{error}</Notice>}
        <Field label="Nombre" htmlFor="b-name">
          <Input
            id="b-name"
            required
            maxLength={120}
            value={name}
            placeholder="Frutal San Isidro"
            onChange={(e) => {
              setName(e.target.value);
              if (!slugTouched) setSlug(slugify(e.target.value.replace(/^frutal\s+/i, '')));
            }}
          />
        </Field>
        <Field
          label="Identificador para el enlace"
          htmlFor="b-slug"
          hint={branch ? 'Si lo cambias, los QR ya impresos dejarán de funcionar.' : `Enlace: /s/${slug || 'mi-sucursal'}`}
        >
          <Input
            id="b-slug"
            required
            value={slug}
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(e.target.value.toLowerCase());
            }}
          />
        </Field>
        <Field label="Dirección" htmlFor="b-address">
          <Input id="b-address" maxLength={250} value={address} onChange={(e) => setAddress(e.target.value)} />
        </Field>
        <Field
          label="Encuesta predeterminada"
          htmlFor="b-survey"
          hint="Se usa cuando el QR no indica una encuesta. Si no eliges, se usa la primera de tipo Salón."
        >
          <Select id="b-survey" value={defaultSurvey} onChange={(e) => setDefaultSurvey(e.target.value)}>
            <option value="">Automática (Salón)</option>
            {surveys.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} · {SURVEY_TYPE_LABEL[s.survey_type]}
              </option>
            ))}
          </Select>
        </Field>
      </form>
    </Modal>
  );
}
