// Tipos del dominio. Reflejan supabase/migrations/001_initial_schema.sql.
// Con el proyecto Supabase creado, se pueden regenerar tipos completos con:
//   npx supabase gen types typescript --project-id <id> > types/supabase.ts

export type PermissionKey =
  | 'manage_company'
  | 'manage_settings'
  | 'manage_users'
  | 'manage_branches'
  | 'manage_surveys'
  | 'manage_surveys_local'
  | 'view_hq_dashboard'
  | 'view_own_dashboard'
  | 'view_all_branches'
  | 'view_own_branches'
  | 'view_all_responses'
  | 'view_own_responses'
  | 'manage_alerts_regional'
  | 'manage_alerts_local'
  | 'receive_branch_alerts';

export type SurveyType = 'salon' | 'delivery' | 'takeout' | 'corporate_event';
export type QuestionType = 'nps' | 'rating' | 'text' | 'multiple_choice';
export type AlertStatus = 'open' | 'in_review' | 'resolved';
export type AlertSeverity = 'warning' | 'critical';

export interface Company {
  id: string;
  name: string;
  timezone: string;
  locale: string;
  logo_url: string | null;
  primary_color: string;
  sla_hours: number;
}

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  company_id: string;
  role: { id: string; name: string; is_owner: boolean };
  permissions: PermissionKey[];
  branch_ids: string[];
  company: Company;
}

export interface Role {
  id: string;
  name: string;
  description: string | null;
  is_owner: boolean;
}

export interface Branch {
  id: string;
  company_id: string;
  name: string;
  slug: string;
  address: string | null;
  is_active: boolean;
  default_survey_id: string | null;
  created_at: string;
}

export interface Survey {
  id: string;
  company_id: string;
  branch_id: string | null;
  name: string;
  description: string | null;
  is_active: boolean;
  is_public: boolean;
  survey_type: SurveyType;
  created_at: string;
  updated_at: string;
}

export interface ChoiceOption {
  label: string;
  value: string;
}

export interface SurveyQuestion {
  id: string;
  survey_id: string;
  question_text: string;
  question_type: QuestionType;
  order_index: number;
  scale_min: number;
  scale_max: number;
  critical_threshold: number | null;
  warning_threshold: number | null;
  is_required: boolean;
  is_active: boolean;
  options: ChoiceOption[] | null;
}

export interface Alert {
  id: string;
  branch_id: string;
  response_id: string | null;
  question_id: string | null;
  severity: AlertSeverity;
  metric_type: string;
  metric_value: number;
  threshold: number;
  status: AlertStatus;
  escalated_to_hq: boolean;
  escalated_at: string | null;
  resolved_at: string | null;
  resolution_note: string | null;
  created_at: string;
  updated_at: string;
}

export interface AppNotification {
  id: string;
  notification_type: 'alert' | 'escalation' | 'invitation';
  subject: string;
  body_text: string;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

export interface PublicSurvey {
  branch: { id: string; name: string; slug: string };
  company: { name: string; logo_url: string | null; primary_color: string };
  survey: { id: string; name: string; description: string | null; survey_type: SurveyType };
  questions: Array<
    Pick<SurveyQuestion, 'id' | 'question_text' | 'question_type' | 'scale_min' | 'scale_max' | 'is_required' | 'options'>
  >;
}

export interface DashboardMetrics {
  totals: {
    responses: number;
    nps: number | null;
    csat: number | null;
    avg_rating: number | null;
    alerts_total: number;
    alerts_open: number;
    alerts_critical_open: number;
    alerts_escalated: number;
    sla_pct: number | null;
    avg_resolution_hours: number | null;
  };
  trend: Array<{ day: string; responses: number; nps: number | null }>;
  by_branch: Array<{
    branch_id: string;
    name: string;
    responses: number;
    nps: number | null;
    csat: number | null;
    alerts_open: number;
  }>;
  sla_hours: number;
}
