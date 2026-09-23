'use client';

import { type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';

import { api } from '@/lib/fetcher';
import { cn, timeAgo } from '@/lib/utils';
import type { AppNotification } from '@/types/database';

const POLL_MS = 60_000;

export function NotificationsBell({ fallbackIcon: Icon }: { fallbackIcon: LucideIcon }) {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const data = await api<{ notifications: AppNotification[]; unread: number }>('/api/notifications');
      setItems(data.notifications);
      setUnread(data.unread);
    } catch {
      // silencioso: la campana no debe romper la página
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  async function markAll() {
    await api('/api/notifications', { method: 'PATCH', json: { all: true } }).catch(() => null);
    setItems((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
    setUnread(0);
  }

  async function markOne(id: string) {
    await api('/api/notifications', { method: 'PATCH', json: { ids: [id] } }).catch(() => null);
    setOpen(false);
    load();
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-full p-2 text-gray-600 hover:bg-gray-100"
        aria-label={`Notificaciones${unread ? ` (${unread} sin leer)` : ''}`}
      >
        <Icon className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <p className="text-sm font-semibold">Notificaciones</p>
            {unread > 0 && (
              <button onClick={markAll} className="text-xs font-medium text-brand-700 hover:underline">
                Marcar todas como leídas
              </button>
            )}
          </div>
          <ul className="max-h-96 divide-y divide-gray-50 overflow-y-auto">
            {items.length === 0 && <li className="px-4 py-8 text-center text-sm text-gray-500">Sin notificaciones</li>}
            {items.map((n) => (
              <li key={n.id}>
                <Link
                  href={n.link ?? '/alerts'}
                  onClick={() => markOne(n.id)}
                  className={cn('block px-4 py-3 hover:bg-gray-50', !n.read_at && 'bg-brand-50/50')}
                >
                  <p className={cn('text-sm', !n.read_at ? 'font-semibold text-gray-900' : 'text-gray-700')}>{n.subject}</p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-gray-500">{n.body_text}</p>
                  <p className="mt-1 text-[11px] text-gray-400">{timeAgo(n.created_at)}</p>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
