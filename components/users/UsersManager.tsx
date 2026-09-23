'use client';

import { Copy, MailPlus, Users } from 'lucide-react';
import { useCallback, useEffect, useState, type FormEvent } from 'react';

import { BranchSelector } from '@/components/branch-management/BranchSelector';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, PageHeader } from '@/components/ui/Card';
import { EmptyState, LoadingBlock, Notice } from '@/components/ui/Feedback';
import { Field, Input, Select } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Table, Td, Th } from '@/components/ui/Table';
import { useAuth } from '@/contexts/AuthContext';
import { api, errorText } from '@/lib/fetcher';
import { formatDateTime } from '@/lib/utils';
import type { Role } from '@/types/database';

interface UserRow {
  id: string;
  full_name: string;
  email: string;
  is_active: boolean;
  last_login_at: string | null;
  role_id: string;
  roles: { name: string; is_owner: boolean } | null;
  user_branches: Array<{ branch_id: string }>;
}

interface InvitationRow {
  id: string;
  email: string;
  full_name: string | null;
  role_id: string;
  branch_ids: string[];
  expires_at: string;
  created_at: string;
}

// Roles HQ (ven todas las sucursales): no necesitan sucursales asignadas
const HQ_ROLES = ['Owner', 'Gerente General'];

export function UsersManager({ branches }: { branches: Array<{ id: string; name: string }> }) {
  const { profile } = useAuth();
  const [users, setUsers] = useState<UserRow[] | null>(null);
  const [invitations, setInvitations] = useState<InvitationRow[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await api<{ users: UserRow[]; invitations: InvitationRow[]; roles: Role[] }>('/api/users');
      setUsers(d.users);
      setInvitations(d.invitations);
      setRoles(d.roles);
    } catch (e) {
      setError(errorText(e));
      setUsers([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const roleName = (id: string) => roles.find((r) => r.id === id)?.name ?? '—';
  const branchNames = (ids: string[]) =>
    ids.map((id) => branches.find((b) => b.id === id)?.name).filter(Boolean).join(', ');

  async function revoke(inv: InvitationRow) {
    if (!confirm(`¿Revocar la invitación a ${inv.email}?`)) return;
    try {
      await api(`/api/invitations/${inv.id}`, { method: 'DELETE' });
      load();
    } catch (e) {
      setError(errorText(e));
    }
  }

  const assignableRoles = roles.filter((r) => !r.is_owner);

  return (
    <>
      <PageHeader
        title="Usuarios"
        description="El acceso es solo por invitación. El rol se guarda en la base de datos, no en el navegador."
        action={
          <Button onClick={() => setInviting(true)}>
            <MailPlus className="h-4 w-4" /> Invitar usuario
          </Button>
        }
      />
      {error && <Notice tone="error" className="mb-4">{error}</Notice>}

      <div className="space-y-6">
        <Card>
          {users === null ? (
            <LoadingBlock />
          ) : users.length === 0 ? (
            <EmptyState icon={Users} title="Sin usuarios" />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Usuario</Th>
                  <Th>Rol</Th>
                  <Th>Sucursales</Th>
                  <Th>Último acceso</Th>
                  <Th>Estado</Th>
                  <Th />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map((u) => {
                  const hq = HQ_ROLES.includes(u.roles?.name ?? '');
                  return (
                    <tr key={u.id} className={u.is_active ? '' : 'opacity-60'}>
                      <Td>
                        <p className="font-medium text-gray-900">
                          {u.full_name} {u.id === profile.id && <span className="text-xs text-gray-400">(tú)</span>}
                        </p>
                        <p className="text-xs text-gray-500">{u.email}</p>
                      </Td>
                      <Td>
                        <Badge tone={u.roles?.is_owner ? 'purple' : hq ? 'blue' : 'gray'}>{u.roles?.name}</Badge>
                      </Td>
                      <Td className="max-w-xs truncate text-gray-600">
                        {hq ? 'Todas' : branchNames(u.user_branches.map((b) => b.branch_id)) || '—'}
                      </Td>
                      <Td className="whitespace-nowrap text-gray-500">{formatDateTime(u.last_login_at)}</Td>
                      <Td>{u.is_active ? <Badge tone="green">Activo</Badge> : <Badge tone="red">Inactivo</Badge>}</Td>
                      <Td className="text-right">
                        {u.id !== profile.id && !u.roles?.is_owner && (
                          <Button size="sm" variant="outline" onClick={() => setEditing(u)}>
                            Editar
                          </Button>
                        )}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </Card>

        {invitations.length > 0 && (
          <Card>
            <CardHeader title="Invitaciones pendientes" description="Vencen a las 48 horas de enviadas" />
            <Table>
              <thead>
                <tr>
                  <Th>Correo</Th>
                  <Th>Rol</Th>
                  <Th>Sucursales</Th>
                  <Th>Vence</Th>
                  <Th />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {invitations.map((inv) => {
                  const expired = new Date(inv.expires_at) < new Date();
                  return (
                    <tr key={inv.id}>
                      <Td>
                        <p className="font-medium text-gray-900">{inv.email}</p>
                        {inv.full_name && <p className="text-xs text-gray-500">{inv.full_name}</p>}
                      </Td>
                      <Td>{roleName(inv.role_id)}</Td>
                      <Td className="max-w-xs truncate text-gray-600">{branchNames(inv.branch_ids) || 'Todas'}</Td>
                      <Td>{expired ? <Badge tone="red">Vencida</Badge> : formatDateTime(inv.expires_at)}</Td>
                      <Td className="text-right">
                        <Button size="sm" variant="ghost" onClick={() => revoke(inv)}>
                          Revocar
                        </Button>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </Card>
        )}
      </div>

      {inviting && (
        <InviteModal
          roles={assignableRoles}
          branches={branches}
          onClose={() => setInviting(false)}
          onSent={load}
        />
      )}
      {editing && (
        <EditUserModal
          user={editing}
          roles={assignableRoles}
          branches={branches}
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

function InviteModal({
  roles,
  branches,
  onClose,
  onSent,
}: {
  roles: Role[];
  branches: Array<{ id: string; name: string }>;
  onClose: () => void;
  onSent: () => void;
}) {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [roleId, setRoleId] = useState(roles.find((r) => r.name === 'Gerente de Local')?.id ?? roles[0]?.id ?? '');
  const [branchIds, setBranchIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ url: string; emailSent: boolean; emailError: string | null } | null>(null);

  const isHq = HQ_ROLES.includes(roles.find((r) => r.id === roleId)?.name ?? '');

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const d = await api<{ invite_url: string; email_sent: boolean; email_error: string | null }>('/api/invitations/send', {
        method: 'POST',
        json: { email, full_name: fullName || undefined, role_id: roleId, branch_ids: isHq ? [] : branchIds },
      });
      setResult({ url: d.invite_url, emailSent: d.email_sent, emailError: d.email_error });
      onSent();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSaving(false);
    }
  }

  if (result) {
    return (
      <Modal open onClose={onClose} title="Invitación creada" footer={<Button onClick={onClose}>Listo</Button>}>
        <div className="space-y-4">
          {result.emailSent ? (
            <Notice tone="success">Enviamos la invitación a {email}.</Notice>
          ) : (
            <Notice tone="warning">
              No se pudo enviar el correo ({result.emailError}). Comparte este enlace directamente con la persona:
            </Notice>
          )}
          <div className="flex gap-2">
            <Input readOnly value={result.url} onFocus={(e) => e.target.select()} />
            <Button variant="outline" onClick={() => navigator.clipboard.writeText(result.url)} aria-label="Copiar enlace">
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-gray-500">El enlace es personal y vence en 48 horas.</p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Invitar usuario"
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="invite-form" loading={saving}>
            Enviar invitación
          </Button>
        </>
      }
    >
      <form id="invite-form" onSubmit={onSubmit} className="space-y-4">
        {error && <Notice tone="error">{error}</Notice>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Correo" htmlFor="i-email">
            <Input id="i-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Nombre (opcional)" htmlFor="i-name">
            <Input id="i-name" maxLength={120} value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </Field>
        </div>
        <Field label="Rol" htmlFor="i-role" hint={roles.find((r) => r.id === roleId)?.description ?? undefined}>
          <Select id="i-role" value={roleId} onChange={(e) => setRoleId(e.target.value)}>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </Select>
        </Field>
        {isHq ? (
          <Notice tone="info">Este rol ve todas las sucursales de la empresa.</Notice>
        ) : (
          <Field label="Sucursales que podrá ver">
            <BranchSelector branches={branches} value={branchIds} onChange={setBranchIds} />
          </Field>
        )}
      </form>
    </Modal>
  );
}

function EditUserModal({
  user,
  roles,
  branches,
  onClose,
  onSaved,
}: {
  user: UserRow;
  roles: Role[];
  branches: Array<{ id: string; name: string }>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [roleId, setRoleId] = useState(user.role_id);
  const [branchIds, setBranchIds] = useState(user.user_branches.map((b) => b.branch_id));
  const [active, setActive] = useState(user.is_active);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isHq = HQ_ROLES.includes(roles.find((r) => r.id === roleId)?.name ?? '');

  async function save() {
    if (!isHq && branchIds.length === 0) {
      setError('Asigna al menos una sucursal');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api(`/api/users/${user.id}`, {
        method: 'PUT',
        json: { role_id: roleId, branch_ids: isHq ? [] : branchIds, is_active: active },
      });
      onSaved();
    } catch (e) {
      setError(errorText(e));
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Editar a ${user.full_name}`}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={save} loading={saving}>
            Guardar
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <Notice tone="error">{error}</Notice>}
        <Field label="Rol" htmlFor="e-role">
          <Select id="e-role" value={roleId} onChange={(e) => setRoleId(e.target.value)}>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </Select>
        </Field>
        {!isHq && (
          <Field label="Sucursales">
            <BranchSelector branches={branches} value={branchIds} onChange={setBranchIds} />
          </Field>
        )}
        <Field label="Estado" htmlFor="e-active" hint="Un usuario inactivo no puede iniciar sesión. Nunca se borra.">
          <Select id="e-active" value={active ? '1' : '0'} onChange={(e) => setActive(e.target.value === '1')}>
            <option value="1">Activo</option>
            <option value="0">Inactivo</option>
          </Select>
        </Field>
      </div>
    </Modal>
  );
}
