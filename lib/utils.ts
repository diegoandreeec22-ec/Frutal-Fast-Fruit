import { clsx, type ClassValue } from 'clsx';

import type { AlertSeverity, AlertStatus, SurveyType } from '@/types/database';

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export const TIMEZONE = 'America/Lima';
export const LOCALE = 'es-PE';

export function formatDateTime(value: string | Date | null | undefined) {
  if (!value) return '—';
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone: TIMEZONE,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export function formatDate(value: string | Date | null | undefined) {
  if (!value) return '—';
  return new Intl.DateTimeFormat(LOCALE, { timeZone: TIMEZONE, day: '2-digit', month: 'short' }).format(
    typeof value === 'string' && value.length === 10 ? new Date(`${value}T12:00:00-05:00`) : new Date(value),
  );
}

export function formatNumber(value: number | null | undefined, digits = 0) {
  if (value === null || value === undefined) return '—';
  return new Intl.NumberFormat(LOCALE, { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(value);
}

export function timeAgo(value: string) {
  const diff = (Date.now() - new Date(value).getTime()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(LOCALE, { numeric: 'auto' });
  if (diff < 60) return rtf.format(-Math.round(diff), 'second');
  if (diff < 3600) return rtf.format(-Math.round(diff / 60), 'minute');
  if (diff < 86400) return rtf.format(-Math.round(diff / 3600), 'hour');
  return rtf.format(-Math.round(diff / 86400), 'day');
}

// Fecha YYYY-MM-DD "hoy" en Lima
export function todayInLima(offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE }).format(d);
}

// Inicio de un día de Lima (UTC-05:00, sin horario de verano) en ISO
export function limaDayStartIso(day: string) {
  return new Date(`${day}T00:00:00-05:00`).toISOString();
}

export function slugify(text: string) {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export const SURVEY_TYPE_LABEL: Record<SurveyType, string> = {
  salon: 'Salón',
  delivery: 'Delivery',
  takeout: 'Para llevar',
  corporate_event: 'Evento corporativo',
};

export const ALERT_STATUS_LABEL: Record<AlertStatus, string> = {
  open: 'Abierta',
  in_review: 'En revisión',
  resolved: 'Resuelta',
};

export const SEVERITY_LABEL: Record<AlertSeverity, string> = {
  critical: 'Crítica',
  warning: 'Advertencia',
};

export function appUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');
}

// Solo rutas internas para redirecciones (evita open redirect)
export function safeNext(next: string | null | undefined, fallback = '/dashboard') {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return fallback;
  return next;
}
