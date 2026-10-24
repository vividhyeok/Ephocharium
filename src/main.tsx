import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import MapView from "./MapView";
import {
  TOOLS,
  validate,
  type World,
  type Preset,
  type Options,
} from "./engine";
import { useUI } from "./store";
import * as storage from "./storage";
import "./style.css";
const PRESETS: {
  id: Preset;
  name: string;
  description: string;
  icon: string;
}[] = [
  {
    id: "empty",
    name: "빈 세계",
    description: "첫 생명의 자리를 직접 골라보세요",
    icon: "◯",
  },
  {
    id: "dawn",
    name: "문명의 시작",
    description: "스무 명의 작은 발걸음에서",
    icon: "♟",
  },
  {
    id: "four",
    name: "네 왕국",
    description: "서로 다른 네 가지 운명",
    icon: "⚑",
  },
  {
    id: "islands",
    name: "군도 세계",
    description: "섬마다 피어나는 독립 문명",
    icon: "≈",
  },
  {
    id: "war",
    name: "전쟁의 시대",
    description: "여섯 왕국, 불안한 평화",
    icon: "⚔",
  },
  {
    id: "observe",
    name: "관찰 모드",
    description: "이미 시작된 역사의 한가운데",
    icon: "◉",
  },
];
function App() {
  const ui = useUI();
  const [world, setWorld] = useState<World>();
  const worldRef = useRef<World | undefined>(undefined);
  worldRef.current = world;
  const worker = useRef<Worker | undefined>(undefined);
  const [panel, setPanel] = useState<
    "new" | "history" | "save" | "help" | null
  >(null);
  const [selected, setSelected] = useState(0);
  const [focus, setFocus] = useState<number | null>(null);
  const [toast, setToast] = useState("");
  const [ready, setReady] = useState(false);
  const [tutorial, setTutorial] = useState(
    !localStorage.getItem("epocharium-tutorial"),
  );
  const [autoCamera, setAutoCamera] = useState(false);
  const [slotList, setSlotList] = useState<
    { key: string; world: World; date: number }[]
  >([]);
  const [options, setOptions] = useState<Options>({
    seed: 241026,
    size: 112,
    sea: 0.45,
    forest: 0.4,
    mountains: 0.07,
    preset: "four",
  });
  const input = useRef<HTMLInputElement>(null);
  const notify = (s: string) => setToast(s);
  useEffect(() => {
    const w = new Worker(new URL("./worker.ts", import.meta.url), {
      type: "module",
    });
    worker.current = w;
    w.onmessage = (e) => setWorld(e.data);
    w.onerror = () =>
      notify(
        "시뮬레이션 오류가 발생했습니다. 새로고침 후 저장된 세계를 불러오세요.",
      );
    storage
      .load("자동 저장")
      .then((saved) => {
        w.postMessage(
          saved
            ? { type: "load", world: saved }
            : { type: "generate", options },
        );
        setReady(true);
      })
      .catch(() => {
        w.postMessage({ type: "generate", options });
        setReady(true);
        notify("저장소 접근에 실패했습니다. 세계 파일 내보내기를 사용하세요.");
      });
    return () => w.terminate();
  }, []);
  useEffect(() => {
    worker.current?.postMessage({ type: "speed", speed: ui.speed });
    worker.current?.postMessage({ type: "pause", paused: ui.paused });
  }, [ui.speed, ui.paused]);
  useEffect(() => {
    const id = setInterval(() => {
      if (worldRef.current)
        storage
          .save("자동 저장", worldRef.current)
          .catch(() => notify("자동 저장 실패 · 파일로 내보내세요"));
    }, 15000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(""), 3500);
    return () => clearTimeout(id);
  }, [toast]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).matches("input,select,textarea")) return;
      if (e.code === "Space") {
        e.preventDefault();
        ui.set({ paused: !useUI.getState().paused });
      }
      if (e.key === "Escape") {
        setPanel(null);
        setSelected(0);
        ui.set({ tool: "inspect" });
      }
      const speeds = [1, 2, 5, 10, 20];
      if ("12345".includes(e.key) && e.key.length === 1)
        ui.set({ speed: speeds[Number(e.key) - 1] });
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  useEffect(() => {
    if (autoCamera && ui.observe && world?.history.at(-1)?.tile !== undefined)
      setFocus(world.history.at(-1)!.tile!);
  }, [
    world?.history.at(-1)?.year,
    world?.history.at(-1)?.text,
    autoCamera,
    ui.observe,
  ]);
  const openSave = async () => {
    setPanel("save");
    try {
      setSlotList(await storage.slots());
    } catch {
      notify("저장 목록을 읽지 못했습니다");
    }
  };
  const doSave = async (slot: string) => {
    try {
      if (world) {
        await storage.save(slot, world);
        setSlotList(await storage.slots());
        notify("세계를 저장했습니다");
      }
    } catch {
      notify("저장 실패 · 파일로 내보내세요");
    }
  };
  const exportWorld = () => {
    if (!world) return;
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(world)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "epocharium-" + world.year + "년.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const importWorld = async (file?: File) => {
    if (!file) return;
    try {
      if (file.size > 15000000) throw Error();
      const value = JSON.parse(await file.text());
      if (!validate(value)) throw Error();
      worker.current?.postMessage({ type: "load", world: value });
      setSelected(0);
      setPanel(null);
      notify("세계를 불러왔습니다");
    } catch {
      notify("올바른 Epocharium 세계 파일이 아닙니다");
    }
    if (input.current) input.current.value = "";
  };
  const n = world?.nations.find((n) => n.id === selected);
  const alive = world?.nations.filter((n) => n.alive) || [];
  const population = Math.round(alive.reduce((a, n) => a + n.population, 0));
  const wars = world?.relations.filter((r) => r.war).length || 0;
  return (
    <main className={ui.observe ? "app observing" : "app"}>
      <header>
        <a className="brand" href="#" aria-label="Epocharium 홈">
          <span className="brand-mark">
            E<span>✦</span>
          </span>
          <div>
            EPOCHARIUM<small>작은 세계, 끝없는 역사</small>
          </div>
        </a>
        <div className="header-world">
          <span className="live-dot" />{" "}
          {ui.paused ? "잠시 멈춘 세계" : "살아 숨 쉬는 세계"}
          <span className="divider" /> 시드 {world?.seed ?? "…"}
        </div>
        <nav>
          <button onClick={() => setPanel("new")}>＋ 새 세계</button>
          <button onClick={openSave}>
            ▣ <span>저장</span>
          </button>
          <button onClick={() => setPanel("help")} aria-label="도움말">
            ?
          </button>
        </nav>
      </header>
      <section className="viewport">
        {world ? (
          <MapView
            world={world}
            tool={ui.tool}
            radius={ui.radius}
            political={ui.political}
            focus={focus}
            onSelect={(id) => setSelected(id)}
            onUse={(tile) =>
              worker.current?.postMessage({
                type: "apply",
                tool: ui.tool,
                tile,
                radius: ui.radius,
              })
            }
          />
        ) : (
          <div className="loading">✦ 세계를 빚고 있습니다…</div>
        )}
        <div className="world-status">
          <span className="eyebrow">우리 세계의 시간</span>
          <div className="year">
            {world?.year.toLocaleString() ?? 0}
            <small>년</small>
          </div>
          <div className="stats">
            <span>
              ♟ {population.toLocaleString()}
              <small>인구</small>
            </span>
            <span>
              ⚑ {alive.length}
              <small>왕국</small>
            </span>
            <span className={wars ? "war-count" : ""}>
              ⚔ {wars}
              <small>전쟁</small>
            </span>
          </div>
        </div>
        <div className="map-actions">
          <button
            className={ui.political ? "active" : ""}
            title="국가의 영토와 국경 표시"
            onClick={() => ui.set({ political: !ui.political })}
          >
            ⚑ 국경
          </button>
          <button
            className={ui.observe ? "active" : ""}
            onClick={() => ui.set({ observe: !ui.observe, tool: "inspect" })}
          >
            ◉ {ui.observe ? "도구 펼치기" : "관찰 모드"}
          </button>
          <button
            title="실제 세계 사건 기록"
            onClick={() => setPanel("history")}
          >
            ☷ 역사
          </button>
        </div>
        {!ui.observe && (
          <aside className="world-guide">
            <span className="eyebrow">살아있는 세계</span>
            <h1>
              역사는, 지금도
              <br />
              자라고 있습니다.
            </h1>
            <p>
              작은 만남이 왕국이 되고,
              <br />
              당신의 손끝이 새로운 시대를 엽니다.
            </p>
            <div className="guide-rule" />
            <span>지도를 움직이며 발견해 보세요</span>
            <small>드래그로 이동 · 휠로 확대</small>
          </aside>
        )}
        {n && (
          <aside className="nation-panel">
            <button
              className="close"
              aria-label="국가 정보 닫기"
              onClick={() => setSelected(0)}
            >
              ×
            </button>
            <span className="eyebrow">
              왕국의 이야기 {n.alive ? "" : "· 멸망"}
            </span>
            <h2 style={{ color: n.color }}>⚑ {n.name}</h2>
            <p>
              {n.leader} · {Math.floor(n.age)}세 ·{" "}
              {n.aggression > 0.6
                ? "정복을 꿈꾸는 지도자"
                : "번영을 바라는 지도자"}
            </p>
            <div className="nation-grid">
              <span>
                인구<b>{Math.round(n.population).toLocaleString()}명</b>
              </span>
              <span>
                영토<b>{n.territory}개 구역</b>
              </span>
              <span>
                경제<b>{n.food > n.population ? "풍요로움" : "식량 부족"}</b>
              </span>
              <span>
                안정성
                <b>
                  {n.stability > 0.7
                    ? "평온함"
                    : n.stability > 0.4
                      ? "흔들림"
                      : "위기"}
                </b>
              </span>
            </div>
            <div className="stability">
              <i
                style={{ width: n.stability * 100 + "%", background: n.color }}
              />
            </div>
            <p>
              외교 ·{" "}
              {world?.relations.some(
                (r) => r.war && (r.a === n.id || r.b === n.id),
              )
                ? "전쟁 중"
                : "평화로운 시기"}{" "}
              {n.protected ? "· 신의 보호" : ""}
            </p>
            <details>
              <summary>문명의 흐름 자세히 보기</summary>
              <p>
                식량 {Math.round(n.food)} · 재산 {Math.round(n.wealth)}
                <br />
                기술 {n.tech.toFixed(2)} · 최대 영토 {n.peak}
              </p>
              {n.samples.slice(-5).map((s) => (
                <div className="sample" key={s.year}>
                  {s.year}년{" "}
                  <span>
                    {s.population}명 · {s.territory}구역
                  </span>
                </div>
              ))}
            </details>
            <h3>최근 발자취</h3>
            {world?.history
              .filter((e) => e.nations.includes(n.id))
              .slice(-4)
              .reverse()
              .map((e, i) => (
                <p className="mini-event" key={i}>
                  <b>{e.year}년</b> {e.text}
                </p>
              ))}
          </aside>
        )}
        <div className="compass">
          N<span>✧</span>
          <small>새로운 가능성의 바다</small>
        </div>
        {tutorial && ready && (
          <div className="tutorial">
            <span>✦ 세계에 오신 것을 환영합니다</span>
            <p>
              왕국을 눌러 이야기를 읽거나, 아래에서 인간을 선택해 땅에
              놓아보세요.
              <br />
              문명은 스스로 자랍니다. 스페이스로 쉬어갈 수 있어요.
            </p>
            <button
              onClick={() => {
                setTutorial(false);
                localStorage.setItem("epocharium-tutorial", "1");
              }}
            >
              세계 둘러보기 →
            </button>
          </div>
        )}
        <div className="event-feed">
          <span className="event-indicator">✦</span>
          <p>
            {world?.history.at(-1) ? (
              <>
                <b>{world.history.at(-1)!.year}년</b>{" "}
                {world.history.at(-1)!.text}
              </>
            ) : (
              "아직 쓰이지 않은 이야기 · 첫 생명을 기다리는 세계"
            )}
          </p>
          <button onClick={() => setPanel("history")} aria-label="역사 펼치기">
            ↗
          </button>
        </div>
      </section>
      <footer>
        <div className="time-controls">
          <button
            className="play"
            aria-label={ui.paused ? "재생" : "일시정지"}
            onClick={() => ui.set({ paused: !ui.paused })}
          >
            {ui.paused ? "▶" : "Ⅱ"}
          </button>
          <div>
            <small>시간의 흐름</small>
            <div className="speeds">
              {[1, 2, 5, 10, 20].map((s) => (
                <button
                  className={ui.speed === s ? "selected" : ""}
                  key={s}
                  onClick={() => ui.set({ speed: s })}
                >
                  {s}×
                </button>
              ))}
            </div>
          </div>
        </div>
        {!ui.observe && (
          <div className="toolbox">
            <div className="categories">
              {["생명", "지형", "자연", "재해", "문명", "세계 설정"].map(
                (c) => (
                  <button
                    key={c}
                    className={ui.category === c ? "selected" : ""}
                    onClick={() =>
                      c === "세계 설정"
                        ? setPanel("new")
                        : ui.set({
                            category: c,
                            tool: Object.keys(TOOLS).find(
                              (k) => TOOLS[k].category === c,
                            )!,
                          })
                    }
                  >
                    {c}
                  </button>
                ),
              )}
            </div>
            <div className="tools">
              {Object.entries(TOOLS)
                .filter(([, v]) => v.category === ui.category)
                .map(([key, v]) => (
                  <button
                    key={key}
                    title={v.label + " · " + v.description}
                    className={ui.tool === key ? "selected" : ""}
                    onClick={() => ui.set({ tool: key })}
                  >
                    <span>{v.icon}</span>
                    <small>{v.label}</small>
                  </button>
                ))}
            </div>
          </div>
        )}
        <div className="brush">
          {ui.observe ? (
            <label>
              <input
                type="checkbox"
                checked={autoCamera}
                onChange={(e) => setAutoCamera(e.target.checked)}
              />{" "}
              사건 따라가기
            </label>
          ) : (
            <>
              <label htmlFor="brush">
                브러시 크기 <b>{ui.radius}</b>
              </label>
              <input
                id="brush"
                type="range"
                min="1"
                max="6"
                value={ui.radius}
                onChange={(e) => ui.set({ radius: Number(e.target.value) })}
              />
              <small>우클릭으로 국가 정보</small>
            </>
          )}
        </div>
      </footer>
      {panel && (
        <div className="modal-backdrop" onClick={() => setPanel(null)}>
          <section
            className={"modal " + (panel === "new" ? "new-world" : "")}
            role="dialog"
            aria-modal="true"
            aria-label={
              {
                new: "새 세계 만들기",
                history: "세계의 역사",
                save: "저장된 세계",
                help: "플레이 안내",
              }[panel]
            }
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="close"
              onClick={() => setPanel(null)}
              aria-label="패널 닫기"
            >
              ×
            </button>
            <span className="eyebrow">EPOCHARIUM</span>
            <h2>
              {
                {
                  new: "어떤 역사를 시작할까요?",
                  history: "세계가 남긴 발자취",
                  save: "당신의 세계를 간직하세요",
                  help: "작은 개입, 무한한 이야기",
                }[panel]
              }
            </h2>
            {panel === "new" && (
              <>
                <p className="muted">
                  각각의 세계에는 아직 발견하지 못한 가능성이 있습니다.
                </p>
                <div className="presets">
                  {PRESETS.map((p) => (
                    <button
                      key={p.id}
                      className={options.preset === p.id ? "selected" : ""}
                      onClick={() => setOptions({ ...options, preset: p.id })}
                    >
                      <span>{p.icon}</span>
                      <b>{p.name}</b>
                      <small>{p.description}</small>
                    </button>
                  ))}
                </div>
                <div className="settings">
                  <label>
                    세계 크기
                    <select
                      value={options.size}
                      onChange={(e) =>
                        setOptions({ ...options, size: Number(e.target.value) })
                      }
                    >
                      <option value={80}>작게 · 80</option>
                      <option value={112}>보통 · 112</option>
                      <option value={160}>크게 · 160</option>
                    </select>
                  </label>
                  <label>
                    세계의 시드
                    <input
                      value={options.seed}
                      type="number"
                      onChange={(e) =>
                        setOptions({ ...options, seed: Number(e.target.value) })
                      }
                    />
                  </label>
                  {(["sea", "forest", "mountains"] as const).map((k) => (
                    <label key={k}>
                      {
                        {
                          sea: "바다 면적",
                          forest: "숲의 밀도",
                          mountains: "산맥의 밀도",
                        }[k]
                      }
                      <input
                        type="range"
                        min="0.05"
                        max={k === "mountains" ? 0.35 : 0.85}
                        step="0.05"
                        value={options[k]}
                        onChange={(e) =>
                          setOptions({
                            ...options,
                            [k]: Number(e.target.value),
                          })
                        }
                      />
                    </label>
                  ))}
                </div>
                <p className="muted">
                  현재 세계는 교체됩니다. 간직하려면 먼저 저장하세요.
                </p>
                <button
                  className="primary"
                  onClick={() => {
                    worker.current?.postMessage({ type: "generate", options });
                    setSelected(0);
                    ui.set({
                      paused: false,
                      observe: options.preset === "observe",
                    });
                    setPanel(null);
                  }}
                >
                  ✦ 새로운 세계 탄생시키기
                </button>
              </>
            )}
            {panel === "history" && (
              <>
                <p className="muted">
                  실제 세계에서 일어난 중요한 변화만 기록합니다.
                </p>
                <div className="history-list">
                  {world?.history
                    .slice()
                    .reverse()
                    .map((e, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          if (e.tile !== undefined) setFocus(e.tile);
                          setPanel(null);
                        }}
                      >
                        <b>{e.year}년</b>
                        <span>{e.text}</span>
                        <small>{e.tile !== undefined ? "↗" : ""}</small>
                      </button>
                    ))}
                </div>
                <h3>멸망한 왕국</h3>
                <p className="muted">
                  {world?.nations
                    .filter((n) => !n.alive)
                    .map((n) => n.name)
                    .join(" · ") ||
                    "아직 모든 왕국의 이야기가 이어지고 있습니다."}
                </p>
              </>
            )}
            {panel === "save" && (
              <>
                <p className="muted">
                  15초마다 자동 저장됩니다. 파일로도 세계를 옮길 수 있어요.
                </p>
                {[1, 2, 3].map((i) => (
                  <button
                    className="slot-save"
                    key={i}
                    onClick={() => doSave("저장 " + i)}
                  >
                    ＋ 저장 슬롯 {i}에 현재 세계 저장
                  </button>
                ))}
                {slotList.map((s) => (
                  <div className="save-row" key={s.key}>
                    <span>
                      <b>{s.key}</b>
                      <small>
                        {s.world.year}년 ·{" "}
                        {new Date(s.date).toLocaleString("ko-KR")}
                      </small>
                    </span>
                    <button
                      onClick={() => {
                        worker.current?.postMessage({
                          type: "load",
                          world: s.world,
                        });
                        setPanel(null);
                        setSelected(0);
                      }}
                    >
                      불러오기
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          await storage.remove(s.key);
                          setSlotList(await storage.slots());
                        } catch {
                          notify("삭제 실패");
                        }
                      }}
                    >
                      삭제
                    </button>
                  </div>
                ))}
                <div className="file-actions">
                  <button onClick={exportWorld}>↓ 세계 파일 내보내기</button>
                  <button onClick={() => input.current?.click()}>
                    ↑ 세계 파일 가져오기
                  </button>
                </div>
              </>
            )}
            {panel === "help" && (
              <div className="help">
                <p>
                  당신은 이 세계의 관찰자이자 작은 기적을 만드는 존재입니다.
                  식량과 환경에 따라 인구가 자라고, 국경을 맞댄 왕국은
                  교역하거나 경쟁합니다.
                </p>
                <p>
                  <b>관찰</b>을 선택하고 드래그해 지도를 움직이세요. 다른 도구를
                  쓰는 중에는 우클릭 드래그로 이동할 수 있습니다.
                </p>
                <p>
                  휠 · 확대/축소
                  <br />
                  좌클릭/드래그 · 능력 사용
                  <br />
                  우클릭 · 국가 정보
                  <br />
                  스페이스 · 일시정지
                  <br />
                  1~5 · 배속 선택
                  <br />
                  ESC · 패널 닫기
                </p>
                <p>
                  인간 20명은 몇 년에 걸쳐 정착합니다. 인구를 지원할 때는 식량도
                  살펴보세요. 국경이 만나야 외교가 시작되며, 산과 바다는 영토
                  확장을 막습니다.
                </p>
                <p>
                  관찰 모드의 ‘사건 따라가기’를 켜면 주요 사건으로 지도가
                  이동합니다. 새 세계에서 여섯 가지 시작 프리셋을 골라보세요.
                </p>
              </div>
            )}
          </section>
        </div>
      )}
      <input
        type="file"
        accept="application/json,.json"
        hidden
        ref={input}
        onChange={(e) => importWorld(e.target.files?.[0])}
      />
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </main>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
