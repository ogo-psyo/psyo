'use client';

import { Microphone, PaperPlaneTilt, Stop, Trash, X } from '@phosphor-icons/react';
import { useEffect, useReducer, useRef, useState } from 'react';
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

const operationLabels: Record<IngestionDecision['operation'], string> = {
  create: 'Новая запись', update: 'Обновит запись', merge: 'Объединит с записью', conflict: 'Нужно уточнить', noop: 'Не сохранится',
};

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
  const [parseStatus, setParseStatus] = useState<'idle' | 'loading' | 'empty' | 'ready'>('idle');
  const [decisions, setDecisions] = useState<IngestionDecision[]>([]);
  const [savedDecisions, setSavedDecisions] = useState<IngestionDecision[]>([]);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<Blob | null>(null);
  const timerRef = useRef<number | null>(null);
  const discardRecordingRef = useRef(false);
  const captureRef = useRef<HTMLElement | null>(null);
  const capturedAtRef = useRef('');

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
    chunksRef.current = [];
    setCandidates([]);
    setDecisions([]);
    setSavedDecisions([]);
    setParseStatus('idle');
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

  async function parseTranscript() {
    const captureId = crypto.randomUUID();
    const capturedAt = new Date().toISOString();
    capturedAtRef.current = capturedAt;
    setParseStatus('loading');
    setSaveError('');
    try {
      const extracted = await onExtract({ transcript: state.transcript, captureId, observedAt: capturedAt, source: (state.durationSeconds ?? 0) > 0 ? 'voice' : 'text' });
      setCandidates(extracted.candidates);
      setDecisions(extracted.decisions || []);
      setParseStatus(extracted.candidates.length ? 'ready' : 'empty');
    } catch {
      setCandidates([]);
      setDecisions([]);
      setParseStatus('empty');
      setSaveError('Не удалось разобрать текст. Проверь связь и попробуй ещё раз — ничего не сохранено.');
    }
  }

  async function saveReviewedCapture() {
    if ((!candidates.length && !keepPrivateNote) || saving) return;
    setSaving(true);
    setSaveError('');
    try {
      if (candidates.length && !structuredSaved) {
        const result = await onSave(candidates.map((candidate) => ({ ...candidate, confirmed: true })));
        setSavedDecisions(result.decisions || []);
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

  if (saved) {
    return <section ref={captureRef} className="voice-observation-capture is-saved" aria-live="polite">
      <div><h2>{privateNoteSaved && !candidates.length ? 'Заметка сохранена' : 'Контекст обновлён'}</h2><p>{candidates.length ? `${savedDecisions.length ? savedDecisions.map((item) => operationLabels[item.operation]).join(' · ') : 'Сохранены подтверждённые показатели'}.` : ''}{privateNoteSaved ? `${candidates.length ? ' ' : ''}Исходный текст сохранён как приватная заметка.` : `${candidates.length ? ' ' : ''}Отдельная заметка не создана.`}</p></div>
      <button type="button" onClick={reset}>Добавить ещё</button>
    </section>;
  }

  return <section ref={captureRef} className={`voice-observation-capture is-${state.phase}`} aria-labelledby="voice-observation-title">
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
      <label>Проверь расшифровку<textarea value={state.transcript} onChange={(event) => { setCandidates([]); setDecisions([]); setParseStatus('idle'); setKeepPrivateNote(false); setStructuredSaved(false); setPrivateNoteSaved(false); dispatch({ type: 'transcript_changed', transcript: event.target.value }); }} maxLength={600} disabled={structuredSaved} /></label>
      <div className="voice-capture-trust"><span>{state.durationSeconds ? 'Аудио не сохраняется в Псё' : 'Введено текстом'}</span><b>Сохранение только после подтверждения</b></div>
      {!candidates.length && <button className="voice-capture-primary" type="button" disabled={!state.transcript.trim() || parseStatus === 'loading'} onClick={() => void parseTranscript()}>{parseStatus === 'loading' ? 'Разбираю…' : parseStatus === 'empty' ? 'Разобрать ещё раз' : 'Разобрать на показатели'}</button>}
      {parseStatus === 'empty' && <div className="voice-capture-empty" role="status"><b>Показатели не найдены</b><p>Уточни, что изменилось: например, аппетит, энергия, настроение, сон или самочувствие. Ничего не сохранено.</p></div>}
      {candidates.length > 0 && <div className="voice-capture-facts">
        <div className="voice-capture-facts-head"><b>Псё выделило {candidates.length === 1 ? 'один показатель' : `${candidates.length} показателя`}</b><span>{keepPrivateNote ? '1 приватная заметка' : 'Без заметки'}</span></div>
        {candidates.map((candidate) => <article key={candidate.id}>
          <div><b>{metricLabel(candidate.metric)}</b><label><span className="sr-only">Значение показателя {metricLabel(candidate.metric)}</span><input value={candidate.value} maxLength={120} disabled={structuredSaved} onChange={(event) => setCandidates((current) => current.map((item) => item.id === candidate.id ? { ...item, value: event.target.value } : item))} /></label><small>{operationLabels[decisions.find((item) => item.candidateId === candidate.id)?.operation || 'create']} · {candidate.source === 'voice' ? 'из голосовой записи' : 'введено текстом'} · «{candidate.transcriptSpan}»</small></div>
          <button type="button" disabled={structuredSaved} onClick={() => setCandidates((current) => current.filter((item) => item.id !== candidate.id))}>Убрать</button>
        </article>)}
      </div>}
      {(parseStatus === 'ready' || parseStatus === 'empty') && onSavePrivateNote && <label className="voice-capture-note-choice">
        <input type="checkbox" checked={keepPrivateNote} disabled={structuredSaved} onChange={(event) => setKeepPrivateNote(event.target.checked)} />
        <span><b>Сохранить ещё и приватную заметку</b><small>Псё сохранит проверенный текст целиком. Заметка будет видна только владельцу.</small></span>
      </label>}
      {(parseStatus === 'ready' || parseStatus === 'empty') && (candidates.length > 0 || keepPrivateNote) && <div className="voice-capture-save-review">
        <p><b>Будет сохранено:</b> {candidates.length ? `${candidates.length} ${candidates.length === 1 ? 'показатель' : 'показателя'}` : 'без показателей'}{keepPrivateNote ? ' и 1 приватная заметка с исходным текстом' : ', без отдельной заметки'}.</p>
        {saveError && <p className="voice-capture-save-error" role="alert">{saveError}</p>}
        <button className="voice-capture-primary" type="button" disabled={saving} onClick={saveReviewedCapture}>{saving ? 'Сохраняю…' : structuredSaved && keepPrivateNote ? 'Повторить сохранение заметки' : 'Подтвердить и сохранить'}</button>
      </div>}
      {parseStatus === 'idle' && candidates.length === 0 && state.transcript.trim() && <p className="voice-capture-footnote">Сначала проверь текст. Псё сохранит только выбранные показатели.</p>}
    </div>}
  </section>;
}
