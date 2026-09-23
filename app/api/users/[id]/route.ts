import { NextResponse } from 'next/server';
import { z } from 'zod';

import { authorize, jsonError, parseBody } from '@/lib/api';
import { loadAssignableRole, validateBranchIds } from '@/lib/invitations';
import { createAdminClient } from '@/lib/supabase/admin';
import { updateUserSchema } from '@/lib/validators/invitation';

type Ctx = { params: { id: string } };

// Cambiar rol, sucursales o activar/desactivar a un usuario.
// Se hace con service_role porque role_id / is_active no tienen GRANT para
// authenticated; por eso TODAS las reglas se validan aquí.
export async function PUT(request: Request, { params }: Ctx) {
  const auth = await authorize('manage_users');
  if (!auth.ok) return auth.response;
  const { profile } = auth;
  if (!z.string().uuid().safeParse(params.id).success) return jsonError('No encontrado', 404);
  if (params.id === profile.id) return jsonError('No puedes modificar tu propio rol o estado', 403);

  const body = await parseBody(request, updateUserSchema);
  if (!body.ok) return body.response;
  const changes = body.data;

  const admin = createAdminClient();
  const { data: target } = await admin
    .from('users')
    .select('id, company_id, role_id, roles(is_owner)')
    .eq('id', params.id)
    .eq('company_id', profile.company_id)
    .maybeSingle();
  if (!target) return jsonError('Usuario no encontrado', 404);
  if ((target.roles as unknown as { is_owner: boolean } | null)?.is_owner) {
    return jsonError('El Owner no se puede modificar desde aquí', 403);
  }

  let isHq: boolean | null = null;
  if (changes.role_id) {
    const roleCheck = await loadAssignableRole(admin, profile.company_id, changes.role_id);
    if ('error' in roleCheck) return jsonError(roleCheck.error!, 403);
    isHq = roleCheck.isHq;
  }

  let branchIds: string[] | null = null;
  if (changes.branch_ids) {
    const check = await validateBranchIds(admin, profile.company_id, changes.branch_ids);
    if (!check.ok) return jsonError('Alguna sucursal no es válida');
    branchIds = check.ids;
  }

  if (changes.role_id || changes.is_active !== undefined) {
    const { error } = await admin
      .from('users')
      .update({
        ...(changes.role_id ? { role_id: changes.role_id } : {}),
        ...(changes.is_active !== undefined ? { is_active: changes.is_active } : {}),
      })
      .eq('id', target.id);
    if (error) return jsonError('No se pudo actualizar el usuario', 500);
  }

  // Un rol HQ no necesita sucursales asignadas
  if (isHq === true) branchIds = [];
  if (branchIds) {
    await admin.from('user_branches').delete().eq('user_id', target.id);
    if (branchIds.length > 0) {
      const { error } = await admin
        .from('user_branches')
        .insert(branchIds.map((branch_id) => ({ user_id: target.id, branch_id })));
      if (error) return jsonError('No se pudieron asignar las sucursales', 500);
    }
  }

  // Desactivar también bloquea el inicio de sesión en Supabase Auth
  if (changes.is_active !== undefined) {
    await admin.auth.admin.updateUserById(target.id, {
      ban_duration: changes.is_active ? 'none' : '876000h',
    });
  }

  return NextResponse.json({ ok: true });
}
