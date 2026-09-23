'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';

import { Button } from '@/components/ui/Button';
import { LoadingBlock, Notice } from '@/components/ui/Feedback';
import { Field, Input } from '@/components/ui/Input';
import { api, errorText } from '@/lib/fetcher';
import { passwordSchema } from '@/lib/validators/invitation';

interface InvitationInfo {
  email: string;
  full_name: string | null;
  company_name: string;
  role_name: string;
}

// Alta de cuenta: SOLO con token de invitación válido (el registro público está desactivado).
export function SignupForm({ token }: { token: string }) {
  const router = useRouter();
  const [info, setInfo] = useState<InvitationInfo | null>(null);
  const [invalid, setInvalid] = useState<string | null>(null);
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) {
      setInvalid('Falta el código de invitación.');
      return;
    }
    api<InvitationInfo>(`/api/invitations/accept?token=${encodeURIComponent(token)}`)
      .then((d) => {
        setInfo(d);
        setFullName(d.full_name ?? '');
      })
      .catch((e) => setInvalid(errorText(e)));
  }, [token]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const check = passwordSchema.safeParse(password);
    if (!check.success) return setError(check.error.issues[0]?.message ?? 'Contraseña inválida');
    if (password !== confirm) return setError('Las contraseñas no coinciden');
    if (!info) return;

    setLoading(true);
    try {
      await api('/api/invitations/accept', { method: 'POST', json: { token, full_name: fullName, password } });
      await api('/api/auth/signin', { method: 'POST', json: { email: info.email, password } });
      router.replace('/dashboard');
      router.refresh();
    } catch (err) {
      setError(errorText(err));
      setLoading(false);
    }
  }

  if (invalid) return <Notice tone="error">{invalid}</Notice>;
  if (!info) return <LoadingBlock label="Validando invitación…" />;

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Notice tone="info">
        Te unes a <strong>{info.company_name}</strong> como <strong>{info.role_name}</strong>.
      </Notice>
      {error && <Notice tone="error">{error}</Notice>}
      <Field label="Correo" htmlFor="email">
        <Input id="email" value={info.email} disabled />
      </Field>
      <Field label="Nombre completo" htmlFor="name">
        <Input id="name" required maxLength={120} value={fullName} onChange={(e) => setFullName(e.target.value)} />
      </Field>
      <Field label="Contraseña" htmlFor="password" hint="Mínimo 10 caracteres, con letras y números.">
        <Input id="password" type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      <Field label="Confirmar contraseña" htmlFor="confirm">
        <Input id="confirm" type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </Field>
      <Button type="submit" className="w-full" size="lg" loading={loading}>
        Crear mi cuenta
      </Button>
    </form>
  );
}
