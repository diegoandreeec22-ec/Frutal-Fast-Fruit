'use client';

import { ClipboardList, ExternalLink, Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, type FormEvent } from 'react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, PageHeader } from '@/components/ui/Card';
import { EmptyState, LoadingBlock, Notice } from '@/components/ui/Feedback';
import { Checkbox, Field, Input, Select, Textarea } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { useAuth } from '@/contexts/AuthContext';
import { api, errorText } from '@/lib/fetcher';
import { SURVEY_TYPE_LABEL } from '@/lib/utils';
import type { Survey, SurveyType } from '@/types/database';

type SurveyRow = Survey & { survey_questions: Array<{ count: number }> };
type BranchOption = { id: string; name: string; slug: string };

export function SurveysManager({ branches }: { branches: BranchOption[] }) {
  const { can, profile } = useAuth();
  const [surveys, setSurveys] = useState<SurveyRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const canCreate = can('manage_surveys', 'manage_surveys_local');
  const branchName = (id: string | null) => branches.find((b) => b.id === id)?.name ?? 'Sucursal';

  const load = useCallback(async () => {
    try {
      const d = await api<{ surveys: SurveyRow[] }>('/api/surveys');
      setSurveys(d.surveys);
    } catch (e) {
      setError(errorText(e));
      setSurveys([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const canManage = (s: Survey) =>
    can('manage_surveys') || (!!s.branch_id && can('manage_surveys_local') && profile.branch_ids.includes(s.branch_id));

  async function toggleActive(s: Survey) {
    try {
      await api(`/api/surveys/${s.id}`, { method: 'PUT', json: { is_active: !s.is_active } });
      load();
    } catch (e) {
      setError(errorText(e));
    }
  }

  // Vista previa en la primera sucursal donde aplica la encuesta
  const previewSlug = (s: Survey) => (s.branch_id ? branches.find((b) => b.id === s.branch_id)?.slug : branches[0]?.slug);

  return (
    <>
      <PageHeader
        title="Encuestas"
        description="Varias encuestas activas a la vez: salón, delivery, para llevar y eventos"
        action={
          canCreate && (
            <Button onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" /> Nueva encuesta
            </Button>
          )
        }
      />
      {error && <Notice tone="error" className="mb-4">{error}</Notice>}

      {surveys === null ? (
        <LoadingBlock />
      ) : surveys.length === 0 ? (
        <Card>
          <EmptyState icon={ClipboardList} title="Aún no hay encuestas" />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {surveys.map((s) => {
            const slug = previewSlug(s);
            return (
              <Card key={s.id} className={`flex flex-col p-5 ${s.is_active ? '' : 'opacity-60'}`}>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge tone="green">{SURVEY_TYPE_LABEL[s.survey_type]}</Badge>
                  <Badge tone={s.branch_id ? 'blue' : 'gray'}>{s.branch_id ? branchName(s.branch_id) : 'Toda la empresa'}</Badge>
                  {!s.is_active && <Badge tone="red">Inactiva</Badge>}
                  {s.is_active && !s.is_public && <Badge tone="amber">No pública</Badge>}
                </div>
                <h3 className="mt-3 font-semibold text-gray-900">{s.name}</h3>
                {s.description && <p className="mt-1 line-clamp-2 text-sm text-gray-500">{s.description}</p>}
                <p className="mt-3 text-xs text-gray-500">{s.survey_questions?.[0]?.count ?? 0} preguntas</p>
                <div className="mt-4 flex flex-wrap gap-2 border-t border-gray-100 pt-4">
                  <Link href={`/surveys/${s.id}`}>
                    <Button size="sm" variant="secondary">
                      {canManage(s) ? 'Editar' : 'Ver'}
                    </Button>
                  </Link>
                  {slug && s.is_active && s.is_public && (
                    <a href={`/s/${slug}?e=${s.id}`} target="_blank" rel="noreferrer">
                      <Button size="sm" variant="ghost">
                        <ExternalLink className="h-3.5 w-3.5" /> Vista previa
                      </Button>
                    </a>
                  )}
                  {canManage(s) && (
                    <Button size="sm" variant="ghost" onClick={() => toggleActive(s)}>
                      {s.is_active ? 'Desactivar' : 'Activar'}
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <CreateSurveyModal open={creating} onClose={() => setCreating(false)} branches={branches} />
    </>
  );
}

function CreateSurveyModal({ open, onClose, branches }: { open: boolean; onClose: () => void; branches: BranchOption[] }) {
  const { can, profile } = useAuth();
  const router = useRouter();
  const companyWide = can('manage_surveys');
  const ownBranches = branches.filter((b) => profile.branch_ids.includes(b.id));

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<SurveyType>('salon');
  const [scope, setScope] = useState(companyWide ? '' : ownBranches[0]?.id ?? '');
  const [isPublic, setIsPublic] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const d = await api<{ survey: Survey }>('/api/surveys', {
        method: 'POST',
        json: { name, description: description || null, survey_type: type, branch_id: scope || null, is_public: isPublic },
      });
      router.push(`/surveys/${d.survey.id}`);
    } catch (err) {
      setError(errorText(err));
      setSaving(false);
    }
  }

  const scopeOptions = companyWide ? branches : ownBranches;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nueva encuesta"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="create-survey" loading={saving}>
            Crear y agregar preguntas
          </Button>
        </>
      }
    >
      <form id="create-survey" onSubmit={onSubmit} className="space-y-4">
        {error && <Notice tone="error">{error}</Notice>}
        <Field label="Nombre" htmlFor="s-name">
          <Input id="s-name" required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} placeholder="Encuesta de Salón" />
        </Field>
        <Field label="Mensaje de bienvenida" htmlFor="s-desc" hint="Se muestra al cliente al abrir la encuesta">
          <Textarea id="s-desc" maxLength={500} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tipo" htmlFor="s-type">
            <Select id="s-type" value={type} onChange={(e) => setType(e.target.value as SurveyType)}>
              {Object.entries(SURVEY_TYPE_LABEL).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Alcance" htmlFor="s-scope">
            <Select id="s-scope" value={scope} onChange={(e) => setScope(e.target.value)}>
              {companyWide && <option value="">Toda la empresa</option>}
              {scopeOptions.map((b) => (
                <option key={b.id} value={b.id}>
                  Solo {b.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Checkbox label="Disponible para responder por QR (pública)" checked={isPublic} onChange={setIsPublic} />
      </form>
    </Modal>
  );
}
