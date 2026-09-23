// Columnas explícitas para cada consulta: nunca select('*') sobre tablas con
// GRANTs por columna (notifications, user_invitations) y así no se filtran campos nuevos.
export const SURVEY_COLUMNS =
  'id, company_id, branch_id, name, description, is_active, is_public, survey_type, created_at, updated_at';

export const QUESTION_COLUMNS =
  'id, survey_id, question_text, question_type, order_index, scale_min, scale_max, critical_threshold, warning_threshold, is_required, is_active, options';

export const BRANCH_COLUMNS = 'id, company_id, name, slug, address, is_active, default_survey_id, created_at';

export const ALERT_COLUMNS =
  'id, branch_id, response_id, question_id, severity, metric_type, metric_value, threshold, status, escalated_to_hq, escalated_at, resolved_at, resolution_note, created_at, updated_at';

export const NOTIFICATION_COLUMNS = 'id, notification_type, subject, body_text, link, read_at, created_at';

export const INVITATION_COLUMNS = 'id, email, full_name, role_id, branch_ids, status, expires_at, accepted_at, created_at';
