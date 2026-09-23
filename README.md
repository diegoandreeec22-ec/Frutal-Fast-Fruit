# Frutal Fast Fruit

SaaS de encuestas de satisfacción para los locales de Frutal Fast Fruit: encuestas por QR, alertas por calificaciones bajas, escalamiento automático a casa matriz y métricas NPS / CSAT / SLA.

**Stack:** Next.js 14 (App Router) · TypeScript strict · Tailwind CSS · Supabase (PostgreSQL + Auth + Storage + RLS) · Resend · Vercel

## Inicio rápido

```bash
npm install
cp .env.example .env.local      # completar credenciales
npm run test:db                 # prueba migraciones + seguridad en Postgres local
npm run dev                     # http://localhost:3000
```

La puesta en marcha completa (Supabase, primer usuario, Vercel, emails) está en [SETUP.md](SETUP.md).

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` / `npm start` | Build y servidor de producción |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript |
| `npm run test:db` | Corre las 5 migraciones en Postgres embebido (PGlite) emulando Supabase y ejecuta 68 pruebas de seguridad y negocio |
| `npm run create-owner -- <email> "<Nombre>"` | Crea el usuario Owner inicial |

## Estructura

```
app/
  (app)/            páginas con sesión: dashboard, alerts, responses, surveys, branches, qr, users, settings
  api/              endpoints (ver api-docs.md)
  public-survey/    encuesta pública (/s/<sucursal> redirige aquí)
  login, accept-invitation, forgot-password, reset-password
components/         UI por dominio (dashboard, survey, survey-builder, branch-management, users, ui/)
contexts/           AuthContext (perfil que viene de la BD)
lib/                supabase (client/server/admin), auth, validators (Zod), email, utilidades
supabase/migrations 001 esquema · 002 RLS · 003 funciones · 004 triggers · 005 datos iniciales
scripts/            test-db.mjs, create-owner.mjs
```

## Modelo de seguridad

- **El rol vive en la BD** (`public.users.role_id` → `roles` → `role_permissions`). Nunca se lee de `user_metadata`. `my_profile()` es la única fuente.
- **RLS en todas las tablas.** HQ (Owner, Gerente General) ve su `company_id`; Local (Gerente de Local, Operativo) solo las sucursales de `user_branches`.
- **Privilegios mínimos.** Se revocan los GRANT por defecto de Supabase y se conceden por columna: un usuario solo puede cambiar su `full_name`, nunca su `role_id`, `company_id` ni `is_active`.
- **anon no toca tablas.** Solo ejecuta `get_public_survey()` (sin umbrales ni datos internos) y `submit_survey()` (valida todo en una transacción).
- **Registro público desactivado.** Solo invitaciones: token aleatorio de 256 bits, se guarda únicamente su hash SHA-256, vence en 48 h y se acepta en el servidor con `service_role`. El email sale de la invitación, nunca del formulario.
- **Emails solo desde el servidor**, a partir de la tabla `notifications`. No existe ningún endpoint abierto que envíe correos.
- Nada se borra: sucursales, usuarios, encuestas y preguntas se desactivan; las alertas solo cambian de estado.
- Defensa CSRF por `Origin`, rate limit en login / encuesta / invitaciones, honeypot anti-bots, cabeceras de seguridad.

## Reglas de negocio

- **Encuesta dinámica por QR:** `/s/<sucursal>?e=<encuesta>&mesa=<n>`. Sin `e`, usa la encuesta predeterminada de la sucursal (o la primera de tipo Salón).
- **Dos umbrales por pregunta:** crítica si nota ≤ `critical_threshold`; advertencia si nota ≤ `warning_threshold`.
- **Escalamiento inmediato:** 3 respuestas con alerta crítica en 7 días móviles en la misma sucursal → trigger en PostgreSQL marca las alertas como escaladas y notifica al gerente del local + HQ.
- **Tipos de encuesta:** salón, delivery, para llevar, evento corporativo; varias activas a la vez; por empresa o por sucursal.
- Zona horaria `America/Lima`, formato `es-PE`.
