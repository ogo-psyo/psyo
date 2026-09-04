'use client';

import { CaretDown, Microphone, PaperPlaneTilt, Stop, Trash, X } from '@phosphor-icons/react';
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import {
  type IngestionDecision,
  type ObservationCandidate,
} from '@/lib/observationIngestion';
import {
  initialVoiceCaptureState,
  voiceCaptureErrorCopy,
  voiceCaptureReducer,
} from '@/lib/voiceCapture';

type TranscriptionResult = { transcript: string; durationSeconds: number };

export type PrivateVoiceNoteInput = {
  petId: string;
  authorId: string;
  text: string;
  capturedAt: string;
  source: 'voice' | 'text';
};

function recorderMimeType() {
  if (typeof MediaRecorder === 'undefined') return '';
  return ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus']
    .find((type) => MediaRecorder.isTypeSupported(type)) || '';
}

function metricLabel(metric: ObservationCandidate['metric']) {
  if (metric === 'energy') return 'Энергия';
  if (metric === 'appetite') return 'Аппетит';
  if (metric === 'sleep') return 'Сон';
  if (metric === 'mood') return 'Настроение';
  if (metric === 'activity') return 'Активность';
  if (metric === 'stool') return 'Пищеварение';
  if (metric === 'symptom') return 'Самочувствие';
  if (metric === 'behavior_change') return 'Поведение';
  return 'Наблюдение';
}

export function VoiceObservationCapture({
  petId,
  petName,
  authorId,
  onTranscribe,
  onExtract,
  onSave,
  onSavePrivateNote,
}: {
  petId: string;
  petName: string;
  authorId: string;
  onTranscribe: (audio: Blob) => Promise<TranscriptionResult>;
  onExtract: (input: { transcript: string; captureId: string; observedAt: string; source: 'voice' | 'text' }) => Promise<{ candidates: ObservationCandidate[]; decisions: IngestionDecision[] }>;
  onSave: (candidates: ObservationCandidate[]) => Promise<{ decisions?: IngestionDecision[]; summary?: Record<string, number> }>;
  onSavePrivateNote?: (input: PrivateVoiceNoteInput) => Promise<void>;
}) {
  const [state, dispatch] = useReducer(voiceCaptureReducer, initialVoiceCaptureState);
  const [typedText, setTypedText] = useState('');
  const [seconds, setSeconds] = useState(0);
  const [candidates, setCandidates] = useState<ObservationCandidate[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saved, setSaved] = useState(false);
  const [keepPrivateNote, setKeepPrivateNote] = useState(false);
  const [privateNoteSaved, setPrivateNoteSaved] = useState(false);
  const [structuredSaved, setStructuredSaved] = useState(false);
  const [parseStatus, setParseStatus] = useState<'idle' | 'loading' | 'editing' | 'empty' | 'ready'>('idle');
  const [detailsOpen, setDetailsOpen] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<Blob | null>(null);
  const timerRef = useRef<number | null>(null);
  const discardRecordingRef = useRef(false);
  const captureRef = useRef<HTMLElement | null>(null);
  const capturedAtRef = useRef('');
  const autoParsedTranscriptRef = useRef('');

  function clearTimer() {
    if (timerRef.current !== null) window.clearInterval(timerRef.current);
    timerRef.current = null;
  }

  function closeStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  function reset() {
    clearTimer();
    discardRecordingRef.current = true;
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    closeStream();
    recorderRef.current = null;
    audioRef.current = null;
    capturedAtRef.current = '';
    autoParsedTranscriptRef.current = '';
    chunksRef.current = [];
    setCandidates([]);
    setParseStatus('idle');
    setDetailsOpen(false);
    setSeconds(0);
    setSaved(false);
    setKeepPrivateNote(false);
    setPrivateNoteSaved(false);
    setStructuredSaved(false);
    setSaveError('');
    dispatch({ type: 'cancelled' });
  }

  async function transcribe(audio: Blob) {
    dispatch({ type: 'recording_stopped' });
    try {
      const result = await onTranscribe(audio);
      audioRef.current = null;
      dispatch({ type: 'transcription_succeeded', ...result });
    } catch (error) {
      const code = error instanceof Error ? error.message : 'STT_PROVIDER_UNAVAILABLE';
      dispatch({ type: 'transcription_failed', error: code });
    }
  }

  async function startRecording() {
    setSaved(false);
    setCandidates([]);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      dispatch({ type: 'transcription_failed', error: 'MICROPHONE_UNAVAILABLE' });
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = recorderMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      recorderRef.current = recorder;
      discardRecordingRef.current = false;
      chunksRef.current = [];
      recorder.ondataavailable = (event) => { if (event.data.size) chunksRef.current.push(event.data); };
      recorder.onstop = () => {
        clearTimer();
        const audio = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        closeStream();
        if (discardRecordingRef.current) return;
        audioRef.current = audio;
        void transcribe(audio);
      };
      recorder.start(250);
      setSeconds(0);
      dispatch({ type: 'recording_started' });
      timerRef.current = window.setInterval(() => {
        setSeconds((current) => {
          const next = current + 1;
          if (next >= 45 && recorder.state === 'recording') recorder.stop();
          return next;
        });
      }, 1000);
    } catch (error) {
      closeStream();
      const denied = error instanceof DOMException && (error.name === 'NotAllowedError' || error.name === 'SecurityError');
      dispatch({ type: 'transcription_failed', error: denied ? 'MICROPHONE_DENIED' : 'MICROPHONE_UNAVAILABLE' });
    }
  }

  function stopRecording() {
    clearTimer();
    discardRecordingRef.current = false;
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
  }

  function useTypedText() {
    const value = typedText.trim();
    if (!value) return;
    dispatch({ type: 'transcription_succeeded', transcript: value, durationSeconds: 0 });
  }

  const parseTranscript = useCallback(async () => {
    const transcript = state.transcript.trim();
    if (!transcript) return;
    const captureId = crypto.randomUUID();
    const capturedAt = new Date().toISOString();
    capturedAtRef.current = capturedAt;
    autoParsedTranscriptRef.current = transcript;
    setParseStatus('loading');
    setDetailsOpen(false);
    setSaveError('');
    try {
      const extracted = await onExtract({ transcript, captureId, observedAt: capturedAt, source: (state.durationSeconds ?? 0) > 0 ? 'voice' : 'text' });
      setCandidates(extracted.candidates);
      setParseStatus(extracted.candidates.length ? 'ready' : 'empty');
      setDetailsOpen(!extracted.candidates.length);
    } catch {
      setCandidates([]);
      setParseStatus('empty');
      setDetailsOpen(true);
      setSaveError('Не удалось разобрать текст. Проверь связь и попробуй ещё раз — ничего не сохранено.');
    }
  }, [onExtract, state.durationSeconds, state.transcript]);

  useEffect(() => {
    if (state.phase !== 'review' || parseStatus !== 'idle' || !state.transcript.trim()) return;
    if (autoParsedTranscriptRef.current === state.transcript.trim()) return;
    void parseTranscript();
  }, [parseStatus, parseTranscript, state.phase, state.transcript]);

  async function saveReviewedCapture() {
    if ((!candidates.length && !keepPrivateNote) || saving) return;
    setSaving(true);
    setSaveError('');
    try {
      if (candidates.length && !structuredSaved) {
        await onSave(candidates.map((candidate) => ({ ...candidate, confirmed: true })));
        setStructuredSaved(true);
      }
      if (keepPrivateNote && onSavePrivateNote && !privateNoteSaved) {
        try {
          await onSavePrivateNote({
            petId,
            authorId,
            text: state.transcript.trim(),
            capturedAt: capturedAtRef.current || new Date().toISOString(),
            source: (state.durationSeconds ?? 0) > 0 ? 'voice' : 'text',
          });
          setPrivateNoteSaved(true);
        } catch {
          setSaveError(candidates.length
            ? 'Показатели сохранены, но приватная заметка — нет. Расшифровка останется здесь: повтори сохранение заметки.'
            : 'Приватная заметка не сохранилась. Расшифровка останется здесь — проверь связь и повтори.');
          return;
        }
      }
      setSaved(true);
      audioRef.current = null;
    } catch {
      setSaveError('Показатели не сохранились. Проверь связь и повтори — расшифровка останется здесь.');
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => () => {
    clearTimer();
    discardRecordingRef.current = true;
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    closeStream();
  }, []);

  useEffect(() => {
    const shell = captureRef.current?.closest('.phone-shell');
    const active = state.phase !== 'idle' && !saved;
    shell?.classList.toggle('voice-capture-active', active);
    return () => shell?.classList.remove('voice-capture-active');
  }, [saved, state.phase]);

  const savedMetrics = [...new Set(candidates.map((candidate) => metricLabel(candidate.metric).toLocaleLowerCase('ru-RU')))];

  useEffect(() => {
    if (state.phase === 'idle') return;
    const frame = window.requestAnimationFrame(() => captureRef.current?.scrollIntoView({ block: 'nearest' }));
    return () => window.cancelAnimationFrame(frame);
  }, [state.phase]);

  if (saved) {
    return <section ref={captureRef} className="voice-observation-capture is-saved" aria-live="polite">
      <div><h2>{privateNoteSaved && !candidates.length ? 'Заметка сохранена' : 'Наблюдения сохранены'}</h2><p>{candidates.length ? `${savedMetrics.join(', ')} добавлены в историю ${petName}.` : ''}{privateNoteSaved ? `${candidates.length ? ' ' : ''}Исходный текст сохранён как приватная заметка.` : ''}</p></div>
      <button type="button" onClick={reset}>Добавить ещё</button>
    </section>;
  }

  return <section ref={captureRef} className={`voice-observation-capture is-${state.phase}`} aria-labelledby="voice-observation-title">
    <header>
      <div><h2 id="voice-observation-title">{state.phase === 'review' ? 'Проверь наблюдения' : `Как ${petName} сегодня?`}</h2><p>{state.phase === 'review' ? 'Проверь перед сохранением.' : 'Напиши или надиктуй одним сообщением.'}</p></div>
      {state.phase !== 'idle' && <button className="voice-capture-close" type="button" onClick={reset} aria-label="Закрыть голосовой ввод"><X weight="bold" /></button>}
    </header>

    {state.phase === 'idle' && <>
      <div className="voice-capture-input">
        <textarea value={typedText} onChange={(event) => setTypedText(event.target.value)} maxLength={600} placeholder={`${petName} сегодня…`} aria-label={`Рассказать о состоянии ${petName}`} />
        <div><button className="voice-capture-mic" type="button" onClick={startRecording}><Microphone weight="fill" /> Записать голосом</button><button className="voice-capture-send" type="button" disabled={!typedText.trim()} onClick={useTypedText} aria-label="Продолжить с введённым текстом"><PaperPlaneTilt weight="fill" /></button></div>
      </div>
      <p className="voice-capture-privacy">Аудио отправится сервису распознавания и не сохранится в Псё.</p>
    </>}

    {state.phase === 'recording' && <div className="voice-capture-recording">
      <div className="voice-capture-recording-status"><span><i /> Слушаю</span><time>{`00:${String(seconds).padStart(2, '0')}`}</time></div>
      <p>Говори одним сообщением до 45 секунд. Расшифровку можно будет исправить.</p>
      <div className="voice-capture-recording-actions"><button type="button" onClick={reset}><Trash /> Отменить</button><button type="button" onClick={stopRecording}><Stop weight="fill" /> Остановить</button></div>
    </div>}

    {state.phase === 'transcribing' && <div className="voice-capture-progress" role="status" aria-live="polite"><span /><div><b>Расшифровываю запись…</b><p>Данные {petName} ещё не меняются.</p></div></div>}

    {state.phase === 'error' && <div className="voice-capture-error" role="alert">
      <p>{voiceCaptureErrorCopy(state.error || '')}</p>
      <div>{audioRef.current && <button type="button" onClick={() => { dispatch({ type: 'retry_started' }); void transcribe(audioRef.current!); }}>Повторить</button>}<button type="button" onClick={reset}>Продолжить текстом</button></div>
    </div>}

    {state.phase === 'review' && <div className="voice-capture-review">
      {parseStatus === 'loading' && <div className="voice-capture-progress voice-capture-analysis" role="status" aria-live="polite"><span /><div><b>Выделяю важное…</b><p>Ищу только явно названные изменения.</p></div></div>}

      {parseStatus === 'ready' && candidates.length > 0 && <div className="voice-capture-result">
        <header><div><h3>Что сохранится</h3><p>Проверь, что Псё поняло верно.</p></div></header>
        <div className="voice-capture-summary-facts">
          {candidates.map((candidate) => <article key={candidate.id}><span>{metricLabel(candidate.metric)}</span><b>{candidate.value}</b></article>)}
        </div>
        {saveError && <p className="voice-capture-save-error" role="alert">{saveError}</p>}
        <button className="voice-capture-primary" type="button" disabled={saving} onClick={saveReviewedCapture}>{saving ? 'Сохраняю…' : structuredSaved && keepPrivateNote ? 'Сохранить заметку' : 'Сохранить в наблюдения'}</button>
        <button className="voice-capture-details-toggle" type="button" aria-expanded={detailsOpen} onClick={() => setDetailsOpen((open) => !open)}><span>Проверить и изменить</span><CaretDown weight="bold" /></button>
      </div>}

      {parseStatus === 'empty' && <div className="voice-capture-empty" role="status"><b>Не нашла конкретных изменений</b><p>Уточни, что изменилось — например, аппетит, энергия, настроение или сон. Ничего не сохранено.</p></div>}

      {detailsOpen && (parseStatus === 'ready' || parseStatus === 'editing' || parseStatus === 'empty') && <div className="voice-capture-details">
        <label>Проверь расшифровку<textarea value={state.transcript} onChange={(event) => { setCandidates([]); setParseStatus('editing'); setKeepPrivateNote(false); setStructuredSaved(false); setPrivateNoteSaved(false); dispatch({ type: 'transcript_changed', transcript: event.target.value }); }} maxLength={600} disabled={structuredSaved} /></label>
        {parseStatus === 'editing' && <button className="voice-capture-primary" type="button" disabled={!state.transcript.trim()} onClick={() => void parseTranscript()}>Обновить результат</button>}
        {parseStatus === 'ready' && candidates.length > 0 && <div className="voice-capture-facts">
          {candidates.map((candidate) => <article key={candidate.id}>
            <div><b>{metricLabel(candidate.metric)}</b><label><span className="sr-only">Значение показателя {metricLabel(candidate.metric)}</span><input value={candidate.value} maxLength={120} disabled={structuredSaved} onChange={(event) => setCandidates((current) => current.map((item) => item.id === candidate.id ? { ...item, value: event.target.value } : item))} /></label><small>«{candidate.transcriptSpan}»</small></div>
            <button type="button" disabled={structuredSaved} onClick={() => setCandidates((current) => { const next = current.filter((item) => item.id !== candidate.id); if (!next.length) setParseStatus('editing'); return next; })}>Убрать</button>
          </article>)}
        </div>}
        <div className="voice-capture-trust"><span>{state.durationSeconds ? 'Аудио не сохраняется в Псё' : 'Введено текстом'}</span><b>Запись появится только после подтверждения</b></div>
        {onSavePrivateNote && parseStatus !== 'editing' && <label className="voice-capture-note-choice">
          <input type="checkbox" checked={keepPrivateNote} disabled={structuredSaved} onChange={(event) => setKeepPrivateNote(event.target.checked)} />
          <span><b>Сохранить ещё и приватную заметку</b><small>Полный текст будет виден только владельцу.</small></span>
        </label>}
        {parseStatus === 'empty' && keepPrivateNote && <button className="voice-capture-primary" type="button" disabled={saving} onClick={saveReviewedCapture}>{saving ? 'Сохраняю…' : 'Сохранить приватную заметку'}</button>}
      </div>}
    </div>}
  </section>;
}
