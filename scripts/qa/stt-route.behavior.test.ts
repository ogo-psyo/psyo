import assert from 'node:assert/strict';
import test from 'node:test';
import { createSttPostHandler } from '../../app/api/stt/transcribe/route';
import { createAppSessionToken } from '../../lib/server/appSession';

process.env.PSYO_SESSION_SIGNING_KEY = 'qa-stt-session-key';

let claims = 0;
const POST = createSttPostHandler({
  admin: () => ({ rpc: async () => ({ data: 19, error: null }) }) as never,
  claim: async () => { claims += 1; return 19; },
});

function formRequest(input: { cookie?: string; origin?: string; withAudio?: boolean }) {
  const form = new FormData();
  if (input.withAudio) form.set('audio', new File([new Uint8Array([1, 2, 3])], 'voice.webm', { type: 'audio/webm' }));
  return new Request('http://localhost/api/stt/transcribe', {
    method: 'POST',
    headers: {
      ...(input.cookie ? { cookie: input.cookie } : {}),
      ...(input.origin ? { origin: input.origin } : {}),
    },
    body: form,
  });
}

function sessionCookie() {
  const session = createAppSessionToken({
    psyoUserId: 'qa-stt-user',
    ownerId: '00000000-0000-4000-8000-000000000001',
  });
  return `psyo_session=${encodeURIComponent(session.token)}`;
}

test('requires an authenticated owner before accepting audio', async () => {
  const response = await POST(formRequest({ origin: 'http://localhost', withAudio: true }));
  assert.equal(response.status, 401);
  assert.equal((await response.json()).error, 'AUTH_REQUIRED');
});

test('rejects a signed session sent from another origin', async () => {
  const response = await POST(formRequest({ cookie: sessionCookie(), origin: 'https://evil.example', withAudio: true }));
  assert.equal(response.status, 401);
  assert.equal((await response.json()).error, 'AUTH_REQUIRED');
});

test('requires a multipart audio file for an authenticated owner', async () => {
  const response = await POST(formRequest({ cookie: sessionCookie(), origin: 'http://localhost' }));
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, 'AUDIO_REQUIRED');
});

test('uses Groq from a Vercel runtime and never exposes provider details', async () => {
  claims = 0;
  process.env.VERCEL = '1';
  process.env.GROQ_API_KEY = 'gsk_route_test';
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    assert.equal(String(input), 'https://api.groq.com/openai/v1/audio/transcriptions');
    return Response.json({ text: 'Мята сегодня больше спит.', duration: 3.2 });
  };
  try {
    const response = await POST(formRequest({ cookie: sessionCookie(), origin: 'http://localhost', withAudio: true }));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      transcript: 'Мята сегодня больше спит.',
      durationSeconds: 3.2,
      provider: 'groq_whisper_large_v3_turbo',
      audioRetainedByPsyo: false,
    });
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(claims, 1);
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.VERCEL;
    delete process.env.GROQ_API_KEY;
  }
});

test('returns a safe 429 before sending audio when the owner hourly limit is reached', async () => {
  const limitedPost = createSttPostHandler({
    admin: () => ({}) as never,
    claim: async () => { const error = new (await import('../../lib/server/sttRateLimit')).SttRateLimitError('STT_RATE_LIMITED'); throw error; },
  });
  process.env.GROQ_API_KEY = 'gsk_route_test';
  const originalFetch = globalThis.fetch;
  let providerCalled = false;
  globalThis.fetch = async () => { providerCalled = true; return Response.json({ text: 'unexpected' }); };
  try {
    const response = await limitedPost(formRequest({ cookie: sessionCookie(), origin: 'http://localhost', withAudio: true }));
    assert.equal(response.status, 429);
    assert.equal((await response.json()).error, 'STT_RATE_LIMITED');
    assert.equal(providerCalled, false);
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.GROQ_API_KEY;
  }
});

test('returns a recoverable 429 when the Groq free-tier quota is exhausted', async () => {
  process.env.GROQ_API_KEY = 'gsk_route_test';
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response('{}', { status: 429 });
  try {
    const response = await POST(formRequest({ cookie: sessionCookie(), origin: 'http://localhost', withAudio: true }));
    assert.equal(response.status, 429);
    assert.equal((await response.json()).error, 'STT_QUOTA_EXHAUSTED');
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.GROQ_API_KEY;
  }
});
