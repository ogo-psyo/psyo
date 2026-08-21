import { NextResponse } from 'next/server';
import { getRequestAuth } from '@/lib/server/auth';
import { getAppSessionFromRequest } from '@/lib/server/appSession';
import {
  GroqSttError,
  groqSttAvailability,
  transcribeGroqAudio,
} from '@/lib/server/groqStt';
import { getSupabaseAdmin } from '@/lib/server/supabase';
import { claimSttCapacity, SttRateLimitError } from '@/lib/server/sttRateLimit';

export const runtime = 'nodejs';

function json(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

function statusForSttError(code: string) {
  if (['UNSUPPORTED_AUDIO_TYPE', 'EMPTY_AUDIO', 'AUDIO_TOO_LARGE', 'INVALID_AUDIO', 'AUDIO_TOO_LONG', 'NO_SPEECH_DETECTED'].includes(code)) return 400;
  if (code === 'STT_QUOTA_EXHAUSTED') return 429;
  return 503;
}

type SttRouteDependencies = {
  admin: () => ReturnType<typeof getSupabaseAdmin>;
  claim: typeof claimSttCapacity;
};

export function createSttPostHandler(dependencies: SttRouteDependencies = {
  admin: getSupabaseAdmin,
  claim: claimSttCapacity,
}) {
  return async function post(request: Request) {
    const auth = await getRequestAuth(request);
    const appSession = getAppSessionFromRequest(request);
    const ownerId = auth.user?.id ?? appSession?.ownerId;
    if (!ownerId) return json({ error: 'AUTH_REQUIRED' }, 401);

    const form = await request.formData().catch(() => null);
    const audio = form?.get('audio');
    if (!(audio instanceof File)) return json({ error: 'AUDIO_REQUIRED' }, 400);

    const availability = groqSttAvailability();
    if (!availability.available) return json({ error: availability.reason }, 503);

    try {
      const admin = dependencies.admin();
      if (!admin) return json({ error: 'STT_RATE_LIMIT_UNAVAILABLE' }, 503);
      await dependencies.claim({ supabase: admin, ownerId });
      const result = await transcribeGroqAudio({
        bytes: new Uint8Array(await audio.arrayBuffer()),
        mimeType: audio.type,
        language: 'ru',
      });
      return json({
        transcript: result.text,
        durationSeconds: result.durationSeconds,
        provider: 'groq_whisper_large_v3_turbo',
        audioRetainedByPsyo: false,
      }, 200);
    } catch (error) {
      if (error instanceof SttRateLimitError) {
        return json({ error: error.code }, error.code === 'STT_RATE_LIMITED' ? 429 : 503);
      }
      if (error instanceof GroqSttError) return json({ error: error.code }, statusForSttError(error.code));
      return json({ error: 'STT_PROVIDER_UNAVAILABLE' }, 503);
    }
  };
}

export const POST = createSttPostHandler();
