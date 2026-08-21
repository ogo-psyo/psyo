import assert from 'node:assert/strict';
import test from 'node:test';
import {
  initialVoiceCaptureState,
  voiceCaptureReducer,
  voiceCaptureErrorCopy,
} from '../../lib/voiceCapture';

test('moves from idle through recording to an editable transcript', () => {
  const recording = voiceCaptureReducer(initialVoiceCaptureState, { type: 'recording_started' });
  assert.equal(recording.phase, 'recording');

  const transcribing = voiceCaptureReducer(recording, { type: 'recording_stopped' });
  assert.equal(transcribing.phase, 'transcribing');

  const review = voiceCaptureReducer(transcribing, {
    type: 'transcription_succeeded',
    transcript: 'Мята сегодня больше спит',
    durationSeconds: 6.2,
  });
  assert.deepEqual(review, {
    phase: 'review',
    transcript: 'Мята сегодня больше спит',
    durationSeconds: 6.2,
    error: null,
  });
});

test('cancel clears temporary text and retry keeps the captured audio available', () => {
  const failed = voiceCaptureReducer(
    { ...initialVoiceCaptureState, phase: 'transcribing' },
    { type: 'transcription_failed', error: 'NETWORK_ERROR' },
  );
  assert.equal(failed.phase, 'error');
  assert.equal(failed.error, 'NETWORK_ERROR');

  const retrying = voiceCaptureReducer(failed, { type: 'retry_started' });
  assert.equal(retrying.phase, 'transcribing');
  assert.equal(retrying.transcript, '');

  assert.deepEqual(voiceCaptureReducer(retrying, { type: 'cancelled' }), initialVoiceCaptureState);
});

test('maps server and browser failures to an actionable Russian recovery', () => {
  assert.equal(voiceCaptureErrorCopy('AUTH_REQUIRED'), 'Открой Псё из Telegram и попробуй ещё раз.');
  assert.equal(voiceCaptureErrorCopy('NO_SPEECH_DETECTED'), 'Не расслышала речь. Запиши ещё раз чуть ближе к микрофону.');
  assert.equal(voiceCaptureErrorCopy('STT_PROVIDER_UNAVAILABLE'), 'Голосовой ввод сейчас недоступен. Можно продолжить текстом.');
  assert.equal(voiceCaptureErrorCopy('STT_QUOTA_EXHAUSTED'), 'Лимит бесплатной расшифровки на сегодня закончился. Продолжи текстом.');
  assert.equal(voiceCaptureErrorCopy('MICROPHONE_DENIED'), 'Разреши доступ к микрофону в настройках Telegram или продолжи текстом.');
});
