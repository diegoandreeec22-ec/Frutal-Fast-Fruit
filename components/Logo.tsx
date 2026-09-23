import { cn } from '@/lib/utils';

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={cn('h-9 w-9', className)} aria-hidden>
      <rect width="64" height="64" rx="14" fill="#2E7D32" />
      <path d="M32 20c-9 0-15 7-15 16s7 16 15 16 15-7 15-16-6-16-15-16z" fill="#FF9800" />
      <path d="M33 21c1-6 6-9 11-9-1 5-5 9-11 9z" fill="#A5D6A7" />
      <circle cx="27" cy="33" r="3" fill="#fff" opacity=".5" />
    </svg>
  );
}

export function Logo({ logoUrl, name = 'Frutal Fast Fruit', light }: { logoUrl?: string | null; name?: string; light?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt="" className="h-9 w-9 rounded-lg object-cover" />
      ) : (
        <LogoMark />
      )}
      <div className="leading-tight">
        <p className={cn('text-sm font-bold', light ? 'text-white' : 'text-gray-900')}>{name}</p>
        <p className={cn('text-[11px]', light ? 'text-brand-100' : 'text-gray-500')}>Satisfacción de clientes</p>
      </div>
    </div>
  );
}
