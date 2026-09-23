import { NextResponse } from 'next/server';

import { clientIp, jsonError, parseBody } from '@/lib/api';
import { dispatchPendingNotifications } from '@/lib/email/sender';
import { rateLimit } from '@/lib/rate-limit';
import { createAdminClient } from '@/lib/supabase/admin';
import { createAnonClient } from '@/lib/supabase/server';
import { submitSurveySchema } from '@/lib/validators/survey';

// Encuesta pública: sin sesión. Toda la validación de negocio vive en
// submit_survey() (transaccional); aquí se valida forma y se limita el abuso.
export async function POST(request: Request) {
  const ip = clientIp(request);
  if (!rateLimit(`submit:${ip}`, 10, 10 * 60_000)) {
    return jsonError('Demasiados envíos desde esta conexión. Intenta más tarde.', 429);
  }

  const body = await parseBody(request, submitSurveySchema);
  if (!body.ok) return body.response;
  const d = body.data;

  // Honeypot: los bots rellenan el campo oculto "website"
  if (d.website) return NextResponse.json({ success: true });

  const { data, error } = await createAnonClient().rpc('submit_survey', {
    p_branch_id: d.branch_id,
    p_survey_id: d.survey_id,
    p_answers: d.answers,
    p_table_number: d.table_number ?? null,
    p_source_type: d.source_type,
    p_comments: d.comments ?? null,
    p_visitor_email: d.visitor_email || null,
    p_visitor_phone: d.visitor_phone ?? null,
  });

  if (error) {
    if (error.code === 'P0001') return jsonError(error.message, 400);
    console.error('[submit_survey]', error);
    return jsonError('No pudimos registrar tu respuesta. Intenta nuevamente.', 500);
  }

  const result = data as { response_id: string; alerts_created: number };

  // Si hubo alertas, se envían los emails en el momento (el cron es el respaldo).
  if (result.alerts_created > 0 && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      await dispatchPendingNotifications(createAdminClient(), 20);
    } catch (e) {
      console.error('[notifications]', e);
    }
  }

  return NextResponse.json({ success: true });
}
