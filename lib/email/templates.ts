// Plantillas HTML de email: tablas + estilos inline para máxima compatibilidad.

export function escapeHtml(text: string) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

interface LayoutOptions {
  title: string;
  intro: string;
  ctaLabel?: string;
  ctaUrl?: string;
  footer?: string;
  accent?: string;
}

export function emailLayout({ title, intro, ctaLabel, ctaUrl, footer, accent = '#2E7D32' }: LayoutOptions) {
  const cta =
    ctaLabel && ctaUrl
      ? `<tr><td style="padding:8px 32px 28px">
           <a href="${escapeHtml(ctaUrl)}" style="display:inline-block;background:${accent};color:#ffffff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:8px">${escapeHtml(ctaLabel)}</a>
         </td></tr>`
      : '';

  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;background:#f3f6f3;font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#1f2a1f">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f6f3;padding:24px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e3e9e3">
        <tr><td style="background:${accent};padding:18px 32px;color:#ffffff;font-size:18px;font-weight:700">🍓 Frutal Fast Fruit</td></tr>
        <tr><td style="padding:28px 32px 8px;font-size:20px;font-weight:700">${escapeHtml(title)}</td></tr>
        <tr><td style="padding:8px 32px 20px;font-size:15px;line-height:1.55;color:#3b4a3b">${escapeHtml(intro).replace(/\n/g, '<br>')}</td></tr>
        ${cta}
        <tr><td style="padding:16px 32px;border-top:1px solid #eef2ee;font-size:12px;color:#7a887a">${escapeHtml(
          footer ?? 'Este es un mensaje automático de Frutal Fast Fruit.',
        )}</td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

export function notificationEmail(subject: string, body: string, url: string | null) {
  return emailLayout({
    title: subject,
    intro: body,
    ctaLabel: url ? 'Ver en el panel' : undefined,
    ctaUrl: url ?? undefined,
    accent: subject.startsWith('🚨') || subject.startsWith('🔴') ? '#C62828' : '#2E7D32',
  });
}

export function invitationEmail(opts: { companyName: string; roleName: string; inviterName: string; url: string }) {
  return emailLayout({
    title: `Te invitaron a ${opts.companyName}`,
    intro: `${opts.inviterName} te invitó a unirte al panel de satisfacción de ${opts.companyName} con el rol "${opts.roleName}".\n\nEl enlace vence en 48 horas.`,
    ctaLabel: 'Aceptar invitación',
    ctaUrl: opts.url,
    footer: 'Si no esperabas esta invitación, puedes ignorar este correo.',
  });
}
