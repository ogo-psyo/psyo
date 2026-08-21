export type VoiceCapturePhase = 'idle' | 'recording' | 'transcribing' | 'review' | 'error';

export type VoiceCaptureState = {
  phase: VoiceCapturePhase;
  transcript: string;
  durationSeconds: number | null;
  error: string | null;
};

export type VoiceCaptureEvent =
  | { type: 'recording_started' }
  | { type: 'recording_stopped' }
  | { type: 'transcription_succeeded'; transcript: string; durationSeconds: number }
  | { type: 'transcription_failed'; error: string }
  | { type: 'transcript_changed'; transcript: string }
  | { type: 'retry_started' }
  | { type: 'cancelled' };

export const initialVoiceCaptureState: VoiceCaptureState = {
  phase: 'idle',
  transcript: '',
  durationSeconds: null,
  error: null,
};

export function voiceCaptureReducer(state: VoiceCaptureState, event: VoiceCaptureEvent): VoiceCaptureState {
  if (event.type === 'cancelled') return initialVoiceCaptureState;
  if (event.type === 'recording_started') return { ...initialVoiceCaptureState, phase: 'recording' };
  if (event.type === 'recording_stopped' || event.type === 'retry_started') {
    return { ...state, phase: 'transcribing', error: null };
  }
  if (event.type === 'transcription_succeeded') {
    return {
      phase: 'review',
      transcript: event.transcript,
      durationSeconds: event.durationSeconds,
      error: null,
    };
  }
  if (event.type === 'transcription_failed') return { ...state, phase: 'error', error: event.error };
  if (event.type === 'transcript_changed') return { ...state, transcript: event.transcript };
  return state;
}

export function voiceCaptureErrorCopy(code: string) {
  if (code === 'AUTH_REQUIRED') return 'Открой Псё из Telegram и попробуй ещё раз.';
  if (code === 'NO_SPEECH_DETECTED') return 'Не расслышала речь. Запиши ещё раз чуть ближе к микрофону.';
  if (code === 'MICROPHONE_DENIED') return 'Разреши доступ к микрофону в настройках Telegram или продолжи текстом.';
  if (code === 'AUDIO_TOO_LONG') return 'Запись длиннее 45 секунд. Скажи главное короче или продолжи текстом.';
  if (code === 'AUDIO_TOO_LARGE') return 'Запись получилась слишком большой. Попробуй ещё раз короче.';
  if (code === 'STT_QUOTA_EXHAUSTED') return 'Лимит бесплатной расшифровки на сегодня закончился. Продолжи текстом.';
  if (code === 'STT_RATE_LIMITED') return 'Слишком много голосовых запросов за последний час. Продолжи текстом или попробуй позже.';
  if (code === 'STT_RATE_LIMIT_UNAVAILABLE') return 'Голосовой ввод временно недоступен. Можно продолжить текстом.';
  if (code === 'STT_NOT_CONFIGURED' || code === 'STT_PROVIDER_AUTH_FAILED' || code === 'STT_PROVIDER_UNAVAILABLE') {
    return 'Голосовой ввод сейчас недоступен. Можно продолжить текстом.';
  }
  if (code === 'NETWORK_ERROR') return 'Не удалось отправить запись. Проверь связь и повтори или продолжи текстом.';
  return 'Не удалось расшифровать запись. Повтори или продолжи текстом.';
}
