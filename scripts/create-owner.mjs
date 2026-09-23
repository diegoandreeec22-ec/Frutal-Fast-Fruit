// Crea el usuario Owner inicial de la empresa (una sola vez, tras correr las migraciones).
//
//   npm run create-owner -- owner@tu-dominio.pe "Nombre Apellido"
//
// Lee NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY de .env.local.
// Genera una contraseña temporal aleatoria y la muestra UNA vez: cámbiala al ingresar
// (Olvidé mi contraseña) o desde el panel de Supabase.
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';

import { createClient } from '@supabase/supabase-js';

function loadEnv(file) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
loadEnv('.env.local');
loadEnv('.env');

const [email, fullName = 'Owner', companyName = 'Frutal Fast Fruit'] = process.argv.slice(2);
if (!email || !email.includes('@')) {
  console.error('Uso: npm run create-owner -- <email> "<Nombre completo>" ["<Empresa>"]');
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local');
  process.exit(1);
}

const admin = createClient(url, key, { auth: { persistSession: false } });

const { data: company, error: cErr } = await admin.from('companies').select('id').eq('name', companyName).single();
if (cErr || !company) {
  console.error(`No existe la empresa "${companyName}". ¿Corriste las migraciones 001-005?`);
  process.exit(1);
}

const { data: ownerRole } = await admin
  .from('roles')
  .select('id')
  .eq('company_id', company.id)
  .eq('is_owner', true)
  .single();
if (!ownerRole) {
  console.error('No se encontró el rol Owner de la empresa.');
  process.exit(1);
}

const { count } = await admin.from('users').select('id', { count: 'exact', head: true }).eq('role_id', ownerRole.id);
if (count && count > 0) {
  console.error('La empresa ya tiene un Owner. Solo se permite uno.');
  process.exit(1);
}

const password = `${randomBytes(9).toString('base64url')}9a`;
const normalized = email.trim().toLowerCase();

const { data: created, error: aErr } = await admin.auth.admin.createUser({
  email: normalized,
  password,
  email_confirm: true,
  user_metadata: { full_name: fullName },
});
if (aErr || !created.user) {
  console.error('No se pudo crear el usuario en Auth:', aErr?.message);
  process.exit(1);
}

const { error: pErr } = await admin.from('users').insert({
  id: created.user.id,
  company_id: company.id,
  role_id: ownerRole.id,
  full_name: fullName,
  email: normalized,
});
if (pErr) {
  await admin.auth.admin.deleteUser(created.user.id);
  console.error('No se pudo crear el perfil:', pErr.message);
  process.exit(1);
}

console.log('\n✔ Owner creado');
console.log(`  Correo:     ${normalized}`);
console.log(`  Contraseña: ${password}   <- temporal, cámbiala al ingresar\n`);
