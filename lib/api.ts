import 'server-only';

import { NextResponse } from 'next/server';
import type { z, ZodTypeAny } from 'zod';

import { can, getProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import type { PermissionKey, Profile } from '@/types/database';

export function jsonError(message: string, status = 400, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status });
}

type AuthOk = { ok: true; profile: Profile; supabase: ReturnType<typeof createClient> };
type AuthFail = { ok: false; response: NextResponse };

// Autentica la petición con la sesión (JWT de Supabase en cookies) y, si se pide,
// exige al menos uno de los permisos. RLS se aplica igualmente en la BD.
export async function authorize(...anyOf: PermissionKey[]): Promise<AuthOk | AuthFail> {
  const profile = await getProfile();
  if (!profile) return { ok: false, response: jsonError('No autenticado', 401) };
  if (anyOf.length > 0 && !can(profile, ...anyOf)) {
    return { ok: false, response: jsonError('No tienes permiso para esta acción', 403) };
  }
  return { ok: true, profile, supabase: createClient() };
}

export async function parseBody<S extends ZodTypeAny>(
  request: Request,
  schema: S,
): Promise<{ ok: true; data: z.output<S> } | { ok: false; response: NextResponse }> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return { ok: false, response: jsonError('JSON inválido') };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, response: jsonError('Datos inválidos', 400, parsed.error.flatten()) };
  }
  return { ok: true, data: parsed.data };
}

// Traduce errores de Postgres/PostgREST a mensajes para el usuario sin filtrar detalles internos.
export function dbError(error: { code?: string; message: string }) {
  if (error.code === '23505') return jsonError('Ya existe un registro con ese nombre o identificador', 409);
  if (error.code === '42501') return jsonError('No tienes permiso para esta acción', 403);
  if (error.code === 'P0001') return jsonError(error.message, 400);
  if (error.code === 'PGRST116') return jsonError('No encontrado', 404);
  console.error('[db]', error);
  return jsonError('Error interno', 500);
}

export function clientIp(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}
