import { NextResponse } from 'next/server';

import { clientIp, jsonError, parseBody } from '@/lib/api';
import { rateLimit } from '@/lib/rate-limit';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { signInSchema } from '@/lib/validators/invitation';

export async function POST(request: Request) {
  const body = await parseBody(request, signInSchema);
  if (!body.ok) return body.response;
  const { email, password } = body.data;

  const ip = clientIp(request);
  if (!rateLimit(`signin:ip:${ip}`, 30, 15 * 60_000) || !rateLimit(`signin:email:${email}`, 8, 15 * 60_000)) {
    return jsonError('Demasiados intentos. Espera unos minutos.', 429);
  }

  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    return jsonError('Correo o contraseña incorrectos', 401);
  }

  // Debe existir un perfil activo en public.users (el rol viene de ahí)
  const { data: profile } = await supabase.rpc('my_profile');
  if (!profile) {
    await supabase.auth.signOut();
    return jsonError('Tu usuario no está activo en ninguna empresa. Contacta al administrador.', 403);
  }

  try {
    await createAdminClient()
      .from('users')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', data.user.id);
  } catch {
    // no bloquear el login si falla el registro de último acceso
  }

  return NextResponse.json({ ok: true });
}
