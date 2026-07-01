import { NextResponse } from 'next/server';
import { getRequestAuth } from '@/lib/server/auth';
import { getSupabaseAdmin } from '@/lib/server/supabase';
import { rc1Config } from '@/lib/rc1';

export const runtime = 'nodejs';

const bucket = 'pet-public';
const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);

function extensionFor(type: string, fallback = 'jpg') {
  if (type === 'image/png') return 'png';
  if (type === 'image/webp') return 'webp';
  if (type === 'image/heic') return 'heic';
  if (type === 'image/heif') return 'heif';
  return fallback;
}

async function ensurePublicBucket() {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { supabase: null, error: 'SUPABASE_NOT_CONFIGURED' };

  const { data: existing } = await supabase.storage.getBucket(bucket);
  if (existing) return { supabase, error: null };

  const { error } = await supabase.storage.createBucket(bucket, {
    public: true,
    fileSizeLimit: '8MB',
    allowedMimeTypes: Array.from(allowedTypes),
  });
  return { supabase, error: error?.message ?? null };
}

export async function POST(request: Request) {
  if (!rc1Config.flags.uploads_enabled) {
    return NextResponse.json({ error: 'UPLOADS_DISABLED' }, { status: 403 });
  }

  const auth = await getRequestAuth(request);
  if (!auth.user) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 });

  const form = await request.formData().catch(() => null);
  const file = form?.get('photo');
  if (!(file instanceof File)) return NextResponse.json({ error: 'PHOTO_REQUIRED' }, { status: 400 });
  if (!allowedTypes.has(file.type)) return NextResponse.json({ error: 'UNSUPPORTED_IMAGE_TYPE' }, { status: 415 });
  if (file.size > 8 * 1024 * 1024) return NextResponse.json({ error: 'PHOTO_TOO_LARGE' }, { status: 413 });

  const { supabase, error } = await ensurePublicBucket();
  if (!supabase) return NextResponse.json({ error }, { status: 503 });
  if (error) return NextResponse.json({ error }, { status: 500 });

  const ext = extensionFor(file.type);
  const path = `${auth.user.id}/${crypto.randomUUID()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await supabase.storage.from(bucket).upload(path, buffer, {
    contentType: file.type,
    cacheControl: '31536000',
    upsert: false,
  });
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return NextResponse.json({ bucket, path, publicUrl: data.publicUrl });
}
