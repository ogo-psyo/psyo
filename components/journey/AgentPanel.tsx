"use client";
import {isAgentWalk,type AgentWalk} from "@/lib/agentWalk";
import {isMapSearchPlace,type MapSearchPlace} from "@/lib/mapSearchPlace";
import { useEffect, useRef, useState } from "react";
import { AgentAuxiliaryDialog } from "./ProductionAssistantSheet";
import surface from "./AssistantSurface.module.css";
import { AgentObservationDraft } from "./AgentObservationDraft";
import type { ReviewedObservation, AgentObservationRecord } from "@/lib/agentObservation";

export type AgentResult = {
  observationDraftId?: string;
  places?:MapSearchPlace[];
  walk?:AgentWalk;
  savedWalks?:Array<{id:string;title:string}>;
  answer: string;
  threadId: string;
  runId: string;
  provider?: "openai" | "groq";
  sources?: Array<{ url: string; title: string }>;
};
type Saved = { id: string; title: string; content: string };
type Memory = { id: string; memory_key: string; content: string; updated_at?:string; source_run_id?:string|null };

export function AgentPanel({
  petId,
  runId,
  headers,
  onResult,
  onBusy,
  onRetry,
  observationEdits, onObservationSaved, onOpenObservation, onOpenPlace, onOpenWalk, onOpenSavedWalk,
}: {
  onOpenSavedWalk?:(id:string)=>Promise<'missing'|'failed'|void>;
  onOpenWalk?:(walk:AgentWalk)=>void;
  onOpenPlace?:(place:MapSearchPlace,places:MapSearchPlace[])=>void;
  observationEdits?: Map<string,ReviewedObservation>;
  onObservationSaved?: (record:AgentObservationRecord)=>void;
  onOpenObservation?: (record:AgentObservationRecord,trigger:HTMLButtonElement)=>void;
  petId: string;
  runId: string;
  headers: () => Record<string, string>;
  onResult: (result: AgentResult) => void;
  onBusy: (busy: boolean) => void;
  onRetry: (question: string) => void;
}) {
  const [fallbackEdits]=useState(()=>new Map<string,ReviewedObservation>());
  const [enabled, setEnabled] = useState(false);
  const [active, setActive] = useState("");
  const [status, setStatus] = useState("");
  const [failedQuestion, setFailedQuestion] = useState("");
  const [result, setResult] = useState<AgentResult | null>(null);
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState<Saved[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [memoryKey, setMemoryKey] = useState("");
  const [memoryText, setMemoryText] = useState("");
  const [writing, setWriting] = useState(false);
  const [paneTrigger,setPaneTrigger]=useState<HTMLElement|null>(null);
  const [pane,setPane]=useState<'saved'|'memory'|null>(null);
  const [reading,setReading]=useState(false),[readError,setReadError]=useState('');
  const [editing,setEditing]=useState(false),[editingExisting,setEditingExisting]=useState(false);
  const editor=useRef<HTMLTextAreaElement>(null),readEpoch=useRef(0);
  useEffect(()=>()=>{readEpoch.current++;},[]);
  useEffect(()=>{if(editing&&pane==='memory')editor.current?.focus();},[editing,pane]);
  const callbacks = useRef({ headers, onResult, onBusy });
  useEffect(() => {
    callbacks.current = { headers, onResult, onBusy };
  });
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/agent/runs?petId=${encodeURIComponent(petId)}`, {
      headers: callbacks.current.headers(),
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) return;
        const body = await response.json();
        if (controller.signal.aborted) return;
        setEnabled(body.enabled === true);
        if (!runId && body.latest?.id) setActive(body.latest.id);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [petId, runId]);
  useEffect(() => {
    if (runId) {
      setEnabled(true);
      setResult(null);
      setStatus("queued");
      setActive(runId);
    }
  }, [runId]);
  useEffect(() => {
    if (!active) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    async function poll() {
      try {
        const response = await fetch(`/api/agent/runs/${active}`, {
          headers: callbacks.current.headers(),
          signal: controller.signal,
        });
        if ([401, 404].includes(response.status)) {
          setStatus("unavailable");
          callbacks.current.onBusy(false);
          setNote("Это задание недоступно.");
          return;
        }
        if (!response.ok) throw new Error("FETCH_FAILED");
        const body = await response.json();
        if (stopped) return;
        setStatus(body.status);
        setFailedQuestion(body.question ?? "");
        const busy = body.status === "queued" || body.status === "running";
        callbacks.current.onBusy(busy);
        if (body.status === "succeeded" && body.result) {
          setResult(body.result);
          callbacks.current.onResult(body.result);
          setNote("");
        } else if (body.status === "failed")
          setNote(
            "Не удалось закончить ответ. Вопрос сохранён; можно повторить запрос.",
          );
        else if (body.status === "cancelled") setNote("Задание остановлено.");
        else {
          setNote(
            "Псё ищет и проверяет. Можно закрыть это окно — задание сохранено.",
          );
          timer = setTimeout(poll, 2000);
        }
      } catch {
        if (stopped) return;
        setNote("Связь прервалась. Проверяю состояние задания…");
        timer = setTimeout(poll, 5000);
      }
    }
    void poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, [active]);

  async function api(path: string, method = "GET", body?: unknown) {
    const response = await fetch(path, {
      method,
      headers: {
        ...callbacks.current.headers(),
        "Content-Type": "application/json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!response.ok) throw new Error("REQUEST_FAILED");
    return response.json();
  }
  async function act(action: () => Promise<void>, failure="Не удалось сохранить изменение. Попробуй ещё раз.") {
    if(writing)return;
    setWriting(true);
    setNote("");
    try {
      await action();
    } catch {
      setNote(failure);
    } finally {
      setWriting(false);
    }
  }
  async function openPane(next:'saved'|'memory',trigger?:HTMLElement) {
    if(trigger)setPaneTrigger(trigger);
    const epoch=++readEpoch.current;
    setPane(next);setReading(true);setReadError('');setNote('');
    try {
      const body=await api(`/api/agent/${next==='saved'?'results':'memory'}?petId=${encodeURIComponent(petId)}`);
      if(epoch!==readEpoch.current)return;
      if(next==='saved')setSaved(body.results??[]);else setMemories(body.memories??[]);
    } catch {if(epoch===readEpoch.current)setReadError('Не удалось загрузить. Попробуйте ещё раз.');}
    finally {if(epoch===readEpoch.current)setReading(false);}
  }
  function closePane(){readEpoch.current++;setPane(null);}
  if (!enabled) return null;
  return (
    <section className="pso-agent-panel" aria-label="Результаты и память Псё">
      <p role="status" className={surface.status}>{pane?'':note}</p>
      {status === "failed" && failedQuestion && (
        <button type="button" onClick={() => onRetry(failedQuestion)}>
          Повторить запрос
        </button>
      )}
      {(status === "queued" || status === "running") && (
        <button
          type="button"
          disabled={writing}
          onClick={() =>
            void act(async () => {
              await api(`/api/agent/runs/${active}`, "DELETE");
              setStatus("cancelled");
              callbacks.current.onBusy(false);
              setNote("Запрошена остановка задания.");
            },"Не удалось остановить задание. Повторите попытку.")
          }
        >
          Остановить
        </button>
      )}
      {result?.observationDraftId && result.runId===active && status==='succeeded' && onOpenObservation && onObservationSaved &&
        <AgentObservationDraft key={result.observationDraftId} id={result.observationDraftId} petId={petId}
          headers={headers} edits={observationEdits??fallbackEdits} onSaved={onObservationSaved} onOpen={onOpenObservation}/>}
      {status==='succeeded'&&result?.runId===active&&onOpenSavedWalk&&Array.isArray(result.savedWalks)&&result.savedWalks.map(route=>typeof route?.id==='string'&&typeof route?.title==='string'?<div className={surface.places} key={route.id}>
        <h3 data-assistant-heading>{route.title}</h3>
        <button type="button" disabled={writing} onClick={()=>void act(async()=>{const error=await onOpenSavedWalk(route.id);if(error)setNote(error==='missing'?'Эта прогулка удалена или больше недоступна.':'Не удалось загрузить прогулку. Попробуйте ещё раз.');},'Не удалось загрузить прогулку. Попробуйте ещё раз.')}>Открыть сохранённую прогулку</button>
      </div>:null)}
      {status==='succeeded'&&result?.runId===active&&onOpenWalk&&isAgentWalk(result.walk)&&<section className={surface.places} aria-label="Рассчитанная прогулка">
        <h3 data-assistant-heading>{result.walk.title}</h3>
        <p>{(result.walk.distanceMeters/1000).toLocaleString('ru-RU',{maximumFractionDigits:1})} км · ≈ {result.walk.estimatedMinutes} мин без остановок</p>
        <p>Это рассчитанный путь, ещё не сохранённый. Доступ с собакой не проверен.</p>
        <button type="button" onClick={()=>onOpenWalk(result.walk!)}>Посмотреть прогулку</button>
      </section>}
      {status==='succeeded'&&result?.runId===active&&onOpenPlace&&result.places?.some(isMapSearchPlace)&&<section className={surface.places} aria-label="Найденные места">
        <h3 data-assistant-heading>Места на карте</h3>
        <p>Доступ с собакой и условия пока не проверены.</p>
        {result.places.filter(isMapSearchPlace).map(place=><article key={place.id}><h4>{place.title}</h4><p>{place.detail}</p><button type="button" onClick={()=>onOpenPlace(place,result.places!.filter(isMapSearchPlace))}>Показать на карте</button></article>)}
      </section>}
      {result?.sources?.length ? (
        <details>
          <summary>Источники ответа</summary>
          <ul>
            {result.sources.map((source) => (
              <li key={source.url}>
                <a href={source.url} target="_blank" rel="noopener noreferrer">
                  {source.title}
                </a>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      {result && status === "succeeded" && (
        <button
          type="button"
          disabled={writing}
          onClick={() =>
            void act(async () => {
              await api("/api/agent/results", "POST", { runId: result.runId });
              setNote("Результат сохранён.");
            })
          }
        >
          Сохранить ответ
        </button>
      )}
      <div className={surface.tools}>
        <button type="button" disabled={writing} onClick={event=>void openPane('saved',event.currentTarget)}>Сохранённые ответы</button>
        <button type="button" disabled={writing} onClick={event=>void openPane('memory',event.currentTarget)}>Что Псё помнит</button>
      </div>
      {pane&&<AgentAuxiliaryDialog title={pane==='saved'?'Сохранённые ответы':'Что Псё помнит'} onClose={closePane} returnFocusTo={paneTrigger}>
        <div className={surface.library}>
        {reading&&<p role="status">Загружаю…</p>}
        {readError&&<div><p role="alert">{readError}</p><button type="button" onClick={()=>void openPane(pane)}>Повторить загрузку</button></div>}
        {note&&<p role="status">{note}</p>}
        {!reading&&!readError&&pane==='saved'&&(saved.length?saved.map(item=><details key={item.id}><summary>{item.title}</summary><p className={surface.savedText}>{item.content}</p></details>):<p>Пока нет сохранённых ответов.</p>)}
        {!reading&&!readError&&pane==='memory'&&<>
        <p>
          Сведения для следующих ответов. Профиль собаки редактируется отдельно.
        </p>
        {!memories.length&&<p>Пока нет сохранённых сведений.</p>}
        {memories.map((memory) => (
          <div key={memory.id}>
            <p>
              <b>{memory.memory_key}</b> — {memory.content}
            </p>
            <small>{memory.source_run_id?'Из разговора':'Без ссылки на разговор'}{memory.updated_at&&Number.isFinite(Date.parse(memory.updated_at))?` · ${new Date(memory.updated_at).toLocaleDateString('ru-RU')}`:''}</small>
            <button
              type="button" disabled={writing}
              onClick={() => {
                setMemoryKey(memory.memory_key);
                setMemoryText(memory.content);setEditingExisting(true);setEditing(true);
                requestAnimationFrame(()=>editor.current?.focus());
              }}
            >
              Изменить
            </button>
            <button
              type="button"
              disabled={writing}
              onClick={() =>
                void act(async () => {
                  await api("/api/agent/memory", "DELETE", {
                    petId,
                    key: memory.memory_key,
                  });
                  setMemories((current) =>
                    current.filter((item) => item.id !== memory.id),
                  );
                  if(memoryKey===memory.memory_key){setMemoryKey('');setMemoryText('');setEditing(false);setEditingExisting(false);}
                  setNote(
                    "Убрано из памяти. Предыдущий диалог больше не используется для новых ответов.",
                  );
                })
              }
            >
              Забыть
            </button>
          </div>
        ))}
        {!editing&&<button type="button" disabled={writing} onClick={()=>setEditing(true)}>{memoryText||memoryKey?'Продолжить редактирование':'Добавить сведение'}</button>}
        {editing&&<form
          onSubmit={(event) => {
            event.preventDefault();
            void act(async () => {
              const data = await api("/api/agent/memory", "POST", {
                petId,
                key: memoryKey,
                content: memoryText,
              });
              setMemories((current) => [
                data.memory,
                ...current.filter((item) => item.memory_key !== memoryKey),
              ]);
              setMemoryKey("");
              setMemoryText("");setEditing(false);setEditingExisting(false);
              setNote("Память обновлена.");
            });
          }}
        >
          <fieldset disabled={writing}>
          <label>
            О чём запомнить
            <input
              required
              readOnly={editingExisting}
              maxLength={120}
              value={memoryKey}
              onChange={(event) => setMemoryKey(event.target.value)}
            />
          </label>
          <label>
            Что важно
            <textarea ref={editor}
              required
              maxLength={2000}
              value={memoryText}
              onChange={(event) => setMemoryText(event.target.value)}
            />
          </label>
          <button type="submit" disabled={writing}>
            Запомнить
          </button>
          <button type="button" disabled={writing} onClick={()=>setEditing(false)}>Закрыть редактирование</button>
          </fieldset>
        </form>}
        </>}
        </div>
      </AgentAuxiliaryDialog>}
    </section>
  );
}
