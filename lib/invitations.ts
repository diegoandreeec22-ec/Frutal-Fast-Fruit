import 'server-only';

import { createHash, randomBytes } from 'node:crypto';

import type { SupabaseClient } from '@supabase/supabase-js';

export function newInvitationToken() {
  const token = randomBytes(32).toString('base64url');
  return { token, hash: hashToken(token) };
}

export function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export const INVITATION_TTL_MS = 48 * 60 * 60 * 1000;

// Rol asignable por quien gestiona usuarios: de su empresa y nunca Owner
// (máximo 1 Owner por empresa). Devuelve si el rol ve todas las sucursales.
export async function loadAssignableRole(admin: SupabaseClient, companyId: string, roleId: string) {
  const { data: role } = await admin
    .from('roles')
    .select('id, name, is_owner, role_permissions(permissions(key))')
    .eq('id', roleId)
    .eq('company_id', companyId)
    .maybeSingle();
  if (!role) return { error: 'Rol inválido' as const };
  if (role.is_owner) return { error: 'No se puede asignar el rol Owner' as const };

  const perms = ((role.role_permissions ?? []) as unknown as Array<{ permissions: { key: string } | null }>)
    .map((rp) => rp.permissions?.key)
    .filter(Boolean) as string[];

  return { role: { id: role.id as string, name: role.name as string }, isHq: perms.includes('view_all_branches') };
}

// Valida que todas las sucursales existan, estén activas y sean de la empresa.
export async function validateBranchIds(admin: SupabaseClient, companyId: string, branchIds: string[]) {
  const unique = Array.from(new Set(branchIds));
  if (unique.length === 0) return { ok: true as const, ids: unique };
  const { data } = await admin
    .from('branches')
    .select('id')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .in('id', unique);
  if ((data ?? []).length !== unique.length) return { ok: false as const };
  return { ok: true as const, ids: unique };
}
