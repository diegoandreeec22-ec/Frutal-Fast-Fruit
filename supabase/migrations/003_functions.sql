-- ============================================================================
-- FRUTAL FAST FRUIT · 003 · FUNCIONES DE NEGOCIO
-- ============================================================================

-- ---------------------------------------------------------------------------
-- my_profile(): perfil + rol + permisos + sucursales del usuario actual.
-- Fuente ÚNICA de verdad para el rol en la app (nunca user_metadata).
-- ---------------------------------------------------------------------------
create or replace function public.my_profile()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'id',         u.id,
    'email',      u.email,
    'full_name',  u.full_name,
    'company_id', u.company_id,
    'role',       jsonb_build_object('id', r.id, 'name', r.name, 'is_owner', r.is_owner),
    'permissions', coalesce((
      select jsonb_agg(p.key order by p.key)
      from public.role_permissions rp
      join public.permissions p on p.id = rp.permission_id
      where rp.role_id = u.role_id
    ), '[]'::jsonb),
    'branch_ids', to_jsonb(public.user_branch_ids()),
    'company', jsonb_build_object(
      'id', c.id, 'name', c.name, 'logo_url', c.logo_url,
      'primary_color', c.primary_color, 'timezone', c.timezone,
      'locale', c.locale, 'sla_hours', c.sla_hours
    )
  )
  from public.users u
  join public.roles r on r.id = u.role_id
  join public.companies c on c.id = u.company_id
  where u.id = auth.uid() and u.is_active
$$;

grant execute on function public.my_profile() to authenticated;

-- ---------------------------------------------------------------------------
-- resolve_public_survey(): elige la encuesta para un QR.
--   1) la indicada en el QR (si es válida para esa sucursal)
--   2) la predeterminada de la sucursal
--   3) la primera encuesta pública activa tipo 'salon' de la empresa/sucursal
-- Interna (sin GRANT).
-- ---------------------------------------------------------------------------
create or replace function public.resolve_public_survey(p_branch_id uuid, p_survey_id uuid)
returns uuid
language sql stable security definer set search_path = ''
as $$
  with b as (
    select id, company_id, default_survey_id from public.branches
    where id = p_branch_id and is_active
  ),
  valid as (
    select s.id, s.survey_type, s.created_at
    from public.surveys s, b
    where s.company_id = b.company_id
      and s.is_active and s.is_public
      and (s.branch_id is null or s.branch_id = b.id)
  )
  select coalesce(
    (select id from valid where id = p_survey_id),
    (select v.id from valid v, b where v.id = b.default_survey_id),
    (select id from valid where survey_type = 'salon' order by created_at limit 1)
  )
$$;

-- ---------------------------------------------------------------------------
-- get_public_survey(slug, survey_id?): lo ÚNICO que anon puede leer.
-- No expone umbrales, ids de empresa ni datos internos.
-- ---------------------------------------------------------------------------
create or replace function public.get_public_survey(p_slug text, p_survey_id uuid default null)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_branch  public.branches%rowtype;
  v_company public.companies%rowtype;
  v_survey  public.surveys%rowtype;
  v_survey_id uuid;
begin
  select * into v_branch from public.branches where slug = lower(p_slug) and is_active;
  if not found then
    return null;
  end if;

  v_survey_id := public.resolve_public_survey(v_branch.id, p_survey_id);
  if v_survey_id is null then
    return null;
  end if;

  select * into v_company from public.companies where id = v_branch.company_id;
  select * into v_survey  from public.surveys   where id = v_survey_id;

  return jsonb_build_object(
    'branch',  jsonb_build_object('id', v_branch.id, 'name', v_branch.name, 'slug', v_branch.slug),
    'company', jsonb_build_object('name', v_company.name, 'logo_url', v_company.logo_url,
                                  'primary_color', v_company.primary_color),
    'survey',  jsonb_build_object('id', v_survey.id, 'name', v_survey.name,
                                  'description', v_survey.description, 'survey_type', v_survey.survey_type),
    'questions', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', q.id, 'question_text', q.question_text, 'question_type', q.question_type,
               'scale_min', q.scale_min, 'scale_max', q.scale_max,
               'is_required', q.is_required, 'options', q.options)
             order by q.order_index, q.created_at)
      from public.survey_questions q
      where q.survey_id = v_survey.id and q.is_active
    ), '[]'::jsonb)
  );
end;
$$;

grant execute on function public.get_public_survey(text, uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- create_alert_if_needed(): evalúa umbrales de UNA respuesta numérica.
--   critical: valor <= critical_threshold
--   warning : critical_threshold < valor <= warning_threshold
-- Las notificaciones y el escalamiento los hace el trigger de alerts (004).
-- Interna (sin GRANT).
-- ---------------------------------------------------------------------------
create or replace function public.create_alert_if_needed(
  p_response_id uuid,
  p_question    public.survey_questions,
  p_value       numeric,
  p_branch_id   uuid
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_severity  text;
  v_threshold numeric;
  v_alert_id  uuid;
begin
  if p_value is null then
    return null;
  end if;

  if p_question.critical_threshold is not null and p_value <= p_question.critical_threshold then
    v_severity := 'critical';
    v_threshold := p_question.critical_threshold;
  elsif p_question.warning_threshold is not null and p_value <= p_question.warning_threshold then
    v_severity := 'warning';
    v_threshold := p_question.warning_threshold;
  else
    return null;
  end if;

  insert into public.alerts (branch_id, response_id, question_id, severity, metric_type, metric_value, threshold)
  values (p_branch_id, p_response_id, p_question.id, v_severity, p_question.question_type, p_value, v_threshold)
  returning id into v_alert_id;

  return v_alert_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- submit_survey(): PUNTO ÚNICO de entrada de respuestas (anon).
-- Todo ocurre en una transacción: si algo falla, no se guarda nada.
-- p_answers: {"<question_id>": <number | string>, ...}
-- ---------------------------------------------------------------------------
create or replace function public.submit_survey(
  p_branch_id     uuid,
  p_survey_id     uuid,
  p_answers       jsonb,
  p_table_number  integer default null,
  p_source_type   text    default 'qr',
  p_comments      text    default null,
  p_visitor_email text    default null,
  p_visitor_phone text    default null
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_branch      public.branches%rowtype;
  v_survey      public.surveys%rowtype;
  v_question    public.survey_questions%rowtype;
  v_value       jsonb;
  v_num         numeric;
  v_response_id uuid;
  v_alert_id    uuid;
  v_alerts      int := 0;
  v_key         text;
  v_channel     text;
begin
  -- 1. Sucursal activa
  select * into v_branch from public.branches where id = p_branch_id and is_active;
  if not found then
    raise exception 'Sucursal no encontrada o inactiva' using errcode = 'P0001';
  end if;

  -- 2. Encuesta activa, pública, de la MISMA empresa y válida para esa sucursal
  select * into v_survey from public.surveys
  where id = p_survey_id and is_active and is_public
    and company_id = v_branch.company_id
    and (branch_id is null or branch_id = v_branch.id);
  if not found then
    raise exception 'Encuesta no disponible para esta sucursal' using errcode = 'P0001';
  end if;

  -- 3. Validación de parámetros
  if p_answers is null or jsonb_typeof(p_answers) <> 'object' then
    raise exception 'Formato de respuestas inválido' using errcode = 'P0001';
  end if;
  if p_table_number is not null and p_table_number not between 1 and 999 then
    raise exception 'Número de mesa inválido' using errcode = 'P0001';
  end if;
  if p_source_type not in ('qr', 'nfc_dynamic', 'direct', 'link') then
    raise exception 'Origen inválido' using errcode = 'P0001';
  end if;
  if char_length(coalesce(p_comments, '')) > 2000 then
    raise exception 'Comentario demasiado largo' using errcode = 'P0001';
  end if;

  -- Toda clave debe ser una pregunta activa de ESTA encuesta
  for v_key in select jsonb_object_keys(p_answers) loop
    if not exists (
      select 1 from public.survey_questions
      where survey_id = v_survey.id and is_active and id::text = v_key
    ) then
      raise exception 'Pregunta desconocida: %', left(v_key, 40) using errcode = 'P0001';
    end if;
  end loop;

  v_channel := case v_survey.survey_type
    when 'delivery'        then 'delivery'
    when 'takeout'         then 'takeout'
    when 'corporate_event' then 'corporate'
    else 'dine-in'
  end;

  -- 4. Respuesta principal
  insert into public.responses (branch_id, survey_id, table_number, source_type, channel,
                                comments, visitor_email, visitor_phone)
  values (v_branch.id, v_survey.id, p_table_number, p_source_type, v_channel,
          nullif(trim(p_comments), ''), nullif(trim(p_visitor_email), ''), nullif(trim(p_visitor_phone), ''))
  returning id into v_response_id;

  -- 5. Respuestas por pregunta + evaluación de umbrales
  for v_question in
    select * from public.survey_questions
    where survey_id = v_survey.id and is_active
    order by order_index, created_at
  loop
    v_value := p_answers -> v_question.id::text;

    if v_value is null or jsonb_typeof(v_value) = 'null'
       or (jsonb_typeof(v_value) = 'string' and trim(v_value #>> '{}') = '') then
      if v_question.is_required then
        raise exception 'Falta responder: %', v_question.question_text using errcode = 'P0001';
      end if;
      continue;
    end if;

    if v_question.question_type in ('nps', 'rating') then
      if jsonb_typeof(v_value) <> 'number' then
        raise exception 'Respuesta numérica inválida' using errcode = 'P0001';
      end if;
      v_num := (v_value #>> '{}')::numeric;
      if v_num <> trunc(v_num) or v_num < v_question.scale_min or v_num > v_question.scale_max then
        raise exception 'Valor fuera de escala en: %', v_question.question_text using errcode = 'P0001';
      end if;
    elsif v_question.question_type = 'text' then
      if jsonb_typeof(v_value) <> 'string' or char_length(v_value #>> '{}') > 2000 then
        raise exception 'Texto inválido' using errcode = 'P0001';
      end if;
    elsif v_question.question_type = 'multiple_choice' then
      if jsonb_typeof(v_value) <> 'string' or not exists (
        select 1 from jsonb_array_elements(v_question.options) o
        where o ->> 'value' = v_value #>> '{}'
      ) then
        raise exception 'Opción inválida' using errcode = 'P0001';
      end if;
    end if;

    insert into public.response_answers (response_id, question_id, answer_value)
    values (v_response_id, v_question.id, v_value);

    if v_question.question_type in ('nps', 'rating') then
      v_alert_id := public.create_alert_if_needed(v_response_id, v_question, v_num, v_branch.id);
      if v_alert_id is not null then
        v_alerts := v_alerts + 1;
      end if;
    end if;
  end loop;

  return jsonb_build_object('response_id', v_response_id, 'success', true, 'alerts_created', v_alerts);
end;
$$;

grant execute on function public.submit_survey(uuid, uuid, jsonb, integer, text, text, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- dashboard_metrics(): métricas agregadas en SQL (sin límite de 1.000 filas).
-- SECURITY INVOKER: respeta RLS, cada usuario solo agrega lo que puede ver.
--   NPS  = %promotores (9-10) - %detractores (0-6) sobre preguntas 'nps'.
--   CSAT = % de respuestas 'rating' en el 25% superior de la escala (4-5 en 1-5).
--   SLA  = % de alertas resueltas dentro de companies.sla_hours.
-- ---------------------------------------------------------------------------
create or replace function public.dashboard_metrics(
  p_from       timestamptz,
  p_to         timestamptz,
  p_branch_ids uuid[] default null
)
returns jsonb
language sql stable security invoker set search_path = ''
as $$
  with
  cfg as (
    select coalesce(
             (select timezone from public.companies where id = public.current_company_id()),
             'America/Lima') as tz,
           coalesce(
             (select sla_hours from public.companies where id = public.current_company_id()),
             24) as sla_hours
  ),
  r as (
    select id, branch_id, created_at from public.responses
    where created_at >= p_from and created_at < p_to
      and (p_branch_ids is null or branch_id = any(p_branch_ids))
  ),
  a as (
    select r.id as response_id, r.branch_id, r.created_at, q.question_type,
           q.scale_min, q.scale_max, (ra.answer_value #>> '{}')::numeric as v
    from r
    join public.response_answers ra on ra.response_id = r.id
    join public.survey_questions q on q.id = ra.question_id
    where q.question_type in ('nps', 'rating') and jsonb_typeof(ra.answer_value) = 'number'
  ),
  al as (
    select * from public.alerts
    where created_at >= p_from and created_at < p_to
      and (p_branch_ids is null or branch_id = any(p_branch_ids))
  ),
  totals as (
    select
      (select count(*) from r) as responses,
      (select round(100.0 * (count(*) filter (where v >= 9) - count(*) filter (where v <= 6)) / nullif(count(*), 0), 1)
         from a where question_type = 'nps') as nps,
      (select round(100.0 * count(*) filter (where (v - scale_min) / nullif(scale_max - scale_min, 0) >= 0.75)
                    / nullif(count(*), 0), 1)
         from a where question_type = 'rating') as csat,
      (select round(avg(1 + 4 * (v - scale_min) / nullif(scale_max - scale_min, 0)), 2)
         from a where question_type = 'rating') as avg_rating,
      (select count(*) from al) as alerts_total,
      (select count(*) from al where status <> 'resolved') as alerts_open,
      (select count(*) from al where status <> 'resolved' and severity = 'critical') as alerts_critical_open,
      (select count(*) from al where escalated_to_hq) as alerts_escalated,
      (select round(100.0 * count(*) filter (where resolved_at - created_at <= make_interval(hours => (select sla_hours from cfg)))
                    / nullif(count(*), 0), 1)
         from al where status = 'resolved') as sla_pct,
      (select round((extract(epoch from avg(resolved_at - created_at)) / 3600)::numeric, 1)
         from al where status = 'resolved') as avg_resolution_hours
  ),
  trend as (
    select coalesce(jsonb_agg(t order by t.day), '[]'::jsonb) as rows
    from (
      select to_char((r.created_at at time zone (select tz from cfg))::date, 'YYYY-MM-DD') as day,
             count(distinct r.id) as responses,
             round(100.0 * (count(*) filter (where a.question_type = 'nps' and a.v >= 9)
                          - count(*) filter (where a.question_type = 'nps' and a.v <= 6))
                   / nullif(count(*) filter (where a.question_type = 'nps'), 0), 1) as nps
      from r left join a on a.response_id = r.id
      group by 1
    ) t
  ),
  by_branch as (
    select coalesce(jsonb_agg(x order by x.responses desc), '[]'::jsonb) as rows
    from (
      select b.id as branch_id, b.name,
             (select count(*) from r where r.branch_id = b.id) as responses,
             (select round(100.0 * (count(*) filter (where v >= 9) - count(*) filter (where v <= 6)) / nullif(count(*), 0), 1)
                from a where a.branch_id = b.id and question_type = 'nps') as nps,
             (select round(100.0 * count(*) filter (where (v - scale_min) / nullif(scale_max - scale_min, 0) >= 0.75)
                           / nullif(count(*), 0), 1)
                from a where a.branch_id = b.id and question_type = 'rating') as csat,
             (select count(*) from al where al.branch_id = b.id and al.status <> 'resolved') as alerts_open
      from public.branches b
      where b.is_active and (p_branch_ids is null or b.id = any(p_branch_ids))
    ) x
  )
  select jsonb_build_object(
    'totals', to_jsonb(totals),
    'trend', trend.rows,
    'by_branch', by_branch.rows,
    'sla_hours', (select sla_hours from cfg)
  )
  from totals, trend, by_branch
$$;

grant execute on function public.dashboard_metrics(timestamptz, timestamptz, uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- claim_notifications(): toma un lote de emails pendientes de forma atómica
-- (FOR UPDATE SKIP LOCKED) para que dos despachadores no envíen el mismo correo.
-- Solo service_role.
-- ---------------------------------------------------------------------------
create or replace function public.claim_notifications(p_limit integer default 20)
returns setof public.notifications
language sql security definer set search_path = ''
as $$
  update public.notifications n
  set status = 'sending', attempts = n.attempts + 1
  where n.id in (
    select id from public.notifications
    where (status = 'pending')
       or (status = 'failed' and attempts < 3)
       or (status = 'sending' and created_at < now() - interval '10 minutes' and attempts < 3)
    order by created_at
    limit greatest(1, least(p_limit, 100))
    for update skip locked
  )
  returning n.*
$$;

grant execute on function public.claim_notifications(integer) to service_role;

-- ---------------------------------------------------------------------------
-- create_company_roles(): crea los 4 roles estándar con sus permisos.
-- Solo service_role (usado por el seed y por el alta de nuevas empresas).
-- ---------------------------------------------------------------------------
create or replace function public.create_company_roles(p_company_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_def record;
  v_role_id uuid;
begin
  for v_def in
    select * from (values
      ('Owner', 'Propietario de la empresa', true, array[
        'manage_company', 'manage_settings', 'manage_users', 'manage_branches', 'manage_surveys',
        'view_hq_dashboard', 'view_all_branches', 'view_all_responses', 'manage_alerts_regional']),
      ('Gerente General', 'Gerente de casa matriz', false, array[
        'manage_users', 'view_hq_dashboard', 'view_all_branches', 'view_all_responses', 'manage_alerts_regional']),
      ('Gerente de Local', 'Gerente de sucursal o zona', false, array[
        'view_own_branches', 'manage_surveys_local', 'view_own_responses', 'view_own_dashboard',
        'manage_alerts_local', 'receive_branch_alerts']),
      ('Operativo', 'Staff de punto de venta', false, array[
        'view_own_branches', 'view_own_responses', 'view_own_dashboard', 'manage_alerts_local'])
    ) as t(name, description, is_owner, perms)
  loop
    insert into public.roles (company_id, name, description, is_owner)
    values (p_company_id, v_def.name, v_def.description, v_def.is_owner)
    on conflict (company_id, name) do update set description = excluded.description
    returning id into v_role_id;

    insert into public.role_permissions (role_id, permission_id)
    select v_role_id, p.id from public.permissions p where p.key = any(v_def.perms)
    on conflict do nothing;
  end loop;
end;
$$;

grant execute on function public.create_company_roles(uuid) to service_role;
