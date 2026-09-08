"use client";
import { useEffect, useRef, useState } from "react";

export type AgentResult = {
  answer: string;
  threadId: string;
  runId: string;
  provider?: "openai" | "groq";
  sources?: Array<{ url: string; title: string }>;
};
type Saved = { id: string; title: string; content: string };
type Memory = { id: string; memory_key: string; content: string };

export function AgentPanel({
  petId,
  runId,
  headers,
  onResult,
  onBusy,
  onRetry,
}: {
  petId: string;
  runId: string;
  headers: () => Record<string, string>;
  onResult: (result: AgentResult) => void;
  onBusy: (busy: boolean) => void;
  onRetry: (question: string) => void;
}) {
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
          setNote("Ответ готов.");
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
  async function act(action: () => Promise<void>) {
    setWriting(true);
    setNote("");
    try {
      await action();
    } catch {
      setNote("Не удалось сохранить изменение. Попробуй ещё раз.");
    } finally {
      setWriting(false);
    }
  }
  if (!enabled) return null;
  return (
    <section className="pso-agent-panel" aria-label="Результаты и память Псё">
      <p role="status">{note}</p>
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
            })
          }
        >
          Остановить
        </button>
      )}
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
      <details
        onToggle={(event) => {
          if (event.currentTarget.open)
            void act(async () => {
              const data = await api(`/api/agent/results?petId=${petId}`);
              setSaved(data.results ?? []);
            });
        }}
      >
        <summary>Сохранённые ответы</summary>
        {saved.length ? (
          saved.map((item) => (
            <details key={item.id}>
              <summary>{item.title}</summary>
              <p style={{ whiteSpace: "pre-wrap" }}>{item.content}</p>
            </details>
          ))
        ) : (
          <p>Пока нет сохранённых ответов.</p>
        )}
      </details>
      <details
        onToggle={(event) => {
          if (event.currentTarget.open)
            void act(async () => {
              const data = await api(`/api/agent/memory?petId=${petId}`);
              setMemories(data.memories ?? []);
            });
        }}
      >
        <summary>Что Псё помнит</summary>
        <p>
          Сведения для следующих ответов. Профиль собаки редактируется отдельно.
        </p>
        {memories.map((memory) => (
          <div key={memory.id}>
            <p>
              <b>{memory.memory_key}</b> — {memory.content}
            </p>
            <button
              type="button"
              onClick={() => {
                setMemoryKey(memory.memory_key);
                setMemoryText(memory.content);
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
        <form
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
              setMemoryText("");
              setNote("Память обновлена.");
            });
          }}
        >
          <label>
            О чём запомнить
            <input
              required
              maxLength={120}
              value={memoryKey}
              onChange={(event) => setMemoryKey(event.target.value)}
            />
          </label>
          <label>
            Что важно
            <textarea
              required
              maxLength={2000}
              value={memoryText}
              onChange={(event) => setMemoryText(event.target.value)}
            />
          </label>
          <button type="submit" disabled={writing}>
            Запомнить
          </button>
        </form>
      </details>
    </section>
  );
}
