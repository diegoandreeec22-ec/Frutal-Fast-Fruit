// Pruebas de seguridad y lógica de la base de datos.
// Corre las migraciones reales sobre Postgres embebido (PGlite) emulando Supabase:
// roles anon/authenticated/service_role, auth.uid() y los GRANTs por defecto de Supabase.
//
//   npm run test:db
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const migrationsDir = join(root, 'supabase', 'migrations');

const db = new PGlite();
let passed = 0;
let failed = 0;

function ok(name, cond, extra = '') {
  if (cond) {
    passed++;
    console.log(`  ✔ ${name}`);
  } else {
    failed++;
    console.log(`  ✘ ${name} ${extra}`);
  }
}

async function as(role, userId, fn) {
  await db.exec(`reset role; set request.jwt.claim.sub = '${userId ?? ''}'; set role ${role};`);
  try {
    return await fn();
  } finally {
    await db.exec(`reset role; set request.jwt.claim.sub = '';`);
  }
}

async function denied(fn) {
  try {
    await fn();
    return false;
  } catch (e) {
    return /permission denied|violates row-level security/i.test(e.message);
  }
}

async function errorMessage(fn) {
  try {
    await fn();
    return null;
  } catch (e) {
    return e.message;
  }
}

// ---------------------------------------------------------------------------
// 1. Emulación de Supabase
// ---------------------------------------------------------------------------
await db.exec(`
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
  grant usage on schema public to anon, authenticated, service_role;
  -- Supabase concede TODO por defecto en public; las migraciones deben revocarlo
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
`);

// ---------------------------------------------------------------------------
// 2. Migraciones
// ---------------------------------------------------------------------------
console.log('\nMigraciones');
for (const file of readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()) {
  try {
    await db.exec(readFileSync(join(migrationsDir, file), 'utf8'));
    ok(file, true);
  } catch (e) {
    ok(file, false, `\n    ${e.message}`);
    console.log(`\n${passed} OK, ${failed} fallidas`);
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// 3. Datos de prueba: 2 sucursales en Frutal + otra empresa
// ---------------------------------------------------------------------------
const one = async (sql, params) => (await db.query(sql, params)).rows[0];

const company = await one(`select id from public.companies where name = 'Frutal Fast Fruit'`);
const branch1 = await one(`select id from public.branches where slug = 'miraflores'`);
const branch2 = await one(
  `insert into public.branches (company_id, name, slug) values ($1, 'Frutal San Isidro', 'san-isidro') returning id`,
  [company.id],
);
const other = await one(`insert into public.companies (name) values ('Competidor SAC') returning id`);
await db.query(`select public.create_company_roles($1)`, [other.id]);
const otherBranch = await one(
  `insert into public.branches (company_id, name, slug) values ($1, 'Competidor Centro', 'competidor-centro') returning id`,
  [other.id],
);

const roleId = async (companyId, name) =>
  (await one(`select id from public.roles where company_id = $1 and name = $2`, [companyId, name])).id;

async function makeUser(email, companyId, roleName, branchIds = []) {
  const id = crypto.randomUUID();
  await db.query(`insert into auth.users (id, email) values ($1, $2)`, [id, email]);
  await db.query(
    `insert into public.users (id, company_id, role_id, full_name, email) values ($1, $2, $3, $4, $5)`,
    [id, companyId, await roleId(companyId, roleName), email.split('@')[0], email],
  );
  for (const b of branchIds) {
    await db.query(`insert into public.user_branches (user_id, branch_id) values ($1, $2)`, [id, b]);
  }
  return id;
}

const owner = await makeUser('owner@frutal.pe', company.id, 'Owner');
const gerenteGeneral = await makeUser('gg@frutal.pe', company.id, 'Gerente General');
const gerenteLocal = await makeUser('local1@frutal.pe', company.id, 'Gerente de Local', [branch1.id]);
const operativo2 = await makeUser('op2@frutal.pe', company.id, 'Operativo', [branch2.id]);
const otherOwner = await makeUser('owner@competidor.pe', other.id, 'Owner');

const survey = await one(`select id from public.surveys where name = 'Encuesta de Salón'`);
const questions = (
  await db.query(
    `select id, question_type, options from public.survey_questions where survey_id = $1 order by order_index`,
    [survey.id],
  )
).rows;

function answers({ nps = 9, rating = 5, choice = 'jugos', text = 'Todo bien' } = {}) {
  const out = {};
  for (const q of questions) {
    if (q.question_type === 'nps') out[q.id] = nps;
    else if (q.question_type === 'rating') out[q.id] = rating;
    else if (q.question_type === 'multiple_choice') out[q.id] = choice;
    else out[q.id] = text;
  }
  return out;
}

const submit = (branchId, surveyId, ans, table = null) =>
  db.query(`select public.submit_survey($1, $2, $3::jsonb, $4) as r`, [branchId, surveyId, JSON.stringify(ans), table]);

// ---------------------------------------------------------------------------
// 4. anon
// ---------------------------------------------------------------------------
console.log('\nanon (visitante sin sesión)');
for (const table of ['companies', 'branches', 'surveys', 'survey_questions', 'responses', 'alerts', 'users', 'user_invitations', 'notifications']) {
  ok(`no puede leer ${table}`, await as('anon', null, () => denied(() => db.query(`select * from public.${table}`))));
}
ok('no puede INSERT en responses', await as('anon', null, () =>
  denied(() => db.query(`insert into public.responses (branch_id, survey_id) values ($1, $2)`, [branch1.id, survey.id])),
));
ok('no puede INSERT en alerts', await as('anon', null, () =>
  denied(() => db.query(`insert into public.alerts (branch_id, metric_type, metric_value, threshold) values ($1,'x',1,1)`, [branch1.id])),
));
ok('no puede UPDATE alerts', await as('anon', null, () => denied(() => db.query(`update public.alerts set status = 'resolved'`))));
ok('no puede ejecutar has_permission()', await as('anon', null, () => denied(() => db.query(`select public.has_permission('manage_users')`))));
ok('no puede ejecutar claim_notifications()', await as('anon', null, () => denied(() => db.query(`select * from public.claim_notifications(10)`))));
ok('no puede ejecutar create_company_roles()', await as('anon', null, () =>
  denied(() => db.query(`select public.create_company_roles($1)`, [other.id])),
));
ok('no puede ejecutar dashboard_metrics()', await as('anon', null, () =>
  denied(() => db.query(`select public.dashboard_metrics(now() - interval '1 day', now())`)),
));

const pub = await as('anon', null, () => one(`select public.get_public_survey('miraflores') as s`));
ok('get_public_survey devuelve la encuesta predeterminada', pub.s?.survey?.name === 'Encuesta de Salón');
ok('get_public_survey no expone umbrales', !JSON.stringify(pub.s).includes('threshold'));
ok('get_public_survey slug inexistente -> null', (await as('anon', null, () => one(`select public.get_public_survey('no-existe') as s`))).s === null);

const good = await as('anon', null, () => submit(branch1.id, survey.id, answers(), 5));
ok('submit_survey válido guarda la respuesta', good.rows[0].r.success === true);

const bad = async (label, ans, branch = branch1.id, surv = survey.id) => {
  const msg = await as('anon', null, () => errorMessage(() => submit(branch, surv, ans)));
  ok(`submit_survey rechaza ${label}`, msg !== null, msg ?? '');
};
await bad('opción inexistente', answers({ choice: 'hackeo' }));
await bad('valor fuera de escala', answers({ rating: 99 }));
await bad('decimal en escala', answers({ rating: 3.5 }));
await bad('texto en pregunta numérica', { ...answers(), [questions[0].id]: 'diez' });
await bad('pregunta requerida faltante', (() => { const a = answers(); delete a[questions[0].id]; return a; })());
await bad('pregunta de otra encuesta', { ...answers(), [crypto.randomUUID()]: 5 });
await bad('encuesta de otra empresa en sucursal propia', answers(), otherBranch.id);

// ---------------------------------------------------------------------------
// 5. Alertas y escalamiento
// ---------------------------------------------------------------------------
console.log('\nAlertas y escalamiento (3 críticas en 7 días)');
await as('anon', null, () => submit(branch1.id, survey.id, answers({ nps: 3, rating: 4 })));
await as('anon', null, () => submit(branch1.id, survey.id, answers({ nps: 2, rating: 4 })));
let esc = await one(`select count(*)::int as n from public.alerts where branch_id = $1 and escalated_to_hq`, [branch1.id]);
ok('2 respuestas críticas: aún no escala', esc.n === 0);
await as('anon', null, () => submit(branch1.id, survey.id, answers({ nps: 1, rating: 4 })));
esc = await one(`select count(*)::int as n from public.alerts where branch_id = $1 and escalated_to_hq`, [branch1.id]);
ok('3ª respuesta crítica: escala inmediatamente', esc.n === 3, `escaladas=${esc.n}`);
const escNotif = (await db.query(`select recipient_email from public.notifications where notification_type = 'escalation' order by 1`)).rows.map((r) => r.recipient_email);
ok('escalamiento notifica a gerente local + HQ', ['gg@frutal.pe', 'local1@frutal.pe', 'owner@frutal.pe'].every((e) => escNotif.includes(e)), JSON.stringify(escNotif));
ok('escalamiento NO notifica a otra empresa ni a operativo de otra sucursal', !escNotif.includes('owner@competidor.pe') && !escNotif.includes('op2@frutal.pe'));
await as('anon', null, () => submit(branch1.id, survey.id, answers({ nps: 5, rating: 4 })));
const warn = await one(`select status from public.notifications where notification_type = 'alert' and subject like '🟠%' limit 1`);
ok('alerta warning => solo in-app (email skipped)', warn?.status === 'skipped');

// ---------------------------------------------------------------------------
// 6. Scope de usuarios autenticados
// ---------------------------------------------------------------------------
console.log('\nScope por rol');
const branchesSeen = async (uid) =>
  as('authenticated', uid, async () => (await db.query(`select slug from public.branches order by slug`)).rows.map((r) => r.slug));

ok('Owner ve todas las sucursales de su empresa', JSON.stringify(await branchesSeen(owner)) === '["miraflores","san-isidro"]');
ok('Gerente General ve todas las sucursales', (await branchesSeen(gerenteGeneral)).length === 2);
ok('Gerente de Local ve solo su sucursal', JSON.stringify(await branchesSeen(gerenteLocal)) === '["miraflores"]');
ok('Operativo ve solo su sucursal', JSON.stringify(await branchesSeen(operativo2)) === '["san-isidro"]');
ok('Otra empresa no ve sucursales de Frutal', JSON.stringify(await branchesSeen(otherOwner)) === '["competidor-centro"]');

const respCount = async (uid) => as('authenticated', uid, async () => (await one(`select count(*)::int as n from public.responses`)).n);
ok('Owner ve todas las respuestas', (await respCount(owner)) === 5);
ok('Operativo de San Isidro no ve respuestas de Miraflores', (await respCount(operativo2)) === 0);
ok('Otra empresa no ve respuestas', (await respCount(otherOwner)) === 0);

const alertIdB1 = (await one(`select id from public.alerts where branch_id = $1 limit 1`, [branch1.id])).id;
const upd = await as('authenticated', operativo2, () =>
  db.query(`update public.alerts set status = 'resolved' where id = $1`, [alertIdB1]),
);
ok('Operativo no puede gestionar alertas de otra sucursal', upd.affectedRows === 0);
await as('authenticated', gerenteLocal, () =>
  db.query(`update public.alerts set status = 'resolved', resolution_note = 'Hablamos con el cliente' where id = $1`, [alertIdB1]),
);
const resolved = await one(`select status, resolved_at from public.alerts where id = $1`, [alertIdB1]);
ok('Gerente de Local resuelve alerta de su sucursal (resolved_at automático)', resolved.status === 'resolved' && resolved.resolved_at !== null);
ok('no se puede cambiar severidad de una alerta', await as('authenticated', owner, () =>
  denied(() => db.query(`update public.alerts set severity = 'warning' where id = $1`, [alertIdB1])),
));
ok('nadie autenticado puede borrar alertas', await as('authenticated', owner, () => denied(() => db.query(`delete from public.alerts`))));
ok('nadie autenticado puede borrar sucursales', await as('authenticated', owner, () => denied(() => db.query(`delete from public.branches`))));

// Escalada de privilegios (falla S1 del MVP)
ok('usuario NO puede cambiar su propio role_id', await as('authenticated', operativo2, () =>
  denied(() => db.query(`update public.users set role_id = $1 where id = $2`, [ownerRoleIdPlaceholder(), operativo2])),
));
function ownerRoleIdPlaceholder() { return crypto.randomUUID(); }
ok('usuario NO puede cambiar su company_id', await as('authenticated', operativo2, () =>
  denied(() => db.query(`update public.users set company_id = $1 where id = $2`, [other.id, operativo2])),
));
ok('usuario NO puede reactivarse (is_active)', await as('authenticated', operativo2, () =>
  denied(() => db.query(`update public.users set is_active = true where id = $1`, [operativo2])),
));
await as('authenticated', operativo2, () => db.query(`update public.users set full_name = 'Operativo Dos' where id = $1`, [operativo2]));
ok('usuario SÍ puede cambiar su nombre', (await one(`select full_name from public.users where id = $1`, [operativo2])).full_name === 'Operativo Dos');
ok('usuario NO puede insertar user_branches', await as('authenticated', operativo2, () =>
  denied(() => db.query(`insert into public.user_branches (user_id, branch_id) values ($1, $2)`, [operativo2, branch1.id])),
));

const usersSeen = await as('authenticated', operativo2, async () => (await db.query(`select email from public.users`)).rows);
ok('Operativo solo ve su propio perfil', usersSeen.length === 1 && usersSeen[0].email === 'op2@frutal.pe');

const notifSeen = await as('authenticated', gerenteLocal, async () => (await db.query(`select id, subject from public.notifications`)).rows.length);
const notifOwn = (await one(`select count(*)::int as n from public.notifications where user_id = $1`, [gerenteLocal])).n;
ok('cada usuario ve solo sus notificaciones', notifSeen === notifOwn && notifOwn > 0);

// Encuestas
ok('Operativo no puede crear encuestas', await as('authenticated', operativo2, () =>
  denied(() => db.query(`insert into public.surveys (company_id, name) values ($1, 'Hack')`, [company.id])),
));
await as('authenticated', gerenteLocal, () =>
  db.query(`insert into public.surveys (company_id, branch_id, name) values ($1, $2, 'Encuesta Miraflores')`, [company.id, branch1.id]),
);
ok('Gerente de Local crea encuesta de SU sucursal', !!(await one(`select id from public.surveys where name = 'Encuesta Miraflores'`)));
ok('Gerente de Local NO crea encuesta de empresa', await as('authenticated', gerenteLocal, () =>
  denied(() => db.query(`insert into public.surveys (company_id, name) values ($1, 'Global hack')`, [company.id])),
));
ok('Gerente de Local NO crea encuesta de otra sucursal', await as('authenticated', gerenteLocal, () =>
  denied(() => db.query(`insert into public.surveys (company_id, branch_id, name) values ($1, $2, 'SI hack')`, [company.id, branch2.id])),
));
ok('Owner no puede crear sucursal en otra empresa', await as('authenticated', owner, () =>
  denied(() => db.query(`insert into public.branches (company_id, name, slug) values ($1, 'x', 'x')`, [other.id])),
));

// Métricas
const m = await as('authenticated', owner, () => one(`select public.dashboard_metrics(now() - interval '1 day', now() + interval '1 minute') as m`));
ok('dashboard_metrics: total de respuestas', m.m.totals.responses === 5, JSON.stringify(m.m.totals));
ok('dashboard_metrics: NPS calculado', typeof m.m.totals.nps === 'number');
const mOp = await as('authenticated', operativo2, () => one(`select public.dashboard_metrics(now() - interval '1 day', now() + interval '1 minute') as m`));
ok('dashboard_metrics respeta RLS (operativo San Isidro = 0)', mOp.m.totals.responses === 0);

const prof = await as('authenticated', gerenteLocal, () => one(`select public.my_profile() as p`));
ok('my_profile devuelve rol desde la BD', prof.p.role.name === 'Gerente de Local' && prof.p.permissions.includes('manage_alerts_local'));

// Usuario desactivado pierde todo acceso
await db.query(`update public.users set is_active = false where id = $1`, [gerenteLocal]);
ok('usuario desactivado no ve sucursales', (await branchesSeen(gerenteLocal)).length === 0);

// Cola de notificaciones
const claimed = await as('service_role', null, async () => (await db.query(`select id from public.claim_notifications(100)`)).rows.length);
const claimedAgain = await as('service_role', null, async () => (await db.query(`select id from public.claim_notifications(100)`)).rows.length);
ok('claim_notifications toma pendientes una sola vez', claimed > 0 && claimedAgain === 0, `${claimed}/${claimedAgain}`);

console.log(`\n${passed} OK, ${failed} fallidas\n`);
process.exit(failed ? 1 : 0);
