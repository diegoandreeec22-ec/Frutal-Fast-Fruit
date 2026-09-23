-- ============================================================================
-- FRUTAL FAST FRUIT · 004 · TRIGGERS
-- ============================================================================

-- ---------------------------------------------------------------------------
-- updated_at automático
-- ---------------------------------------------------------------------------
create or replace function public.tg_set_updated_at()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_companies_updated_at before update on public.companies for each row execute function public.tg_set_updated_at();
create trigger trg_users_updated_at     before update on public.users     for each row execute function public.tg_set_updated_at();
create trigger trg_branches_updated_at  before update on public.branches  for each row execute function public.tg_set_updated_at();
create trigger trg_surveys_updated_at   before update on public.surveys   for each row execute function public.tg_set_updated_at();
create trigger trg_alerts_updated_at    before update on public.alerts    for each row execute function public.tg_set_updated_at();

-- ---------------------------------------------------------------------------
-- surveys.created_by lo pone el servidor, no el cliente
-- ---------------------------------------------------------------------------
create or replace function public.tg_surveys_set_creator()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if auth.uid() is not null then
    new.created_by := auth.uid();
  end if;
  return new;
end;
$$;

create trigger trg_surveys_creator before insert on public.surveys
  for each row execute function public.tg_surveys_set_creator();

-- ---------------------------------------------------------------------------
-- Integridad entre empresas: una encuesta local debe ser de una sucursal de la
-- misma empresa, y la encuesta predeterminada de una sucursal debe ser válida.
-- ---------------------------------------------------------------------------
create or replace function public.tg_surveys_check_branch()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.branch_id is not null and not exists (
    select 1 from public.branches where id = new.branch_id and company_id = new.company_id
  ) then
    raise exception 'La sucursal no pertenece a la empresa' using errcode = 'P0001';
  end if;
  if tg_op = 'UPDATE' and (new.company_id <> old.company_id or new.branch_id is distinct from old.branch_id) then
    raise exception 'No se puede mover una encuesta de empresa o sucursal' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger trg_surveys_check_branch before insert or update on public.surveys
  for each row execute function public.tg_surveys_check_branch();

create or replace function public.tg_branches_check_default_survey()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.default_survey_id is not null and not exists (
    select 1 from public.surveys s
    where s.id = new.default_survey_id
      and s.company_id = new.company_id
      and (s.branch_id is null or s.branch_id = new.id)
  ) then
    raise exception 'La encuesta predeterminada no es válida para esta sucursal' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger trg_branches_default_survey before insert or update on public.branches
  for each row execute function public.tg_branches_check_default_survey();

-- ---------------------------------------------------------------------------
-- Alertas: resolved_at se gestiona solo
-- ---------------------------------------------------------------------------
create or replace function public.tg_alerts_status()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.status = 'resolved' and old.status <> 'resolved' then
    new.resolved_at := now();
  elsif new.status <> 'resolved' then
    new.resolved_at := null;
  end if;
  return new;
end;
$$;

create trigger trg_alerts_status before update of status on public.alerts
  for each row execute function public.tg_alerts_status();

-- ---------------------------------------------------------------------------
-- Alertas: notificaciones + ESCALAMIENTO INMEDIATO
--
--   · Cada alerta notifica (in-app) a los usuarios de la sucursal con
--     receive_branch_alerts. Las CRÍTICAS además se envían por email.
--     Si la sucursal no tiene gerente asignado, se avisa a HQ.
--   · Regla de escalamiento: 3 respuestas con alerta CRÍTICA en 7 días móviles
--     en la misma sucursal (aún no escaladas) => se marcan escaladas y se
--     notifica por email al gerente de la sucursal + HQ (manage_alerts_regional).
--     Se cuentan RESPUESTAS distintas, no preguntas: un solo cliente con 3 notas
--     bajas en la misma encuesta no dispara el escalamiento por sí solo.
-- ---------------------------------------------------------------------------
create or replace function public.tg_alerts_after_insert()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_branch        public.branches%rowtype;
  v_question_text text;
  v_count         int;
  v_subject       text;
  v_body          text;
  v_link          text := '/alerts?id=' || new.id;
  v_has_managers  boolean;
begin
  select * into v_branch from public.branches where id = new.branch_id;
  select question_text into v_question_text from public.survey_questions where id = new.question_id;

  -- 1. Notificación de la alerta ---------------------------------------------
  v_subject := case when new.severity = 'critical' then '🔴 Alerta crítica' else '🟠 Alerta' end
               || ' · ' || v_branch.name;
  v_body := coalesce(v_question_text, new.metric_type) || ': calificación ' || new.metric_value
            || ' (umbral ' || new.threshold || ').';

  select exists (
    select 1 from public.users u
    join public.user_branches ub on ub.user_id = u.id and ub.branch_id = new.branch_id
    join public.role_permissions rp on rp.role_id = u.role_id
    join public.permissions p on p.id = rp.permission_id and p.key = 'receive_branch_alerts'
    where u.is_active
  ) into v_has_managers;

  insert into public.notifications (company_id, user_id, alert_id, notification_type,
                                    recipient_email, subject, body_text, link, status)
  select distinct on (u.id)
         v_branch.company_id, u.id, new.id, 'alert', u.email, v_subject, v_body, v_link,
         case when new.severity = 'critical' then 'pending' else 'skipped' end
  from public.users u
  join public.role_permissions rp on rp.role_id = u.role_id
  join public.permissions p on p.id = rp.permission_id
  where u.is_active
    and u.company_id = v_branch.company_id
    and (
      (p.key = 'receive_branch_alerts'
        and exists (select 1 from public.user_branches ub where ub.user_id = u.id and ub.branch_id = new.branch_id))
      or (not v_has_managers and p.key = 'manage_alerts_regional')
    );

  -- 2. Escalamiento ------------------------------------------------------------
  if new.severity <> 'critical' then
    return null;
  end if;

  -- Serializa por sucursal para que dos envíos simultáneos no escalen dos veces
  perform pg_advisory_xact_lock(hashtextextended('escalation:' || new.branch_id::text, 0));

  select count(distinct response_id) into v_count
  from public.alerts
  where branch_id = new.branch_id
    and severity = 'critical'
    and not escalated_to_hq
    and created_at > now() - interval '7 days';

  if v_count < 3 then
    return null;
  end if;

  update public.alerts
  set escalated_to_hq = true, escalated_at = now()
  where branch_id = new.branch_id
    and severity = 'critical'
    and not escalated_to_hq
    and created_at > now() - interval '7 days';

  insert into public.notifications (company_id, user_id, alert_id, notification_type,
                                    recipient_email, subject, body_text, link, status)
  select distinct on (u.id)
         v_branch.company_id, u.id, new.id, 'escalation', u.email,
         '🚨 Escalamiento a HQ · ' || v_branch.name,
         v_count || ' respuestas con alertas críticas en los últimos 7 días en ' || v_branch.name
           || '. Requiere atención de casa matriz.',
         '/alerts?branch=' || v_branch.id || '&escalated=1',
         'pending'
  from public.users u
  join public.role_permissions rp on rp.role_id = u.role_id
  join public.permissions p on p.id = rp.permission_id
  where u.is_active
    and u.company_id = v_branch.company_id
    and (
      p.key = 'manage_alerts_regional'
      or (p.key = 'receive_branch_alerts'
          and exists (select 1 from public.user_branches ub where ub.user_id = u.id and ub.branch_id = new.branch_id))
    );

  return null;
end;
$$;

create trigger trg_alerts_after_insert after insert on public.alerts
  for each row execute function public.tg_alerts_after_insert();

-- Las funciones de trigger no deben poder invocarse directamente
revoke all on function
  public.tg_set_updated_at(),
  public.tg_surveys_set_creator(),
  public.tg_surveys_check_branch(),
  public.tg_branches_check_default_survey(),
  public.tg_alerts_status(),
  public.tg_alerts_after_insert()
from public, anon, authenticated;
