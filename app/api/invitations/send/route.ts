import { NextResponse } from 'next/server';

import { authorize, jsonError, parseBody } from '@/lib/api';
import { sendEmail } from '@/lib/email/sender';
import { invitationEmail } from '@/lib/email/templates';
import {
  INVITATION_TTL_MS,
  loadAssignableRole,
  newInvitationToken,
  validateBranchIds,
} from '@/lib/invitations';
import { createAdminClient } from '@/lib/supabase/admin';
import { appUrl } from '@/lib/utils';
import { sendInvitationSchema } from '@/lib/validators/invitation';

export async function POST(request: Request) {
  const auth = await authorize('manage_users');
  if (!auth.ok) return auth.response;
  const { profile } = auth;

  const body = await parseBody(request, sendInvitationSchema);
  if (!body.ok) return body.response;
  const { email, full_name, role_id, branch_ids } = body.data;

  const admin = createAdminClient();

  const roleCheck = await loadAssignableRole(admin, profile.company_id, role_id);
  if ('error' in roleCheck) return jsonError(roleCheck.error!, 403);

  const branches = await validateBranchIds(admin, profile.company_id, branch_ids);
  if (!branches.ok) return jsonError('Alguna sucursal no es válida');
  if (!roleCheck.isHq && branches.ids.length === 0) {
    return jsonError('Selecciona al menos una sucursal para este rol');
  }

  // Los emails se guardan siempre en minúsculas (el schema los normaliza)
  const { data: existing } = await admin.from('users').select('id').eq('email', email).maybeSingle();
  if (existing) return jsonError('Ya existe un usuario con ese correo', 409);

  // Una sola invitación vigente por correo y empresa
  await admin
    .from('user_invitations')
    .update({ status: 'revoked' })
    .eq('company_id', profile.company_id)
    .eq('email', email)
    .eq('status', 'pending');

  const { token, hash } = newInvitationToken();
  const { data: invitation, error } = await admin
    .from('user_invitations')
    .insert({
      company_id: profile.company_id,
      email,
      full_name: full_name ?? null,
      role_id,
      branch_ids: roleCheck.isHq ? [] : branches.ids,
      token_hash: hash,
      expires_at: new Date(Date.now() + INVITATION_TTL_MS).toISOString(),
      created_by: profile.id,
    })
    .select('id, email, full_name, role_id, branch_ids, status, expires_at, created_at')
    .single();
  if (error || !invitation) {
    console.error('[invitations/send]', error);
    return jsonError('No se pudo crear la invitación', 500);
  }

  const inviteUrl = `${appUrl()}/accept-invitation?token=${encodeURIComponent(token)}`;
  const subject = `Invitación a ${profile.company.name}`;
  const result = await sendEmail(
    email,
    subject,
    invitationEmail({
      companyName: profile.company.name,
      roleName: roleCheck.role.name,
      inviterName: profile.full_name,
      url: inviteUrl,
    }),
  );

  // Registro de auditoría. No lleva el enlace (el token en claro no se guarda en la BD)
  // y attempts = 3 para que el despachador de la cola nunca lo reintente.
  await admin.from('notifications').insert({
    company_id: profile.company_id,
    notification_type: 'invitation',
    recipient_email: email,
    subject,
    body_text: `Invitación enviada por ${profile.full_name} (${roleCheck.role.name})`,
    status: result.ok ? 'sent' : 'failed',
    attempts: 3,
    sent_at: result.ok ? new Date().toISOString() : null,
    error_message: result.error ?? null,
  });

  // El enlace se devuelve a quien invita para poder compartirlo si el email falla.
  return NextResponse.json(
    { invitation, invite_url: inviteUrl, email_sent: result.ok, email_error: result.error ?? null },
    { status: 201 },
  );
}
