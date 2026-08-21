import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { POST } from '../../app/api/stt/transcribe/route';
import { createAppSessionToken } from '../../lib/server/appSession';

async function main() {
  const fixturePath = process.env.PSYO_STT_FIXTURE;
  if (!fixturePath) throw new Error('Set PSYO_STT_FIXTURE to a short audio file.');
  process.env.PSYO_SESSION_SIGNING_KEY = process.env.PSYO_SESSION_SIGNING_KEY || 'qa-groq-stt-live-key';

  const bytes = await readFile(fixturePath);
  const mimeType = fixturePath.endsWith('.webm') ? 'audio/webm'
    : fixturePath.endsWith('.ogg') ? 'audio/ogg'
      : fixturePath.endsWith('.m4a') || fixturePath.endsWith('.mp4') ? 'audio/mp4'
        : 'audio/wav';
  const form = new FormData();
  form.set('audio', new File([bytes], basename(fixturePath), { type: mimeType }));
  const session = createAppSessionToken({
    psyoUserId: 'qa-groq-stt-live',
    ownerId: '00000000-0000-4000-8000-000000000001',
  });
  const response = await POST(new Request('http://localhost/api/stt/transcribe', {
    method: 'POST',
    headers: {
      origin: 'http://localhost',
      cookie: `psyo_session=${encodeURIComponent(session.token)}`,
    },
    body: form,
  }));
  const payload = await response.json();
  assert.equal(response.status, 200, JSON.stringify(payload));
  assert.equal(typeof payload.transcript, 'string');
  assert.ok(payload.transcript.trim().length > 0);
  assert.equal(payload.provider, 'groq_whisper_large_v3_turbo');
  assert.equal(payload.audioRetainedByPsyo, false);
  console.log(JSON.stringify({ ok: true, transcript: payload.transcript, durationSeconds: payload.durationSeconds }));
}

void main();
