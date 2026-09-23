-- ============================================================================
-- FRUTAL FAST FRUIT · 002 · FUNCIONES DE SCOPE, POLÍTICAS RLS Y PRIVILEGIOS
--
-- Modelo:
--   · HQ (Owner, Gerente General): todo lo de su company_id (permiso view_all_branches).
--   · Local (Gerente de Local, Operativo): solo sucursales en user_branches.
--   · anon: NINGÚN acceso a tablas. Solo ejecuta get_public_survey() y submit_survey().
--   · Escrituras sensibles (usuarios, roles, invitaciones) solo desde el servidor
--     con service_role, después de validar permisos.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0. Privilegios base: se parte de CERO y se concede lo mínimo.
-- ---------------------------------------------------------------------------
revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;
alter default privileges in schema public revoke all on tables    from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
-- EXECUTE a PUBLIC es un default GLOBAL: la revocación por esquema no lo elimina.
alter default privileges revoke execute on functions from public;

-- ---------------------------------------------------------------------------
-- 1. Funciones auxiliares de scope (SECURITY DEFINER, search_path vacío).
--    Un usuario inactivo (is_active = false) no obtiene company ni permisos.
-- ---------------------------------------------------------------------------
create or replace function public.current_company_id()
returns uuid
language sql stable security definer set search_path = ''
as $$
  select u.company_id from public.users u
  where u.id = auth.uid() and u.is_active
$$;

create or replace function public.has_permission(perm_key text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.users u
    join public.role_permissions rp on rp.role_id = u.role_id
    join public.permissions p on p.id = rp.permission_id
    where u.id = auth.uid() and u.is_active and p.key = perm_key
  )
$$;

create or replace function public.user_branch_ids()
returns uuid[]
language sql stable security definer set search_path = ''
as $$
  select coalesce(array_agg(ub.branch_id), '{}'::uuid[])
  from public.user_branches ub
  join public.users u on u.id = ub.user_id
  where ub.user_id = auth.uid() and u.is_active
$$;

-- ¿Puede el usuario actual VER esta sucursal?
create or replace function public.can_see_branch(p_branch_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.branches b
    where b.id = p_branch_id
      and b.company_id = public.current_company_id()
      and (public.has_permission('view_all_branches') or b.id = any(public.user_branch_ids()))
  )
$$;

-- ¿Puede ver RESPUESTAS de esta sucursal?
create or replace function public.can_view_responses(p_branch_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.can_see_branch(p_branch_id)
     and (
       public.has_permission('view_all_responses')
       or (public.has_permission('view_own_responses') and p_branch_id = any(public.user_branch_ids()))
     )
$$;

-- ¿Puede GESTIONAR alertas de esta sucursal?
create or replace function public.can_manage_alert(p_branch_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.can_see_branch(p_branch_id)
     and (
       public.has_permission('manage_alerts_regional')
       or (public.has_permission('manage_alerts_local') and p_branch_id = any(public.user_branch_ids()))
     )
$$;

-- ¿Puede crear/editar una encuesta con este scope (empresa o local)?
create or replace function public.can_manage_survey_scope(p_company_id uuid, p_branch_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select p_company_id = public.current_company_id()
     and (
       public.has_permission('manage_surveys')
       or (
         p_branch_id is not null
         and public.has_permission('manage_surveys_local')
         and p_branch_id = any(public.user_branch_ids())
       )
     )
$$;

create or replace function public.can_manage_survey(p_survey_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.surveys s
    where s.id = p_survey_id
      and public.can_manage_survey_scope(s.company_id, s.branch_id)
  )
$$;

grant execute on function
  public.current_company_id(),
  public.has_permission(text),
  public.user_branch_ids(),
  public.can_see_branch(uuid),
  public.can_view_responses(uuid),
  public.can_manage_alert(uuid),
  public.can_manage_survey_scope(uuid, uuid),
  public.can_manage_survey(uuid)
to authenticated;

-- ---------------------------------------------------------------------------
-- 2. COMPANIES
-- ---------------------------------------------------------------------------
create policy companies_select on public.companies
  for select to authenticated
  using (id = (select public.current_company_id()));

create policy companies_update on public.companies
  for update to authenticated
  using (id = (select public.current_company_id()) and (select public.has_permission('manage_settings')))
  with check (id = (select public.current_company_id()));

grant select on public.companies to authenticated;
grant update (name, logo_url, primary_color, timezone, locale, sla_hours) on public.companies to authenticated;

-- ---------------------------------------------------------------------------
-- 3. ROLES / PERMISSIONS / ROLE_PERMISSIONS (solo lectura)
-- ---------------------------------------------------------------------------
create policy roles_select on public.roles
  for select to authenticated
  using (company_id = (select public.current_company_id()));

create policy permissions_select on public.permissions
  for select to authenticated
  using (true); -- catálogo global, no contiene datos de clientes

create policy role_permissions_select on public.role_permissions
  for select to authenticated
  using (exists (
    select 1 from public.roles r
    where r.id = role_id and r.company_id = (select public.current_company_id())
  ));

grant select on public.roles, public.permissions, public.role_permissions to authenticated;

-- ---------------------------------------------------------------------------
-- 4. USERS
--    Solo se puede editar el propio full_name. role_id, company_id, is_active
--    NO tienen GRANT de UPDATE: cambiarlos requiere el servidor (service_role).
-- ---------------------------------------------------------------------------
create policy users_select on public.users
  for select to authenticated
  using (
    company_id = (select public.current_company_id())
    and (
      id = (select auth.uid())
      or (select public.has_permission('manage_users'))
      or (select public.has_permission('view_all_branches'))
    )
  );

create policy users_update_self on public.users
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

grant select on public.users to authenticated;
grant update (full_name) on public.users to authenticated;

-- ---------------------------------------------------------------------------
-- 5. BRANCHES (nunca DELETE; se desactivan con is_active = false)
-- ---------------------------------------------------------------------------
create policy branches_select on public.branches
  for select to authenticated
  using (
    company_id = (select public.current_company_id())
    and (
      (select public.has_permission('view_all_branches'))
      or id = any((select public.user_branch_ids())::uuid[])
    )
  );

create policy branches_insert on public.branches
  for insert to authenticated
  with check (
    company_id = (select public.current_company_id())
    and (select public.has_permission('manage_branches'))
  );

create policy branches_update on public.branches
  for update to authenticated
  using (
    company_id = (select public.current_company_id())
    and (select public.has_permission('manage_branches'))
  )
  with check (company_id = (select public.current_company_id()));

grant select on public.branches to authenticated;
grant insert (company_id, name, slug, address, is_active, default_survey_id) on public.branches to authenticated;
grant update (name, slug, address, is_active, default_survey_id) on public.branches to authenticated;

-- ---------------------------------------------------------------------------
-- 6. USER_BRANCHES (solo lectura; asignaciones vía servidor)
-- ---------------------------------------------------------------------------
create policy user_branches_select on public.user_branches
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or (
      (select public.has_permission('manage_users'))
      and exists (
        select 1 from public.branches b
        where b.id = branch_id and b.company_id = (select public.current_company_id())
      )
    )
  );

grant select on public.user_branches to authenticated;

-- ---------------------------------------------------------------------------
-- 7. SURVEYS (nunca DELETE; se desactivan con is_active = false)
-- ---------------------------------------------------------------------------
create policy surveys_select on public.surveys
  for select to authenticated
  using (
    company_id = (select public.current_company_id())
    and (branch_id is null or public.can_see_branch(branch_id))
  );

create policy surveys_insert on public.surveys
  for insert to authenticated
  with check (public.can_manage_survey_scope(company_id, branch_id));

create policy surveys_update on public.surveys
  for update to authenticated
  using (public.can_manage_survey_scope(company_id, branch_id))
  with check (public.can_manage_survey_scope(company_id, branch_id));

grant select on public.surveys to authenticated;
grant insert (company_id, branch_id, name, description, is_active, is_public, survey_type) on public.surveys to authenticated;
grant update (name, description, is_active, is_public, survey_type) on public.surveys to authenticated;

-- ---------------------------------------------------------------------------
-- 8. SURVEY_QUESTIONS (se "borran" con is_active = false para no romper histórico)
-- ---------------------------------------------------------------------------
create policy survey_questions_select on public.survey_questions
  for select to authenticated
  using (exists (select 1 from public.surveys s where s.id = survey_id)); -- hereda RLS de surveys

create policy survey_questions_insert on public.survey_questions
  for insert to authenticated
  with check (public.can_manage_survey(survey_id));

create policy survey_questions_update on public.survey_questions
  for update to authenticated
  using (public.can_manage_survey(survey_id))
  with check (public.can_manage_survey(survey_id));

grant select on public.survey_questions to authenticated;
grant insert (survey_id, question_text, question_type, order_index, scale_min, scale_max,
              critical_threshold, warning_threshold, is_required, is_active, options)
  on public.survey_questions to authenticated;
grant update (question_text, question_type, order_index, scale_min, scale_max,
              critical_threshold, warning_threshold, is_required, is_active, options)
  on public.survey_questions to authenticated;

-- ---------------------------------------------------------------------------
-- 9. RESPONSES / RESPONSE_ANSWERS (solo lectura; se crean vía submit_survey)
-- ---------------------------------------------------------------------------
create policy responses_select on public.responses
  for select to authenticated
  using (public.can_view_responses(branch_id));

create policy response_answers_select on public.response_answers
  for select to authenticated
  using (exists (select 1 from public.responses r where r.id = response_id)); -- hereda RLS

grant select on public.responses, public.response_answers to authenticated;

-- ---------------------------------------------------------------------------
-- 10. ALERTS (nunca DELETE; solo se actualiza estado y nota)
-- ---------------------------------------------------------------------------
create policy alerts_select on public.alerts
  for select to authenticated
  using (public.can_see_branch(branch_id));

create policy alerts_update on public.alerts
  for update to authenticated
  using (public.can_manage_alert(branch_id))
  with check (public.can_manage_alert(branch_id));

grant select on public.alerts to authenticated;
grant update (status, resolution_note) on public.alerts to authenticated;

-- ---------------------------------------------------------------------------
-- 11. NOTIFICATIONS (cada usuario ve SOLO las suyas; puede marcarlas leídas)
-- ---------------------------------------------------------------------------
create policy notifications_select_own on public.notifications
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy notifications_update_own on public.notifications
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant select (id, user_id, alert_id, notification_type, subject, body_text, link, read_at, created_at)
  on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

-- ---------------------------------------------------------------------------
-- 12. USER_INVITATIONS (lectura para quien gestiona usuarios; token_hash nunca se expone)
-- ---------------------------------------------------------------------------
create policy user_invitations_select on public.user_invitations
  for select to authenticated
  using (
    company_id = (select public.current_company_id())
    and (select public.has_permission('manage_users'))
  );

grant select (id, company_id, email, full_name, role_id, branch_ids, status, expires_at, accepted_at, created_by, created_at)
  on public.user_invitations to authenticated;
