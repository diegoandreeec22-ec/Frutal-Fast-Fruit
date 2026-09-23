'use client';

import { useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';

import type { PermissionKey, Profile } from '@/types/database';

interface AuthContextValue {
  profile: Profile;
  can: (...perms: PermissionKey[]) => boolean;
  isHq: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// El perfil llega del servidor (my_profile() en la BD). El cliente NUNCA decide
// el rol: estos permisos solo sirven para mostrar/ocultar UI; la autorización
// real la hacen las APIs y RLS.
export function AuthProvider({ profile, children }: { profile: Profile; children: ReactNode }) {
  const router = useRouter();

  const can = useCallback(
    (...perms: PermissionKey[]) => perms.some((p) => profile.permissions.includes(p)),
    [profile.permissions],
  );

  const signOut = useCallback(async () => {
    await fetch('/api/auth/signout', { method: 'POST' });
    router.replace('/login');
    router.refresh();
  }, [router]);

  const value = useMemo(
    () => ({ profile, can, isHq: profile.permissions.includes('view_all_branches'), signOut }),
    [profile, can, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
