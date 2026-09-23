'use client';

import { createBrowserClient } from '@supabase/ssr';

// Cliente del navegador: usa la anon key y la sesión del usuario (RLS siempre aplica).
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
