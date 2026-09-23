import { AuthShell } from '@/components/auth/AuthShell';
import { SignupForm } from '@/components/auth/SignupForm';

export const metadata = { title: 'Aceptar invitación' };

export default function AcceptInvitationPage({ searchParams }: { searchParams: { token?: string } }) {
  return (
    <AuthShell title="Crea tu cuenta" subtitle="Completa tus datos para activar el acceso.">
      <SignupForm token={searchParams.token ?? ''} />
    </AuthShell>
  );
}
