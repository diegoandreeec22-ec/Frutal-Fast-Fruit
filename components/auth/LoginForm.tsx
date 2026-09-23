'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Feedback';
import { Field, Input } from '@/components/ui/Input';
import { api, errorText } from '@/lib/fetcher';
import { safeNext } from '@/lib/utils';

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(
    params.get('error') === 'link' ? 'El enlace venció o ya fue usado. Solicita uno nuevo.' : null,
  );

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api('/api/auth/signin', { method: 'POST', json: { email, password } });
      router.replace(safeNext(params.get('next')));
      router.refresh();
    } catch (err) {
      setError(errorText(err));
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {params.get('reset') === '1' && <Notice tone="success">Contraseña actualizada. Ya puedes ingresar.</Notice>}
      {error && <Notice tone="error">{error}</Notice>}
      <Field label="Correo electrónico" htmlFor="email">
        <Input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="tu@frutal.pe"
        />
      </Field>
      <Field label="Contraseña" htmlFor="password">
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </Field>
      <div className="flex justify-end">
        <Link href="/forgot-password" className="text-sm font-medium text-brand-700 hover:underline">
          ¿Olvidaste tu contraseña?
        </Link>
      </div>
      <Button type="submit" className="w-full" size="lg" loading={loading}>
        Ingresar
      </Button>
      <p className="text-center text-xs text-gray-500">
        El acceso es solo por invitación. Si no tienes cuenta, pídela a tu administrador.
      </p>
    </form>
  );
}
