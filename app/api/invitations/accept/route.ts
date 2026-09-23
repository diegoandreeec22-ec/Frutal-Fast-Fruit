import { NextResponse, type NextRequest } from 'next/server';

import { clientIp, jsonError, parseBody } from '@/lib/api';
import { hashToken } from '@/lib/invitations';
import { rateLimit } from '@/lib/rate-limit';
import { createAdminClient } from '@/lib/supabase/admin';
import { acceptInvitationSchema } from '@/lib/validators/invitation';

const INVALID = 'La invitación no es válida o ya venció. Pide una nueva a tu administrador.';

async function findPending(token: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from('user_invitations')
    .select('id, company_id, email, full_name, role_id, branch_ids, expires_at, companies(name), roles(name)')
    .eq('token_hash', hashToken(token))
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();
  return { admin, invitation: data };
}

// Datos mínimos para mostrar el formulario de aceptación.
export async function GET(request: NextRequest) {
  if (!rateLimit(`invite-get:${clientIp(request)}`, 30, 10 * 60_000)) return jsonError('Demasiados intentos', 429);

  const token = request.nextUrl.searchParams.get('token') ?? '';
  if (token.length < 20 || token.length > 200) return jsonError(INVALID, 404);

  const { invitation } = await findPending(token);
  if (!invitation) return jsonError(INVALID, 404);

  const company = invitation.companies as unknown as { name: string } | null;
  const role = invitation.roles as unknown as { name: string } | null;
  return NextResponse.json({
    email: invitation.email,
    full_name: invitation.full_name,
    company_name: company?.name ?? '',
    role_name: role?.name ?? '',
  });
}

// Alta del usuario. Todo con service_role en el servidor; el email SIEMPRE sale
// de la invitación (nunca del body) y ante cualquier fallo se deshace lo creado.
export async function POST(request: Request) {
  if (!rateLimit(`invite-post:${clientIp(request)}`, 10, 10 * 60_000)) return jsonError('Demasiados intentos', 429);

  const body = await parseBody(request, acceptInvitationSchema);
  if (!body.ok) return body.response;
  const { token, full_name, password } = body.data;

  const { admin, invitation } = await findPending(token);
  if (!invitation) return jsonError(INVALID, 404);

  // 1. Reservar la invitación (evita doble aceptación en paralelo)
  const { data: claimed } = await admin
    .from('user_invitations')
    .update({ status: 'accepted', accepted_at: new Date().toISOString() })
    .eq('id', invitation.id)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle();
  if (!claimed) return jsonError(INVALID, 409);

  const rollbackInvitation = () =>
    admin.from('user_invitations').update({ status: 'pending', accepted_at: null }).eq('id', invitation.id);

  // 2. Crear usuario en Auth
  const { data: created, error: authError } = await admin.auth.admin.createUser({
    email: invitation.email,
    password,
    email_confirm: true,
    user_metadata: { full_name }, // solo informativo; el rol NO se guarda aquí
  });
  if (authError || !created.user) {
    await rollbackInvitation();
    const exists = authError?.message?.toLowerCase().includes('already');
    return jsonError(exists ? 'Ya existe una cuenta con ese correo' : 'No se pudo crear la cuenta', exists ? 409 : 400);
  }
  const userId = created.user.id;

  const cleanup = async () => {
    await admin.auth.admin.deleteUser(userId);
    await rollbackInvitation();
  };

  // 3. Perfil con rol y empresa (la fuente de verdad del rol)
  const { error: profileError } = await admin.from('users').insert({
    id: userId,
    company_id: invitation.company_id,
    role_id: invitation.role_id,
    email: invitation.email,
    full_name,
  });
  if (profileError) {
    console.error('[invitations/accept] profile', profileError);
    await cleanup();
    return jsonError('No se pudo completar el registro', 500);
  }

  // 4. Sucursales (solo las que sigan activas y sean de la empresa)
  const branchIds = (invitation.branch_ids ?? []) as string[];
  if (branchIds.length > 0) {
    const { data: valid } = await admin
      .from('branches')
      .select('id')
      .eq('company_id', invitation.company_id)
      .eq('is_active', true)
      .in('id', branchIds);
    const rows = (valid ?? []).map((b) => ({ user_id: userId, branch_id: b.id as string }));
    if (rows.length > 0) {
      const { error: ubError } = await admin.from('user_branches').insert(rows);
      if (ubError) {
        console.error('[invitations/accept] branches', ubError);
        await cleanup();
        return jsonError('No se pudo completar el registro', 500);
      }
    }
  }

  return NextResponse.json({ ok: true, email: invitation.email });
}
