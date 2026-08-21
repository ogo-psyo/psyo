import assert from 'node:assert/strict';
import test from 'node:test';
import { createObservationExtractionPostHandler } from '../../app/api/observations/extract/route';
import { createAppSessionToken } from '../../lib/server/appSession';

process.env.PSYO_SESSION_SIGNING_KEY = 'qa-observation-extraction-key';

function query(data: unknown) {
  const value: any = { select: () => value, eq: () => value, is: () => value, order: () => value, limit: () => value, maybeSingle: async () => ({ data, error: null }), then: (resolve: (result: unknown) => void) => resolve({ data, error: null }) };
  return value;
}

test('extracts for the authenticated pet and returns a factual operation preview', async () => {
  const calls: any[] = [];
  const supabase = { from: (table: string) => table === 'pets' ? query({ id: 'pet-1' }) : query([]) };
  const POST = createObservationExtractionPostHandler({
    admin: () => supabase as never,
    extract: async (input: any) => {
      calls.push(input);
      return { provider: 'groq', mode: 'structured_groq', candidates: [{
        id: 'capture-1:energy:0', captureId: 'capture-1', petId: 'pet-1', metric: 'energy', value: 'бодрая', direction: 'stable', observedAt: '2026-08-21T09:30:00.000Z', onsetAt: '2026-08-21T09:30:00.000Z', authorId: 'owner-1', source: 'text', confidence: .93, transcriptSpan: 'бодрая', confirmed: false,
      }], usage: { inputTokens: 1, outputTokens: 1 } };
    },
  });
  const session = createAppSessionToken({ psyoUserId: 'telegram-user', ownerId: 'owner-1' });
  const response = await POST(new Request('http://localhost/api/observations/extract', {
    method: 'POST', headers: { origin: 'http://localhost', cookie: `psyo_session=${encodeURIComponent(session.token)}`, 'content-type': 'application/json' },
    body: JSON.stringify({ petId: 'pet-1', captureId: 'capture-1', transcript: 'Мята сегодня бодрая', observedAt: '2026-08-21T09:30:00.000Z', source: 'text' }),
  }));
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(calls[0].authorId, 'owner-1');
  assert.equal(body.candidates[0].source, 'text');
  assert.equal(body.decisions[0].operation, 'create');
});

test('rejects extraction without an authenticated owner', async () => {
  const POST = createObservationExtractionPostHandler({ admin: () => null, extract: async () => { throw new Error('must not run'); } });
  const response = await POST(new Request('http://localhost/api/observations/extract', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ petId: 'pet-1', transcript: 'бодрая' }) }));
  assert.equal(response.status, 401);
});
