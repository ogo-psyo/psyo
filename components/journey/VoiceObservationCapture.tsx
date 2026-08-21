'use client';

import { Microphone, PaperPlaneTilt, Stop, Trash, X } from '@phosphor-icons/react';
import { useEffect, useReducer, useRef, useState } from 'react';
import {
  extractObservationCandidates,
  type ObservationCandidate,
} from '@/lib/observationIngestion';
import {
  initialVoiceCaptureState,
  voiceCaptureErrorCopy,
  voiceCaptureReducer,
} from '@/lib/voiceCapture';

type TranscriptionResult = { transcript: string; durationSeconds: number };

function recorderMimeType() {
  if (typeof MediaRecorder === 'undefined') return '';
  return ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus']
    .find((type) => MediaRecorder.isTypeSupported(type)) || '';
}

function metricLabel(metric: ObservationCandidate['metric']) {
  if (metric === 'energy') return 'Энергия';
  if (metric === 'appetite') return 'Аппетит';
  if (metric === 'sleep') return 'Сон';
  return 'Наблюдение';
}

export function VoiceObservationCapture({
  petId,
  petName,
  authorId,
  onTranscribe,
  onSave,
}: {
  petId: string;
  petName: string;
  authorId: string;
  onTranscribe: (audio: Blob) => Promise<TranscriptionResult>;
  onSave: (candidates: ObservationCandidate[]) => Promise<void>;
}) {
  const [state, dispatch] = useReducer(voiceCaptureReducer, initialVoiceCaptureState);
  const [typedText, setTypedText] = useState('');
  const [seconds, setSeconds] = useState(0);
  const [candidates, setCandidates] = useState<ObservationCandidate[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saved, setSaved] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<Blob | null>(null);
  const timerRef = useRef<number | null>(null);
  const discardRecordingRef = useRef(false);

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
    chunksRef.current = [];
    setCandidates([]);
    setSeconds(0);
    setSaved(false);
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

  function parseTranscript() {
    const captureId = crypto.randomUUID();
    const extracted = extractObservationCandidates({
      transcript: state.transcript,
      captureId,
      petId,
      authorId,
      observedAt: new Date().toISOString(),
    });
    setCandidates(extracted);
  }

  async function saveCandidates() {
    if (!candidates.length || saving) return;
    setSaving(true);
    setSaveError('');
    try {
      await onSave(candidates.map((candidate) => ({ ...candidate, confirmed: true })));
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

  if (saved) {
    return <section className="voice-observation-capture is-saved" aria-live="polite">
      <div><h2>Контекст обновлён</h2><p>Сохранены только подтверждённые показатели. Отдельная заметка не создана.</p></div>
      <button type="button" onClick={reset}>Добавить ещё</button>
    </section>;
  }

  return <section className={`voice-observation-capture is-${state.phase}`} aria-labelledby="voice-observation-title">
    <header>
      <div><h2 id="voice-observation-title">Что изменилось у {petName}?</h2><p>Скажи свободно. Псё выделит показатели и ничего не сохранит без проверки.</p></div>
      {state.phase !== 'idle' && <button className="voice-capture-close" type="button" onClick={reset} aria-label="Закрыть голосовой ввод"><X weight="bold" /></button>}
    </header>

    {state.phase === 'idle' && <>
      <div className="voice-capture-input">
        <textarea value={typedText} onChange={(event) => setTypedText(event.target.value)} maxLength={600} placeholder={`${petName} сегодня…`} aria-label={`Что изменилось у ${petName}`} />
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
      <label>Проверь расшифровку<textarea value={state.transcript} onChange={(event) => { setCandidates([]); dispatch({ type: 'transcript_changed', transcript: event.target.value }); }} maxLength={600} /></label>
      <div className="voice-capture-trust"><span>{state.durationSeconds ? 'Аудио не сохраняется в Псё' : 'Введено текстом'}</span><b>Не заметка</b></div>
      {!candidates.length && <button className="voice-capture-primary" type="button" disabled={!state.transcript.trim()} onClick={parseTranscript}>Разобрать на показатели</button>}
      {candidates.length > 0 && <div className="voice-capture-facts">
        <div className="voice-capture-facts-head"><b>Псё выделило {candidates.length === 1 ? 'один показатель' : `${candidates.length} показателя`}</b><span>0 заметок</span></div>
        {candidates.map((candidate) => <article key={candidate.id}>
          <div><b>{metricLabel(candidate.metric)}</b><p>{candidate.value}</p><small>Из фразы «{candidate.transcriptSpan}»</small></div>
          <button type="button" onClick={() => setCandidates((current) => current.filter((item) => item.id !== candidate.id))}>Убрать</button>
        </article>)}
        {saveError && <p className="voice-capture-save-error" role="alert">{saveError}</p>}
        <button className="voice-capture-primary" type="button" disabled={saving} onClick={saveCandidates}>{saving ? 'Сохраняю…' : `Сохранить ${candidates.length === 1 ? 'показатель' : `${candidates.length} показателя`}`}</button>
      </div>}
      {candidates.length === 0 && state.transcript.trim() && <p className="voice-capture-footnote">Если показателей нет, Псё ничего не сохранит.</p>}
    </div>}
  </section>;
}
