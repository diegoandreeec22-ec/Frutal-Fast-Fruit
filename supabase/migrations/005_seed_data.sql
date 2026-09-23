-- ============================================================================
-- FRUTAL FAST FRUIT · 005 · DATOS INICIALES
-- Empresa, roles, 1 sucursal y 2 encuestas listas para usar.
-- El usuario Owner se crea después con:  npm run create-owner
-- ============================================================================

do $$
declare
  v_company_id uuid;
  v_branch_id  uuid;
  v_salon_id   uuid;
  v_delivery_id uuid;
begin
  insert into public.companies (name, timezone, locale, primary_color)
  values ('Frutal Fast Fruit', 'America/Lima', 'es-PE', '#2E7D32')
  on conflict (name) do nothing;

  select id into v_company_id from public.companies where name = 'Frutal Fast Fruit';

  perform public.create_company_roles(v_company_id);

  -- Sucursal inicial
  insert into public.branches (company_id, name, slug, address)
  values (v_company_id, 'Frutal Miraflores', 'miraflores', 'Av. Larco 123, Miraflores, Lima')
  on conflict (slug) do nothing;
  select id into v_branch_id from public.branches where slug = 'miraflores';

  -- Encuesta de salón (predeterminada)
  if not exists (select 1 from public.surveys where company_id = v_company_id and name = 'Encuesta de Salón') then
    insert into public.surveys (company_id, name, description, survey_type, is_public)
    values (v_company_id, 'Encuesta de Salón',
            '¡Gracias por visitarnos! Cuéntanos cómo fue tu experiencia. Toma menos de 1 minuto.',
            'salon', true)
    returning id into v_salon_id;

    insert into public.survey_questions
      (survey_id, question_text, question_type, order_index, scale_min, scale_max,
       critical_threshold, warning_threshold, is_required, options)
    values
      (v_salon_id, '¿Qué tan probable es que recomiendes Frutal a un amigo o familiar?', 'nps', 1, 0, 10, 4, 6, true, null),
      (v_salon_id, '¿Cómo calificarías el sabor y frescura de tus productos?', 'rating', 2, 1, 5, 2, 3, true, null),
      (v_salon_id, '¿Cómo calificarías la atención del personal?', 'rating', 3, 1, 5, 2, 3, true, null),
      (v_salon_id, '¿Cómo calificarías el tiempo de espera?', 'rating', 4, 1, 5, 2, 3, true, null),
      (v_salon_id, '¿Cómo calificarías la limpieza del local?', 'rating', 5, 1, 5, 2, 3, true, null),
      (v_salon_id, '¿Qué fue lo que más disfrutaste?', 'multiple_choice', 6, 1, 5, null, null, false,
        '[{"label":"Jugos y batidos","value":"jugos"},{"label":"Ensaladas de fruta","value":"ensaladas"},{"label":"Bowls","value":"bowls"},{"label":"Sándwiches","value":"sandwiches"},{"label":"Postres","value":"postres"}]'::jsonb),
      (v_salon_id, '¿Algo que podamos mejorar?', 'text', 7, 1, 5, null, null, false, null);

    update public.branches set default_survey_id = v_salon_id where id = v_branch_id;
  end if;

  -- Encuesta de delivery
  if not exists (select 1 from public.surveys where company_id = v_company_id and name = 'Encuesta de Delivery') then
    insert into public.surveys (company_id, name, description, survey_type, is_public)
    values (v_company_id, 'Encuesta de Delivery', 'Cuéntanos cómo llegó tu pedido.', 'delivery', true)
    returning id into v_delivery_id;

    insert into public.survey_questions
      (survey_id, question_text, question_type, order_index, scale_min, scale_max,
       critical_threshold, warning_threshold, is_required, options)
    values
      (v_delivery_id, '¿Qué tan probable es que recomiendes Frutal a un amigo o familiar?', 'nps', 1, 0, 10, 4, 6, true, null),
      (v_delivery_id, '¿Tu pedido llegó a tiempo?', 'rating', 2, 1, 5, 2, 3, true, null),
      (v_delivery_id, '¿Tu pedido llegó completo y en buen estado?', 'rating', 3, 1, 5, 2, 3, true, null),
      (v_delivery_id, '¿Algo que podamos mejorar?', 'text', 4, 1, 5, null, null, false, null);
  end if;
end;
$$;
