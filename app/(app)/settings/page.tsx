import { SettingsForm } from '@/components/settings/SettingsForm';
import { requireProfile } from '@/lib/auth';

export const metadata = { title: 'Configuración' };

export default async function SettingsPage() {
  const profile = await requireProfile('manage_settings');
  return <SettingsForm company={profile.company} />;
}
