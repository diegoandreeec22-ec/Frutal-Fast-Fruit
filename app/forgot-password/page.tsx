'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';

import { AuthShell } from '@/components/auth/AuthShell';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Feedback';
import { Field, Input } from '@/components/ui/Input';
import { createClient } from '@/lib/supabase/client';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    await createClient().auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/api/auth/callback?next=/reset-password`,
    });
    // Siempre el mismo mensaje: no revela si el correo existe
    setSent(true);
    setLoading(false);
  }

  return (
    <AuthShell title="Recuperar contraseña" subtitle="Te enviaremos un enlace para crear una nueva contraseña.">
      {sent ? (
        <div className="space-y-4">
          <Notice tone="success">Si el correo está registrado, recibirás un enlace en unos minutos.</Notice>
          <Link href="/login" className="block text-center text-sm font-medium text-brand-700 hover:underline">
            Volver a ingresar
          </Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="Correo electrónico" htmlFor="email">
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Button type="submit" className="w-full" size="lg" loading={loading}>
            Enviar enlace
          </Button>
          <Link href="/login" className="block text-center text-sm text-gray-500 hover:underline">
            Volver
          </Link>
        </form>
      )}
    </AuthShell>
  );
}
