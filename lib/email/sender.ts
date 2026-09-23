import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { notificationEmail } from '@/lib/email/templates';
import { appUrl } from '@/lib/utils';

export async function sendEmail(to: string, subject: string, html: string): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from || apiKey.startsWith('re_xxx')) {
    return { ok: false, error: 'Resend no está configurado (RESEND_API_KEY / EMAIL_FROM)' };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], subject, html }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { message?: string };
      return { ok: false, error: body.message ?? `Resend HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

interface QueuedNotification {
  id: string;
  recipient_email: string;
  subject: string;
  body_text: string;
  link: string | null;
  html_content: string | null;
}

// Envía los emails pendientes de la tabla notifications.
// claim_notifications() los reserva de forma atómica: dos ejecuciones en paralelo
// nunca envían el mismo correo.
export async function dispatchPendingNotifications(admin: SupabaseClient, limit = 20) {
  const { data, error } = await admin.rpc('claim_notifications', { p_limit: limit });
  if (error) throw error;

  const batch = (data ?? []) as QueuedNotification[];
  let sent = 0;
  let failed = 0;

  for (const n of batch) {
    const url = n.link ? `${appUrl()}${n.link}` : null;
    const html = n.html_content ?? notificationEmail(n.subject, n.body_text, url);
    const result = await sendEmail(n.recipient_email, n.subject, html);

    if (result.ok) {
      sent++;
      await admin
        .from('notifications')
        .update({ status: 'sent', sent_at: new Date().toISOString(), error_message: null })
        .eq('id', n.id);
    } else {
      failed++;
      await admin.from('notifications').update({ status: 'failed', error_message: result.error }).eq('id', n.id);
    }
  }

  return { claimed: batch.length, sent, failed };
}
