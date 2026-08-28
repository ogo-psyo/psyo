import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import sharp from 'sharp';
import { rc1Config } from '@/lib/rc1';
import {
  avatarConsentVersion,
  avatarErrorResponse,
  avatarPromptVersion,
  AvatarIdentityError,
  assertAvatarPromptPolicy,
  boundedOwnerPrompt,
  buildServerAvatarPrompt,
  getAvatarOwnerContext,
  parseAvatarMode,
  parseAvatarStyle,
  requireOwnedPet,
  storePrivateAvatar,
  validateIdempotencyKey,
} from '@/lib/server/avatarIdentity';

export const runtime = 'nodejs';

const provider = 'deapi';
const generationModel = 'Flux1schnell';
const editModel = 'Flux_2_Klein_4B_BF16';
const perOwnerHourlyLimit = 4;
const providerTimeoutMs = 45_000;

function enabledBudget() {
  const budget = Number(process.env.AVATAR_DAILY_BUDGET_CENTS || '0');
  const estimate = Number(process.env.AVATAR_DEAPI_ESTIMATED_COST_CENTS || '0');
  if (process.env.AVATAR_DEAPI_ENABLED !== 'true' || !Number.isSafeInteger(budget) || budget <= 0 || !Number.isSafeInteger(estimate) || estimate <= 0) {
    throw new AvatarIdentityError('AVATAR_PROVIDER_DISABLED', 503);
  }
  return { budget, estimate };
}

function deapiGatewayToken(apiKey: string) {
  return apiKey.startsWith('dpn-sk-') ? apiKey : `dpn-sk-${apiKey}`;
}

async function readProviderImage(response: Response) {
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    if ([402, 429].includes(response.status)) throw new AvatarIdentityError('AVATAR_PROVIDER_QUOTA', 429);
    throw new AvatarIdentityError('AVATAR_PROVIDER_FAILED', 503);
  }
  const image = data?.data?.[0];
  if (typeof image?.b64_json === 'string') {
    const maximumBase64Length = Math.ceil((12 * 1024 * 1024) / 3) * 4;
    if (image.b64_json.length > maximumBase64Length) throw new AvatarIdentityError('AVATAR_PROVIDER_IMAGE_TOO_LARGE', 503);
    return Buffer.from(image.b64_json, 'base64');
  }
  // Never server-fetch arbitrary provider URLs. The provider must return inline
  // bytes so this endpoint has no SSRF or unbounded-download surface.
  throw new AvatarIdentityError('AVATAR_PROVIDER_EMPTY', 503);
}

export async function POST(request: Request, { params }: { params: Promise<{ petId: string }> }) {
  let jobId: string | null = null;
  let context: Awaited<ReturnType<typeof getAvatarOwnerContext>> | null = null;
  try {
    if (!rc1Config.flags.avatar_generation_enabled) return NextResponse.json({ error: 'AVATAR_GENERATION_DISABLED' }, { status: 403 });
    const budget = enabledBudget();
    const apiKey = process.env.DEAPI_API_KEY;
    if (!apiKey) throw new AvatarIdentityError('AVATAR_PROVIDER_DISABLED', 503);
    const { petId } = await params;
    context = await getAvatarOwnerContext(request);
    const pet = await requireOwnedPet(context, petId);
    const idempotencyKey = validateIdempotencyKey(request.headers.get('idempotency-key'));
    const body = await request.json().catch(() => null);
    const mode = parseAvatarMode(body?.mode);
    const style = parseAvatarStyle(body?.styleId);
    const ownerPrompt = boundedOwnerPrompt(body?.ownerPrompt);
    assertAvatarPromptPolicy(ownerPrompt);
    const consentVersion = String(body?.consentVersion || '');
    if (consentVersion !== avatarConsentVersion) throw new AvatarIdentityError('AVATAR_PROVIDER_CONSENT_REQUIRED', 409);
    const referenceAssetId = typeof body?.referenceAssetId === 'string' ? body.referenceAssetId : null;
    if (mode !== 'text_to_image' && !referenceAssetId) throw new AvatarIdentityError('REFERENCE_ASSET_REQUIRED', 400);

    const prompt = buildServerAvatarPrompt({ pet, style, ownerPrompt, mode });
    const model = mode === 'text_to_image' ? generationModel : editModel;
    const promptHash = createHash('sha256').update(prompt).digest('hex');
    const fingerprint = createHash('sha256').update(JSON.stringify({ petId, mode, style, ownerPrompt, referenceAssetId, consentVersion })).digest('hex');

    let reference: { id: string; storage_bucket: string; storage_path: string } | null = null;
    if (referenceAssetId) {
      const result = await context.supabase.from('avatar_assets')
        .select('id,storage_bucket,storage_path')
        .eq('id', referenceAssetId).eq('owner_id', context.ownerId).eq('pet_id', petId)
        .eq('asset_type', 'avatar_image').eq('source_kind', 'uploaded').is('deleted_at', null).maybeSingle();
      if (result.error) throw new AvatarIdentityError('REFERENCE_ASSET_READ_FAILED', 500);
      if (!result.data?.storage_bucket || !result.data.storage_path) throw new AvatarIdentityError('REFERENCE_ASSET_NOT_FOUND', 404);
      reference = result.data;
    }

    const claimed = await context.supabase.rpc('claim_avatar_job_for_owner', {
      p_owner_id: context.ownerId,
      p_pet_id: petId,
      p_style_id: style,
      p_mode: mode,
      p_prompt_version: avatarPromptVersion,
      p_prompt_hash: promptHash,
      p_idempotency_key: idempotencyKey,
      p_request_fingerprint: fingerprint,
      p_consent_version: consentVersion,
      p_input_asset_id: referenceAssetId,
      p_provider: provider,
      p_model: model,
      p_timeout_ms: providerTimeoutMs,
      p_estimated_cost_cents: budget.estimate,
      p_daily_budget_cents: budget.budget,
      p_hourly_limit: perOwnerHourlyLimit,
    });
    if (claimed.error) {
      const message = claimed.error.message || '';
      if (message.includes('AVATAR_OWNER_QUOTA')) throw new AvatarIdentityError('AVATAR_OWNER_QUOTA', 429);
      if (message.includes('AVATAR_DAILY_BUDGET_REACHED')) throw new AvatarIdentityError('AVATAR_DAILY_BUDGET_REACHED', 429);
      if (message.includes('IDEMPOTENCY_CONFLICT')) throw new AvatarIdentityError('IDEMPOTENCY_CONFLICT', 409);
      throw new AvatarIdentityError('AVATAR_JOB_WRITE_FAILED', 500);
    }
    jobId = claimed.data?.jobId || null;
    if (!jobId) throw new AvatarIdentityError('AVATAR_JOB_WRITE_FAILED', 500);
    if (claimed.data?.replayed) {
      const asset = await context.supabase.from('avatar_assets')
        .select('id,status,source_kind,style_id,width,height')
        .eq('job_id', jobId).eq('owner_id', context.ownerId).eq('pet_id', petId).is('deleted_at', null).maybeSingle();
      return NextResponse.json({
        replayed: true,
        job: { id: jobId, status: claimed.data.status },
        asset: asset.data ? { ...asset.data, renderUrl: `/api/v1/pets/${petId}/avatar/assets/${asset.data.id}/render` } : null,
      }, { status: claimed.data.status === 'ready' ? 200 : 409 });
    }

    await context.supabase.from('avatar_jobs').update({ status: 'generating' }).eq('id', jobId).eq('owner_id', context.ownerId);

    let providerResponse: Response;
    if (mode === 'text_to_image') {
      providerResponse = await fetch('https://oai.deapi.ai/v1/images/generations', {
        method: 'POST',
        headers: { Authorization: `Bearer ${deapiGatewayToken(apiKey)}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, prompt, size: '1024x1024', quality: 'medium', n: 1, response_format: 'b64_json' }),
        signal: AbortSignal.timeout(providerTimeoutMs),
      });
    } else {
      const downloaded = await context.supabase.storage.from(reference!.storage_bucket).download(reference!.storage_path);
      if (downloaded.error || !downloaded.data) throw new AvatarIdentityError('REFERENCE_ASSET_NOT_FOUND', 404);
      const form = new FormData();
      form.set('model', model);
      form.set('image', new File([await downloaded.data.arrayBuffer()], 'dog-reference.jpg', { type: 'image/jpeg' }));
      form.set('prompt', prompt);
      form.set('size', '1024x1024');
      form.set('response_format', 'b64_json');
      form.set('quality', 'medium');
      form.set('n', '1');
      providerResponse = await fetch('https://oai.deapi.ai/v1/images/edits', {
        method: 'POST',
        headers: { Authorization: `Bearer ${deapiGatewayToken(apiKey)}` },
        body: form,
        signal: AbortSignal.timeout(providerTimeoutMs),
      });
    }

    const rawImage = await readProviderImage(providerResponse);
    let generated: Buffer;
    try {
      generated = await sharp(rawImage, { failOn: 'error', limitInputPixels: 64_000_000 })
        .resize({ width: 1024, height: 1024, fit: 'cover' })
        .jpeg({ quality: 92, mozjpeg: true }).toBuffer();
    } catch {
      throw new AvatarIdentityError('AVATAR_PROVIDER_INVALID_IMAGE', 503);
    }
    const metadata = await sharp(generated).metadata();
    const asset = await storePrivateAvatar({
      context,
      petId,
      buffer: generated,
      kind: 'avatar_image',
      sourceKind: 'generated',
      mimeType: 'image/jpeg',
      width: metadata.width || 1024,
      height: metadata.height || 1024,
      sha256: createHash('sha256').update(generated).digest('hex'),
      jobId,
      parentAssetId: referenceAssetId,
      styleId: style,
      generationMode: mode,
      provider,
      model,
      retentionUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    });
    await context.supabase.from('avatar_jobs').update({
      status: 'ready',
      completed_at: new Date().toISOString(),
    }).eq('id', jobId).eq('owner_id', context.ownerId);
    return NextResponse.json({
      replayed: false,
      job: { id: jobId, status: 'ready', mode, provider },
      asset: { id: asset.id, status: 'draft', source: 'generated', styleId: style, renderUrl: `/api/v1/pets/${petId}/avatar/assets/${asset.id}/render` },
    }, { status: 201 });
  } catch (error) {
    const isTimeout = error instanceof DOMException && error.name === 'TimeoutError';
    const known = isTimeout ? { error: 'AVATAR_PROVIDER_TIMEOUT', status: 504 } : avatarErrorResponse(error);
    if (jobId && context) {
      const status = known.error === 'AVATAR_MODERATION_REJECTED' ? 'failed_moderation'
        : known.error === 'AVATAR_PROVIDER_TIMEOUT' ? 'failed_timeout'
        : 'failed_provider';
      await context.supabase.from('avatar_jobs').update({
        status,
        failure_reason: known.error,
        completed_at: new Date().toISOString(),
      }).eq('id', jobId).eq('owner_id', context.ownerId);
    }
    return NextResponse.json({ error: known.error }, { status: known.status });
  }
}
