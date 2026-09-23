'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { AuthShell } from '@/components/auth/AuthShell';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Feedback';
import { Field, Input } from '@/components/ui/Input';
import { createClient } from '@/lib/supabase/client';
import { passwordSchema } from '@/lib/validators/invitation';

// Se llega aquí con sesión de recuperación (vía /api/auth/callback).
export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const check = passwordSchema.safeParse(password);
    if (!check.success) return setError(check.error.issues[0]?.message ?? 'Contraseña inválida');
    if (password !== confirm) return setError('Las contraseñas no coinciden');

    setLoading(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError('No se pudo actualizar. El enlace pudo haber vencido.');
      setLoading(false);
      return;
    }
    await supabase.auth.signOut();
    router.replace('/login?reset=1');
  }

  return (
    <AuthShell title="Nueva contraseña" subtitle="Mínimo 10 caracteres, con letras y números.">
      <form onSubmit={onSubmit} className="space-y-4">
        {error && <Notice tone="error">{error}</Notice>}
        <Field label="Nueva contraseña" htmlFor="password">
          <Input id="password" type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Field label="Confirmar contraseña" htmlFor="confirm">
          <Input id="confirm" type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </Field>
        <Button type="submit" className="w-full" size="lg" loading={loading}>
          Guardar contraseña
        </Button>
      </form>
    </AuthShell>
  );
}
