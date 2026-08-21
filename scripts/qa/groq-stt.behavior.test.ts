import assert from 'node:assert/strict';
import test from 'node:test';
import {
  groqSttAvailability,
  transcribeGroqAudio,
  type GroqSttDependencies,
} from '../../lib/server/groqStt';

function fakeDependencies(response: Response | (() => Promise<Response>)) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const dependencies: GroqSttDependencies = {
    apiKey: 'gsk_test_not_secret',
    fetch: async (url, init) => {
      calls.push({ url: String(url), init });
      return typeof response === 'function' ? response() : response;
    },
  };
  return { dependencies, calls };
}

test('requires a configured Groq key without exposing it', () => {
  assert.deepEqual(groqSttAvailability({}), { available: false, reason: 'STT_NOT_CONFIGURED' });
  assert.deepEqual(groqSttAvailability({ GROQ_API_KEY: 'gsk_configured' }), { available: true });
});

test('sends supported audio to Groq Whisper and returns the normalized transcript', async () => {
  const fixture = fakeDependencies(Response.json({
    text: '  Мята сегодня больше спит.  ',
    duration: 8.4,
  }));

  const result = await transcribeGroqAudio({
    bytes: new Uint8Array([1, 2, 3, 4]),
    mimeType: 'audio/webm;codecs=opus',
    language: 'ru',
  }, fixture.dependencies);

  assert.deepEqual(result, { text: 'Мята сегодня больше спит.', durationSeconds: 8.4 });
  assert.equal(fixture.calls.length, 1);
  assert.equal(fixture.calls[0].url, 'https://api.groq.com/openai/v1/audio/transcriptions');
  assert.equal(new Headers(fixture.calls[0].init?.headers).get('authorization'), 'Bearer gsk_test_not_secret');
  const body = fixture.calls[0].init?.body;
  assert.ok(body instanceof FormData);
  assert.equal(body.get('model'), 'whisper-large-v3-turbo');
  assert.equal(body.get('language'), 'ru');
  assert.equal(body.get('response_format'), 'verbose_json');
  const file = body.get('file');
  assert.ok(file instanceof File);
  assert.equal(file.name, 'voice.webm');
  assert.equal(file.type, 'audio/webm');
});

test('rejects unsupported and oversized audio before calling Groq', async () => {
  const fixture = fakeDependencies(Response.json({ text: 'unused' }));
  await assert.rejects(
    transcribeGroqAudio({ bytes: new Uint8Array([1]), mimeType: 'text/plain' }, fixture.dependencies),
    /UNSUPPORTED_AUDIO_TYPE/,
  );
  await assert.rejects(
    transcribeGroqAudio({ bytes: new Uint8Array(4 * 1024 * 1024 + 1), mimeType: 'audio/webm' }, fixture.dependencies),
    /AUDIO_TOO_LARGE/,
  );
  assert.equal(fixture.calls.length, 0);
});

test('maps the free-tier limit to a recoverable quota error', async () => {
  const fixture = fakeDependencies(new Response(JSON.stringify({ error: { message: 'rate limit' } }), { status: 429 }));
  await assert.rejects(
    transcribeGroqAudio({ bytes: new Uint8Array([1]), mimeType: 'audio/ogg' }, fixture.dependencies),
    /STT_QUOTA_EXHAUSTED/,
  );
});

test('maps provider auth and availability failures without leaking response bodies', async () => {
  const auth = fakeDependencies(new Response('invalid provider credential must not escape', { status: 401 }));
  await assert.rejects(
    transcribeGroqAudio({ bytes: new Uint8Array([1]), mimeType: 'audio/mp4' }, auth.dependencies),
    (error: Error) => error.message === 'STT_PROVIDER_AUTH_FAILED' && !error.message.includes('gsk_'),
  );

  const unavailable = fakeDependencies(async () => { throw new Error('network with secret'); });
  await assert.rejects(
    transcribeGroqAudio({ bytes: new Uint8Array([1]), mimeType: 'audio/wav' }, unavailable.dependencies),
    (error: Error) => error.message === 'STT_PROVIDER_UNAVAILABLE',
  );
});

test('rejects empty or silence-like provider transcripts', async () => {
  const fixture = fakeDependencies(Response.json({ text: '[музыка]', duration: 2.1 }));
  await assert.rejects(
    transcribeGroqAudio({ bytes: new Uint8Array([1]), mimeType: 'audio/webm' }, fixture.dependencies),
    /NO_SPEECH_DETECTED/,
  );
});
