import { Suspense } from 'react';

import { AuthShell } from '@/components/auth/AuthShell';
import { LoginForm } from '@/components/auth/LoginForm';

export const metadata = { title: 'Ingresar' };

export default function LoginPage() {
  return (
    <AuthShell title="Bienvenido" subtitle="Ingresa al panel de satisfacción de clientes">
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
