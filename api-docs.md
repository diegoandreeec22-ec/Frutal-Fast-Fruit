# API

Todos los endpoints responden JSON. Autenticación: cookie de sesión de Supabase (la pone `POST /api/auth/signin`). Si falla la autorización responden `401`/`403` con `{ "error": "..." }`, y si los datos son inválidos `400` con `{ "error", "details" }` (formato Zod `flatten()`).

Además de la validación de la API, **RLS se aplica en la base de datos**: aunque un endpoint tuviera un bug, un usuario no puede leer ni escribir fuera de su alcance.

| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| POST | `/api/auth/signin` | público | `{ email, password }`. Rate limit: 8 intentos / 15 min por email |
| POST | `/api/auth/signout` | sesión | Cierra sesión |
| GET | `/api/auth/callback` | público | Destino de los enlaces de Supabase Auth (`?code=&next=`) |
| GET | `/api/user/profile` | sesión | Perfil, rol, permisos y sucursales (desde la BD) |
| GET | `/api/surveys` | sesión | Encuestas visibles, con el número de preguntas |
| POST | `/api/surveys` | `manage_surveys` o `manage_surveys_local` | `{ name, description?, survey_type, branch_id?, is_public }` |
| GET | `/api/surveys/[id]` | sesión | Encuesta + preguntas activas + `can_manage` |
| PUT | `/api/surveys/[id]` | ídem | `{ name?, description?, survey_type?, is_public?, is_active? }` |
| DELETE | `/api/surveys/[id]` | ídem | Desactiva (`is_active = false`) |
| POST | `/api/surveys/[id]/questions` | ídem | Agrega una pregunta con umbrales |
| PUT | `/api/surveys/questions/[id]` | ídem | Edita una pregunta (incluye `order_index`) |
| DELETE | `/api/surveys/questions/[id]` | ídem | Desactiva la pregunta (el histórico se conserva) |
| POST | `/api/surveys/submit` | **público** | Respuesta del cliente → `submit_survey()`. Rate limit: 10 / 10 min por IP |
| GET | `/api/responses` | `view_*_responses` | `?branch=&survey=&from=&to=&page=&size=` |
| GET | `/api/branches` | sesión | Sucursales visibles |
| POST | `/api/branches` | `manage_branches` | `{ name, slug, address?, default_survey_id? }` |
| PUT | `/api/branches/[id]` | `manage_branches` | Edita / activa / desactiva |
| DELETE | `/api/branches/[id]` | `manage_branches` | Desactiva (nunca borra) |
| GET | `/api/alerts` | sesión | `?status=active\|open\|in_review\|resolved\|all&severity=&branch=&escalated=1&id=` |
| PUT | `/api/alerts/[id]` | `manage_alerts_*` | `{ status?, resolution_note? }` (para resolver, la nota es obligatoria) |
| GET | `/api/dashboard/metrics` | `view_*_dashboard` | `?from=ISO&to=ISO&branches=id1,id2` → `dashboard_metrics()` |
| POST | `/api/qr/generate` | sesión | `{ branch_id, survey_id?, table_number? }` → `{ url }` |
| GET | `/api/users` | `manage_users` | Usuarios, invitaciones pendientes y roles |
| PUT | `/api/users/[id]` | `manage_users` | `{ role_id?, branch_ids?, is_active? }`. No aplica a uno mismo ni al Owner |
| POST | `/api/invitations/send` | `manage_users` | `{ email, full_name?, role_id, branch_ids[] }` → envía el email y devuelve `invite_url` |
| GET | `/api/invitations/accept` | público | `?token=` → datos para el formulario |
| POST | `/api/invitations/accept` | público | `{ token, full_name, password }` → crea la cuenta (service_role) |
| DELETE | `/api/invitations/[id]` | `manage_users` | Revoca una invitación pendiente |
| GET | `/api/notifications` | sesión | Bandeja in-app del usuario |
| PATCH | `/api/notifications` | sesión | `{ ids: [] }` o `{ all: true }` → marcar como leídas |
| GET/POST | `/api/notifications/send` | `Bearer CRON_SECRET` | Despacha los emails pendientes (cron) |
| PUT | `/api/settings` | `manage_settings` | `{ name?, primary_color?, sla_hours?, logo_url? }` |
| POST | `/api/settings/logo` | `manage_settings` | multipart `file` (PNG/JPG/WEBP ≤ 1 MB) |

## Funciones SQL expuestas

| Función | Quién | Descripción |
|---|---|---|
| `get_public_survey(slug, survey_id?)` | anon | Encuesta pública resuelta (sin umbrales) |
| `submit_survey(...)` | anon | Punto único de entrada de respuestas |
| `my_profile()` | authenticated | Perfil + rol + permisos |
| `dashboard_metrics(from, to, branch_ids?)` | authenticated | Métricas (SECURITY INVOKER: respeta RLS) |
| `claim_notifications(limit)` | service_role | Reserva atómica de emails pendientes |
| `create_company_roles(company_id)` | service_role | Crea los 4 roles estándar |

## Permisos por rol

| Permiso | Owner | Gerente General | Gerente de Local | Operativo |
|---|:-:|:-:|:-:|:-:|
| manage_company, manage_settings, manage_branches, manage_surveys | ✔ | | | |
| manage_users | ✔ | ✔ | | |
| view_hq_dashboard, view_all_branches, view_all_responses, manage_alerts_regional | ✔ | ✔ | | |
| manage_surveys_local, receive_branch_alerts | | | ✔ | |
| view_own_branches, view_own_responses, view_own_dashboard, manage_alerts_local | | | ✔ | ✔ |
