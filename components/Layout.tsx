'use client';

import {
  Bell,
  Building2,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquareText,
  QrCode,
  Settings,
  ShieldAlert,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';

import { Logo } from '@/components/Logo';
import { NotificationsBell } from '@/components/NotificationsBell';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import type { PermissionKey } from '@/types/database';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  anyOf?: PermissionKey[];
}

const NAV: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, anyOf: ['view_hq_dashboard', 'view_own_dashboard'] },
  { href: '/alerts', label: 'Alertas', icon: ShieldAlert },
  { href: '/responses', label: 'Respuestas', icon: MessageSquareText, anyOf: ['view_all_responses', 'view_own_responses'] },
  { href: '/surveys', label: 'Encuestas', icon: ClipboardList },
  { href: '/branches', label: 'Sucursales', icon: Building2 },
  { href: '/qr', label: 'Códigos QR', icon: QrCode },
  { href: '/users', label: 'Usuarios', icon: Users, anyOf: ['manage_users'] },
  { href: '/settings', label: 'Configuración', icon: Settings, anyOf: ['manage_settings'] },
];

export function AppLayout({ children }: { children: ReactNode }) {
  const { profile, can, signOut } = useAuth();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const items = NAV.filter((i) => !i.anyOf || can(...i.anyOf));
  const initials = profile.full_name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const sidebar = (
    <nav className="flex h-full flex-col bg-brand-800 px-3 py-5">
      <div className="mb-6 px-2">
        <Logo logoUrl={profile.company.logo_url} name={profile.company.name} light />
      </div>
      <ul className="flex-1 space-y-1">
        {items.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href}>
              <Link
                href={href}
                onClick={() => setOpen(false)}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  active ? 'bg-white text-brand-800 shadow-sm' : 'text-brand-50 hover:bg-brand-700',
                )}
              >
                <Icon className="h-[18px] w-[18px]" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="mt-4 rounded-lg bg-brand-900/40 p-3">
        <p className="truncate text-sm font-semibold text-white">{profile.full_name}</p>
        <p className="truncate text-xs text-brand-100">{profile.role.name}</p>
        <button
          onClick={signOut}
          className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-brand-100 hover:text-white"
        >
          <LogOut className="h-3.5 w-3.5" /> Cerrar sesión
        </button>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen">
      {/* Sidebar escritorio */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">{sidebar}</aside>

      {/* Sidebar móvil */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-gray-900/50" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72">
            {sidebar}
            <button
              onClick={() => setOpen(false)}
              className="absolute right-3 top-5 rounded-md p-1 text-brand-100 hover:bg-brand-700"
              aria-label="Cerrar menú"
            >
              <X className="h-5 w-5" />
            </button>
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="no-print sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-gray-200 bg-white/90 px-4 backdrop-blur sm:px-6">
          <button
            onClick={() => setOpen(true)}
            className="rounded-md p-2 text-gray-600 hover:bg-gray-100 lg:hidden"
            aria-label="Abrir menú"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-gray-500">
              <span className="font-semibold text-gray-900">{profile.company.name}</span>
              <span className="hidden sm:inline"> · {profile.role.name}</span>
            </p>
          </div>
          <NotificationsBell fallbackIcon={Bell} />
          <div
            className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-800"
            title={profile.email}
          >
            {initials}
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
