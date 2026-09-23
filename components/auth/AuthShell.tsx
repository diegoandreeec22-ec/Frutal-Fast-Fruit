import type { ReactNode } from 'react';

import { Logo } from '@/components/Logo';

export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-brand-800 lg:flex lg:flex-col lg:justify-between lg:p-12">
        <Logo light />
        <div className="relative z-10 max-w-md">
          <h2 className="text-3xl font-bold leading-tight text-white">Escucha a cada cliente, en cada local.</h2>
          <p className="mt-3 text-brand-100">
            Encuestas por QR, alertas inmediatas cuando algo sale mal y métricas NPS/CSAT de toda tu red de locales.
          </p>
        </div>
        <p className="relative z-10 text-xs text-brand-200">© {new Date().getFullYear()} Frutal Fast Fruit · Lima, Perú</p>
        <div className="absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-accent-500/20" aria-hidden />
        <div className="absolute -right-10 top-24 h-48 w-48 rounded-full bg-brand-500/30" aria-hidden />
      </div>
      <div className="flex items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm text-gray-500">{subtitle}</p>}
          <div className="mt-8">{children}</div>
        </div>
      </div>
    </div>
  );
}
