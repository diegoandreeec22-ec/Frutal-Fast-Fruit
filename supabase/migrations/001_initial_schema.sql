-- ============================================================================
-- FRUTAL FAST FRUIT · 001 · ESQUEMA BASE
-- Para un proyecto Supabase NUEVO. Ejecutar en orden: 001 -> 005.
-- ============================================================================

-- 1. COMPANIES -----------------------------------------------------------------
create table public.companies (
  id            uuid primary key default gen_random_uuid(),
  name          text not null unique,
  timezone      text not null default 'America/Lima',
  locale        text not null default 'es-PE',
  logo_url      text,
  primary_color text not null default '#2E7D32' check (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  sla_hours     integer not null default 24 check (sla_hours between 1 and 720),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- 2. ROLES (por empresa) --------------------------------------------------------
create table public.roles (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  name        text not null,
  description text,
  is_owner    boolean not null default false,
  created_at  timestamptz not null default now(),
  unique (company_id, name)
);

-- 3. PERMISSIONS (catálogo global) ----------------------------------------------
create table public.permissions (
  id          uuid primary key default gen_random_uuid(),
  key         text not null unique,
  description text,
  category    text not null default 'general',
  created_at  timestamptz not null default now()
);

-- 4. ROLE_PERMISSIONS -----------------------------------------------------------
create table public.role_permissions (
  id            uuid primary key default gen_random_uuid(),
  role_id       uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  created_at    timestamptz not null default now(),
  unique (role_id, permission_id)
);

-- 5. USERS (perfil; el rol vive AQUÍ, nunca en user_metadata) --------------------
create table public.users (
  id            uuid primary key references auth.users(id) on delete cascade,
  company_id    uuid not null references public.companies(id) on delete cascade,
  role_id       uuid not null references public.roles(id),
  full_name     text not null check (char_length(full_name) between 1 and 120),
  email         text not null unique,
  is_active     boolean not null default true,
  last_login_at timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- 6. BRANCHES -------------------------------------------------------------------
-- slug es único GLOBALMENTE porque forma parte de la URL pública (/s/<slug>).
create table public.branches (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references public.companies(id) on delete cascade,
  name              text not null check (char_length(name) between 1 and 120),
  slug              text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 60),
  address           text,
  is_active         boolean not null default true,
  default_survey_id uuid,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (company_id, name)
);

-- 7. USER_BRANCHES --------------------------------------------------------------
create table public.user_branches (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,
  branch_id  uuid not null references public.branches(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, branch_id)
);

-- 8. SURVEYS --------------------------------------------------------------------
-- branch_id NULL = encuesta de toda la empresa; con valor = encuesta propia del local.
create table public.surveys (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  branch_id   uuid references public.branches(id),
  name        text not null check (char_length(name) between 1 and 120),
  description text,
  is_active   boolean not null default true,
  is_public   boolean not null default true,
  survey_type text not null default 'salon'
              check (survey_type in ('salon', 'delivery', 'takeout', 'corporate_event')),
  created_by  uuid references public.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (company_id, name)
);

alter table public.branches
  add constraint branches_default_survey_fk
  foreign key (default_survey_id) references public.surveys(id) on delete set null;

-- 9. SURVEY_QUESTIONS -----------------------------------------------------------
create table public.survey_questions (
  id                 uuid primary key default gen_random_uuid(),
  survey_id          uuid not null references public.surveys(id) on delete cascade,
  question_text      text not null check (char_length(question_text) between 1 and 300),
  question_type      text not null check (question_type in ('nps', 'rating', 'text', 'multiple_choice')),
  order_index        integer not null default 0,
  scale_min          integer not null default 1,
  scale_max          integer not null default 5,
  critical_threshold numeric,
  warning_threshold  numeric,
  is_required        boolean not null default true,
  is_active          boolean not null default true,
  -- multiple_choice: [{"label": "Opción 1", "value": "opt_1"}, ...]
  options            jsonb,
  created_at         timestamptz not null default now(),
  constraint sq_scale_ok check (scale_min < scale_max),
  constraint sq_thresholds_ok check (
    critical_threshold is null or warning_threshold is null or critical_threshold <= warning_threshold
  ),
  constraint sq_options_ok check (
    (question_type = 'multiple_choice' and jsonb_typeof(options) = 'array' and jsonb_array_length(options) > 0)
    or (question_type <> 'multiple_choice')
  )
);

-- 10. RESPONSES (inmutables: solo se crean vía submit_survey) ---------------------
create table public.responses (
  id            uuid primary key default gen_random_uuid(),
  branch_id     uuid not null references public.branches(id),
  survey_id     uuid not null references public.surveys(id),
  table_number  integer check (table_number between 1 and 999),
  source_type   text not null default 'qr' check (source_type in ('qr', 'nfc_dynamic', 'direct', 'link')),
  channel       text not null default 'dine-in' check (channel in ('dine-in', 'delivery', 'takeout', 'corporate')),
  visitor_email text check (char_length(visitor_email) <= 254),
  visitor_phone text check (char_length(visitor_phone) <= 30),
  comments      text check (char_length(comments) <= 2000),
  created_at    timestamptz not null default now()
);

-- 11. RESPONSE_ANSWERS ----------------------------------------------------------
create table public.response_answers (
  id           uuid primary key default gen_random_uuid(),
  response_id  uuid not null references public.responses(id) on delete cascade,
  question_id  uuid not null references public.survey_questions(id),
  answer_value jsonb not null,
  created_at   timestamptz not null default now(),
  unique (response_id, question_id)
);

-- 12. ALERTS (nunca se borran; solo cambian de estado) ----------------------------
create table public.alerts (
  id              uuid primary key default gen_random_uuid(),
  branch_id       uuid not null references public.branches(id),
  response_id     uuid references public.responses(id),
  question_id     uuid references public.survey_questions(id),
  severity        text not null default 'warning' check (severity in ('warning', 'critical')),
  metric_type     text not null,
  metric_value    numeric not null,
  threshold       numeric not null,
  status          text not null default 'open' check (status in ('open', 'in_review', 'resolved')),
  escalated_to_hq boolean not null default false,
  escalated_at    timestamptz,
  resolved_at     timestamptz,
  resolution_note text check (char_length(resolution_note) <= 2000),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- 13. NOTIFICATIONS (bandeja in-app + cola de emails) -----------------------------
-- status = estado del EMAIL. 'skipped' = solo in-app (p. ej. alertas warning).
create table public.notifications (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid references public.companies(id) on delete cascade,
  user_id           uuid references public.users(id) on delete set null,
  alert_id          uuid references public.alerts(id) on delete cascade,
  notification_type text not null check (notification_type in ('alert', 'escalation', 'invitation')),
  recipient_email   text not null,
  subject           text not null,
  body_text         text not null default '',
  link              text,
  html_content      text,
  status            text not null default 'pending'
                    check (status in ('pending', 'sending', 'sent', 'failed', 'skipped')),
  attempts          integer not null default 0,
  sent_at           timestamptz,
  error_message     text,
  read_at           timestamptz,
  created_at        timestamptz not null default now()
);

-- 14. USER_INVITATIONS ----------------------------------------------------------
-- Solo se guarda el HASH (sha256) del token; el token en claro viaja únicamente en el email.
create table public.user_invitations (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  email       text not null,
  full_name   text,
  role_id     uuid not null references public.roles(id),
  branch_ids  uuid[] not null default '{}',
  token_hash  text not null unique,
  status      text not null default 'pending' check (status in ('pending', 'accepted', 'revoked')),
  expires_at  timestamptz not null,
  accepted_at timestamptz,
  created_by  uuid references public.users(id) on delete set null,
  created_at  timestamptz not null default now()
);

-- ÍNDICES -----------------------------------------------------------------------
create index idx_users_company_id            on public.users(company_id);
create index idx_users_role_id               on public.users(role_id);
create index idx_roles_company_id            on public.roles(company_id);
create index idx_role_permissions_role_id    on public.role_permissions(role_id);
create index idx_branches_company_id         on public.branches(company_id);
create index idx_user_branches_branch_id     on public.user_branches(branch_id);
create index idx_surveys_company_id          on public.surveys(company_id);
create index idx_surveys_branch_id           on public.surveys(branch_id);
create index idx_survey_questions_survey_id  on public.survey_questions(survey_id, order_index);
create index idx_responses_branch_created    on public.responses(branch_id, created_at desc);
create index idx_responses_survey_id         on public.responses(survey_id);
create index idx_response_answers_question   on public.response_answers(question_id);
create index idx_alerts_branch_created       on public.alerts(branch_id, created_at desc);
create index idx_alerts_status               on public.alerts(status);
create index idx_alerts_response_id          on public.alerts(response_id);
create index idx_notifications_status        on public.notifications(status, created_at) where status in ('pending', 'failed', 'sending');
create index idx_notifications_user          on public.notifications(user_id, created_at desc);
create index idx_user_invitations_company    on public.user_invitations(company_id);
create index idx_user_invitations_email      on public.user_invitations(lower(email));

-- RLS: se habilita en TODAS las tablas (sin políticas = nadie accede) -------------
alter table public.companies        enable row level security;
alter table public.roles            enable row level security;
alter table public.permissions      enable row level security;
alter table public.role_permissions enable row level security;
alter table public.users            enable row level security;
alter table public.branches         enable row level security;
alter table public.user_branches    enable row level security;
alter table public.surveys          enable row level security;
alter table public.survey_questions enable row level security;
alter table public.responses        enable row level security;
alter table public.response_answers enable row level security;
alter table public.alerts           enable row level security;
alter table public.notifications    enable row level security;
alter table public.user_invitations enable row level security;

-- CATÁLOGO DE PERMISOS -----------------------------------------------------------
insert into public.permissions (key, description, category) values
  ('manage_company',         'Configurar la empresa',                               'company'),
  ('manage_settings',        'Configurar marca, logo, color y SLA',                 'settings'),
  ('manage_users',           'Invitar y gestionar usuarios',                        'user'),
  ('manage_branches',        'Crear y editar sucursales',                           'branch'),
  ('manage_surveys',         'Crear y editar encuestas de toda la empresa',         'survey'),
  ('manage_surveys_local',   'Crear y editar encuestas de sus sucursales',          'survey'),
  ('view_hq_dashboard',      'Ver dashboard de casa matriz',                        'dashboard'),
  ('view_own_dashboard',     'Ver dashboard de sus sucursales',                     'dashboard'),
  ('view_all_branches',      'Ver todas las sucursales de la empresa',              'branch'),
  ('view_own_branches',      'Ver sus sucursales asignadas',                        'branch'),
  ('view_all_responses',     'Ver respuestas de todas las sucursales',              'response'),
  ('view_own_responses',     'Ver respuestas de sus sucursales',                    'response'),
  ('manage_alerts_regional', 'Gestionar alertas de todas las sucursales',           'alert'),
  ('manage_alerts_local',    'Gestionar alertas de sus sucursales',                 'alert'),
  ('receive_branch_alerts',  'Recibir emails de alertas de sus sucursales',         'alert');
