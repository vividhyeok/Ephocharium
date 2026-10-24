import { useEffect, useRef, useState } from "react";
import type { World } from "../engine";
import { analyzeWorld } from "./analysis";
import { readSSE } from "./sse";
import {
  emptyConversation,
  loadConversation,
  saveConversation,
  trimConversation,
  historyForRequest,
  errorMessages,
  type Conversation,
  type ChatMessage,
} from "./conversation";
export default function EpiPanel({
  world: w,
  selected,
  onClose,
  onNation,
  prompt,
}: {
  world: World;
  selected: number;
  onClose: () => void;
  onNation: (id: number) => void;
  prompt: string;
}) {
  const key = w.worldId || "legacy:" + w.seed + ":" + w.width;
  const [chat, setChat] = useState<Conversation>(() => loadConversation(key)),
    [question, setQuestion] = useState(prompt),
    [busy, setBusy] = useState(false),
    [status, setStatus] = useState<{
      enabled: boolean;
      configured: boolean;
    } | null>(null),
    [access, setAccess] = useState(() => {
      try {
        return sessionStorage.getItem("epi-access") || "";
      } catch {
        return "";
      }
    }),
    [saveFailed, setSaveFailed] = useState(false);
  const chatRef = useRef(chat),
    controller = useRef<AbortController | null>(null),
    end = useRef<HTMLDivElement>(null),
    scroller = useRef<HTMLDivElement>(null),
    follow = useRef(true),
    world = useRef(w),
    lastRequest = useRef("");
  world.current = w;
  chatRef.current = chat;
  useEffect(() => {
    const c = new AbortController();
    fetch("/api/epi", { signal: c.signal })
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus(null));
    return () => {
      c.abort();
      const pending = controller.current;
      pending?.abort();
      const saved = chatRef.current;
      saveConversation(key, {
        ...saved,
        messages: saved.messages.map((m, i) =>
          pending && i === saved.messages.length - 1 && m.role === "assistant"
            ? { ...m, state: "stopped", error: "cancelled" }
            : m,
        ),
      });
    };
  }, []);
  useEffect(() => {
    if (prompt) setQuestion(prompt);
  }, [prompt]);
  useEffect(() => {
    if (follow.current) end.current?.scrollIntoView({ block: "nearest" });
    const timer = setTimeout(
      () => setSaveFailed(!saveConversation(key, chat)),
      250,
    );
    return () => clearTimeout(timer);
  }, [chat, key]);
  function update(id: string, part: Partial<ChatMessage>) {
    setChat((old) => ({
      ...old,
      messages: old.messages.map((m) => (m.id === id ? { ...m, ...part } : m)),
    }));
  }
  async function send(value = question) {
    if (busy || !value.trim()) return;
    const q = value.trim().slice(0, 1200),
      snapshot = world.current,
      year = snapshot.year,
      id = crypto.randomUUID(),
      requestId = crypto.randomUUID(),
      previous = chatRef.current;
    const context = analyzeWorld(
      snapshot,
      q,
      selected,
      previous.messages
        .filter((m) => m.role === "user")
        .slice(-2)
        .map((m) => m.content)
        .join(" "),
    );
    const c = new AbortController();
    controller.current = c;
    lastRequest.current = q;
    setBusy(true);
    setQuestion("");
    follow.current = true;
    const user: ChatMessage = { id: requestId, role: "user", content: q, year },
      answer: ChatMessage = { id, role: "assistant", content: "", year };
    setChat(
      trimConversation({
        ...previous,
        messages: [...previous.messages, user, answer],
      }),
    );
    const timeout = setTimeout(() => c.abort("timeout"), 50000);
    let content = "",
      done = false;
    try {
      const payload = {
        requestId,
        worldId: key,
        question: q,
        summary: previous.summary,
        messages: historyForRequest(previous),
        context,
      };
      if (new TextEncoder().encode(JSON.stringify(payload)).length > 90000)
        payload.messages = payload.messages
          .slice(-12)
          .map((m) => ({ ...m, content: m.content.slice(0, 800) }));
      const response = await fetch("/api/epi", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Epi-Access": access },
        body: JSON.stringify(payload),
        signal: c.signal,
      });
      if (!response.ok) {
        const e = await response
          .json()
          .catch(() => ({ error: "connection_closed" }));
        throw Error(e.error || "connection_closed");
      }
      if (!response.body) throw Error("connection_closed");
      for await (const data of readSSE(response.body, c.signal)) {
        let event: any;
        try {
          event = JSON.parse(data);
        } catch {
          throw Error("parse");
        }
        if (event.type === "delta" && typeof event.text === "string") {
          content += event.text;
          if (content.length > 6000) throw Error("response_limit");
          update(id, { content });
        }
        if (event.type === "error") throw Error(event.code);
        if (event.type === "done") done = true;
      }
      if (!done) throw Error("stream_interrupted");
      update(id, { state: "done" });
    } catch (e) {
      const code = c.signal.aborted
        ? c.signal.reason === "timeout"
          ? "timeout"
          : "cancelled"
        : e instanceof Error
          ? e.message
          : "connection_closed";
      update(id, {
        content,
        state: code === "cancelled" ? "stopped" : "error",
        error: code,
      });
    } finally {
      clearTimeout(timeout);
      setBusy(false);
      controller.current = null;
    }
  }
  function linked(text: string) {
    return text.split(/(\[[^\]\n]{1,150}\]\(nation:\d+\))/g).map((part, i) => {
      const link = part.match(/^\[([^\]]+)\]\(nation:(\d+)\)$/),
        nation = link && w.nations.find((n) => n.id === Number(link[2]));
      return nation ? (
        <button
          className="epi-nation"
          key={i}
          onClick={() => onNation(nation.id)}
        >
          {link![1]}
        </button>
      ) : (
        <span key={i}>{part}</span>
      );
    });
  }
  return (
    <aside
      className="epi-panel"
      aria-label="서기관 에피"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onClose();
        }
      }}
    >
      <div className="epi-heading">
        <img src="/art/epi.svg" alt="서기관 정령 에피" />
        <div>
          <b>에피</b>
          <small>창조주님의 세계를 기록해요</small>
        </div>
        <button onClick={onClose} aria-label="에피 닫기">
          ×
        </button>
      </div>
      <div
        className="epi-messages"
        ref={scroller}
        onScroll={() => {
          const el = scroller.current!;
          follow.current =
            el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
        aria-live={busy ? "off" : "polite"}
      >
        {!chat.messages.length && (
          <div className="epi-welcome">
            <b>창조주님, 무엇이 궁금하세요?</b>
            <p>세계의 기록과 지금 모습을 함께 살펴볼게요.</p>
            {[
              "지금 가장 강한 국가가 어디야?",
              "최근 주목할 사건을 알려줘",
              "300년 전과 지금은 어떻게 달라졌어?",
            ].map((q) => (
              <button key={q} onClick={() => setQuestion(q)}>
                {q}
              </button>
            ))}
          </div>
        )}
        {chat.messages.map((m) => (
          <article key={m.id} className={"epi-message " + m.role}>
            <small>
              {m.role === "user" ? "창조주님" : "에피"} ·{" "}
              {m.year.toLocaleString()}년 관측
            </small>
            <div>
              {linked(m.content || (busy ? "세계의 기록을 읽고 있어요…" : ""))}
            </div>
            {m.error && (
              <p className="epi-error">
                {errorMessages[m.error] ||
                  "기록을 완성하지 못했어요. 잠시 뒤 다시 시도해 주세요."}
              </p>
            )}
            {m.state === "error" && !busy && (
              <button
                onClick={() =>
                  void send(
                    lastRequest.current ||
                      chat.messages[chat.messages.indexOf(m) - 1]?.content,
                  )
                }
              >
                다시 요청
              </button>
            )}
          </article>
        ))}
        <div ref={end} />
      </div>
      {selected > 0 && (
        <button
          className="epi-selection"
          onClick={() =>
            setQuestion(
              (w.nations[selected - 1]?.name || "선택한 국가") +
                "의 발전 상태와 그 이유를 알려줘",
            )
          }
        >
          선택 국가에 대해 묻기 ↗
        </button>
      )}
      {saveFailed && (
        <small className="epi-warning">
          대화 저장 공간이 부족해요. 이번 대화는 화면에서 계속할 수 있어요.
        </small>
      )}
      <details className="epi-access">
        <summary>
          {status?.enabled
            ? "대화 접근 설정"
            : status?.configured
              ? "대화 준비 · 서버 활성화 필요"
              : "대화 준비 · 서버 연결 설정"}
        </summary>
        <p>
          대화는 서버 API 설정 후 사용할 수 있어요. 사건 보고는 설정 없이
          동작합니다.
        </p>
        <label>
          초대 코드
          <input
            type="password"
            value={access}
            maxLength={256}
            autoComplete="off"
            onChange={(e) => {
              setAccess(e.target.value);
              try {
                sessionStorage.setItem("epi-access", e.target.value);
              } catch {}
            }}
          />
        </label>
        <small>
          API 키는 서버의 DEEPSEEK_API_KEY에만 등록하세요. 이 입력란은 서버
          접근용 초대 코드입니다.
        </small>
      </details>
      <form
        className="epi-input"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <label className="sr-only" htmlFor="epi-question">
          에피에게 질문
        </label>
        <textarea
          id="epi-question"
          placeholder="이 세계가 궁금하세요?"
          value={question}
          maxLength={1200}
          disabled={busy}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (
              e.key === "Enter" &&
              !e.shiftKey &&
              !e.nativeEvent.isComposing
            ) {
              e.preventDefault();
              void send();
            }
          }}
        />
        {busy ? (
          <button type="button" onClick={() => controller.current?.abort()}>
            중단
          </button>
        ) : (
          <button disabled={!question.trim()} type="submit">
            전송
          </button>
        )}
      </form>
      <small className="epi-footnote">
        읽기 전용 · 최근 8턴과 질문 요약 · 다시 요청 시 새 호출이 발생합니다
      </small>
    </aside>
  );
}
