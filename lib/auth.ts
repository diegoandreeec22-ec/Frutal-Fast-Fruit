import 'server-only';

import { redirect } from 'next/navigation';
import { cache } from 'react';

import { createClient } from '@/lib/supabase/server';
import type { PermissionKey, Profile } from '@/types/database';

// Perfil del usuario actual. El rol y los permisos vienen SIEMPRE de la BD
// (función my_profile), nunca de user_metadata.
export const getProfile = cache(async (): Promise<Profile | null> => {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase.rpc('my_profile');
  if (error || !data) return null;
  return data as Profile;
});

export function can(profile: Profile | null, ...perms: PermissionKey[]): boolean {
  if (!profile) return false;
  return perms.some((p) => profile.permissions.includes(p));
}

// Para Server Components: exige sesión y (opcionalmente) alguno de los permisos.
export async function requireProfile(...anyOf: PermissionKey[]): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) redirect('/login');
  if (anyOf.length > 0 && !can(profile, ...anyOf)) redirect('/dashboard?denied=1');
  return profile;
}
