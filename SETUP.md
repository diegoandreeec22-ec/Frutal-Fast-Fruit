# Puesta en marcha

Tiempo estimado: 30–45 minutos.

## 1. Crear el proyecto Supabase

Crea un proyecto **nuevo** en https://supabase.com/dashboard (región sugerida: São Paulo, `sa-east-1`, la más cercana a Lima).

> ⚠️ No ejecutes estas migraciones sobre el proyecto actual de Rocket (`hcupvyvcyeypwignlobl`): ahí ya existen tablas con los mismos nombres y la migración 001 fallaría. Si quieres reutilizar ese proyecto, primero hay que respaldar y eliminar el esquema anterior, y eso es una decisión aparte.

## 2. Ejecutar las migraciones

En **SQL Editor**, ejecuta cada archivo **en orden**, uno por uno:

1. `supabase/migrations/001_initial_schema.sql`
2. `supabase/migrations/002_rls_policies.sql`
3. `supabase/migrations/003_functions.sql`
4. `supabase/migrations/004_triggers.sql`
5. `supabase/migrations/005_seed_data.sql`

Con Supabase CLI también sirve: `supabase link --project-ref <ref>` y luego `supabase db push`.

Después, en **Advisors → Security Advisor**, no debería aparecer ninguna tabla sin RLS.

## 3. Configurar Auth (manual, en el panel)

- **Authentication → Sign In / Providers → Email:** desactiva **Allow new users to sign up** (solo se entra por invitación).
- **Authentication → URL Configuration:**
  - Site URL: `https://tu-dominio.pe`
  - Redirect URLs: `https://tu-dominio.pe/api/auth/callback`, `http://localhost:3000/api/auth/callback`
- **Authentication → Emails → SMTP** (recomendado): usa las credenciales SMTP de Resend para que el correo de "recuperar contraseña" salga de tu dominio.

## 4. Variables de entorno

Copia `.env.example` a `.env.local` y completa:

| Variable | Dónde se obtiene |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API (anon / publishable) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API (service_role / secret). **Solo servidor.** |
| `NEXT_PUBLIC_APP_URL` | URL pública de la app (`http://localhost:3000` en local) |
| `RESEND_API_KEY` | https://resend.com/api-keys |
| `EMAIL_FROM` | Remitente de un dominio **verificado** en Resend, p. ej. `Frutal <alertas@frutal.pe>` |
| `CRON_SECRET` | Cadena aleatoria de 32+ caracteres (`openssl rand -hex 32`) |

## 5. Crear el Owner

```bash
npm install
npm run create-owner -- tu-correo@frutal.pe "Tu Nombre"
```

Muestra una contraseña temporal **una sola vez**. Ingresa en `/login` y cámbiala con "¿Olvidaste tu contraseña?". Desde **Usuarios** invitas al resto del equipo.

## 6. Probar en local

```bash
npm run dev
```

- Panel: http://localhost:3000
- Encuesta pública de la sucursal de ejemplo: http://localhost:3000/s/miraflores?mesa=5

Responde la encuesta con notas bajas (NPS ≤ 4) tres veces: verás las alertas críticas, el escalamiento a HQ y las notificaciones en la campana.

## 7. Deploy en Vercel

1. Sube el código a GitHub (`diegoandreeec22-ec/Frutal-Fast-Fruit`).
2. En Vercel: **Add New → Project** → importa el repo (framework: Next.js, se detecta solo).
3. Carga las variables del paso 4 en **Settings → Environment Variables** (`NEXT_PUBLIC_APP_URL` = tu dominio).
4. **Settings → Domains:** agrega tu dominio propio y apunta el DNS.
5. Actualiza en Supabase la Site URL y las Redirect URLs con el dominio final.

## 8. Emails (Resend)

1. En Resend, **Domains → Add Domain** y agrega los registros DNS (SPF, DKIM).
2. Usa ese dominio en `EMAIL_FROM`.

Cómo salen los correos:

- **Alertas críticas y escalamientos:** se envían en el momento en que el cliente envía la encuesta.
- **Reintentos:** `POST /api/notifications/send` (con `Authorization: Bearer <CRON_SECRET>`) reenvía los pendientes o fallidos, con un máximo de 3 intentos. `vercel.json` lo programa una vez al día, que es el límite del plan Hobby. Para reintentar cada 5 minutos, usa pg_cron en Supabase (Database → Extensions: activa `pg_cron` y `pg_net`):

```sql
select cron.schedule('frutal-notifications', '*/5 * * * *', $$
  select net.http_post(
    url := 'https://tu-dominio.pe/api/notifications/send',
    headers := jsonb_build_object('Authorization', 'Bearer TU_CRON_SECRET')
  );
$$);
```

## 9. Pruebas de la base de datos

```bash
npm run test:db
```

Corre las migraciones reales en un Postgres embebido que emula Supabase y verifica 68 casos: acceso anónimo, alcance por rol, intentos de escalada de privilegios, validación de encuestas, escalamiento 3-en-7-días, métricas y la cola de notificaciones.
