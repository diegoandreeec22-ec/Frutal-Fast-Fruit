import { NextResponse } from 'next/server';

import { authorize, dbError, jsonError } from '@/lib/api';
import { createAdminClient } from '@/lib/supabase/admin';

const BUCKET = 'brand-assets';
const MAX_BYTES = 1024 * 1024;
// SVG excluido a propósito: puede contener scripts.
const TYPES: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };

export async function POST(request: Request) {
  const auth = await authorize('manage_settings');
  if (!auth.ok) return auth.response;

  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) return jsonError('Adjunta una imagen');
  const ext = TYPES[file.type];
  if (!ext) return jsonError('Formato no permitido (PNG, JPG o WEBP)');
  if (file.size > MAX_BYTES) return jsonError('La imagen debe pesar menos de 1 MB');

  const admin = createAdminClient();
  const { data: bucket } = await admin.storage.getBucket(BUCKET);
  if (!bucket) {
    await admin.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: MAX_BYTES,
      allowedMimeTypes: Object.keys(TYPES),
    });
  }

  const path = `${auth.profile.company_id}/logo-${Date.now()}.${ext}`;
  const { error: uploadError } = await admin.storage
    .from(BUCKET)
    .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false });
  if (uploadError) {
    console.error('[logo]', uploadError);
    return jsonError('No se pudo subir la imagen', 500);
  }

  const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(path);

  const { data, error } = await auth.supabase
    .from('companies')
    .update({ logo_url: pub.publicUrl })
    .eq('id', auth.profile.company_id)
    .select('logo_url')
    .single();
  if (error) return dbError(error);

  return NextResponse.json({ logo_url: data.logo_url });
}
