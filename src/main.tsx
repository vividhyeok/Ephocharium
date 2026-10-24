import EpiPanel from "./epi/EpiPanel";
import { useEpiReports } from "./epi/reports";
import NationBrowser from "./NationBrowser";
import NationPanel from "./NationPanel";
import { patchWorld } from "./wire";
import HistoryOverview from "./HistoryOverview";
import { DIRECTIONS, developmentGate } from "./progression";
import { equipmentEra } from "./eras";
import DiplomacyView from "./DiplomacyView";
import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import MapView from "./MapView";
import Icon, { type IconName } from "./Icons";
import Minimap from "./Minimap";
import PresetArt from "./PresetArt";
import { ERAS, eraOf, ROLES } from "./civilization";
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
  const [displayMenu, setDisplayMenu] = useState(false);
  const [world, setWorld] = useState<World>();
  const worldRef = useRef<World | undefined>(undefined);
  worldRef.current = world;
  const worker = useRef<Worker | undefined>(undefined);
  const [panel, setPanel] = useState<
    "new" | "history" | "save" | "help" | null
  >(null);
  const [selected, setSelected] = useState(0);
  const [epiOpen, setEpiOpen] = useState(false),
    [epiPrompt, setEpiPrompt] = useState("");
  const [reportsEnabled, setReportsEnabled] = useState(() => {
    try {
      return localStorage.getItem("epi-reports") !== "off";
    } catch {
      return true;
    }
  });
  const { report, dismiss: dismissReport } = useEpiReports(
    world,
    reportsEnabled,
  );
  useEffect(() => {
    setEpiOpen(false);
    setEpiPrompt("");
  }, [world?.worldId]);
  const [hoverTile, setHoverTile] = useState(-1);
  const [focus, updateFocus] = useState<{
    tile: number;
    request: number;
  } | null>(null);
  const setFocus = (tile: number) =>
    updateFocus((previous) => ({
      tile,
      request: (previous?.request ?? 0) + 1,
    }));
  const [viewCommand, setViewCommand] = useState({ action: "fit", id: 0 });
  const moveView = (action: string) =>
    setViewCommand((v) => ({ action, id: v.id + 1 }));
  const [toast, setToast] = useState("");
  const [ready, setReady] = useState(false);
  const [tutorial, setTutorial] = useState(() => {
    try {
      return !localStorage.getItem("epocharium-tutorial");
    } catch {
      return true;
    }
  });
  const [worldEpoch, setWorldEpoch] = useState(0);
  const [canUndo, setCanUndo] = useState(false);
  const [pair, setPair] = useState<[number, number]>([0, 0]);
  const [pairSide, setPairSide] = useState<0 | 1>(0);
  useEffect(() => {
    setPair([0, 0]);
    setPairSide(0);
  }, [worldEpoch]);
  const [eventLevel, setEventLevel] = useState("major");
  const cameraLast = useRef(0);
  const seenEvent = useRef(0);
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
    developmentSpeed: "standard",
  });
  const input = useRef<HTMLInputElement>(null);
  const notify = (s: string) => setToast(s);
  useEffect(() => {
    const w = new Worker(new URL("./worker.ts", import.meta.url), {
      type: "module",
    });
    worker.current = w;
    w.onmessage = (e) => {
      if (e.data.meta)
        setWorld((previous) =>
          previous
            ? patchWorld(previous, e.data.meta, e.data.patches)
            : previous,
        );
      else if (e.data.world) setWorld(e.data.world);
      else if (typeof e.data.clockPhase === "number")
        setWorld((previous) =>
          previous ? { ...previous, clockPhase: e.data.clockPhase } : previous,
        );
      setWorldEpoch(e.data.epoch || 0);
      setCanUndo(!!e.data.canUndo);
      if (e.data.notice) notify(e.data.notice);
    };
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
      if (
        (e.target as HTMLElement).closest('[role="dialog"]') &&
        e.key !== "Escape"
      )
        return;
      if (e.code === "Space") {
        e.preventDefault();
        ui.set({ paused: !useUI.getState().paused });
      }
      if (e.key === "Escape") {
        setPanel(null);
        setSelected(0);
        setEpiOpen(false);
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
    if (!panel) return;
    const previous = document.activeElement as HTMLElement;
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    dialog?.querySelector<HTMLButtonElement>("button")?.focus();
    const trap = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !dialog) return;
      const controls = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button,input,select,summary,[tabindex="0"]',
        ),
      ).filter(
        (el) => !el.hasAttribute("disabled") && el.getClientRects().length,
      );
      const first = controls[0],
        last = controls.at(-1);
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", trap);
    return () => {
      document.removeEventListener("keydown", trap);
      previous?.focus();
    };
  }, [panel]);
  useEffect(() => {
    const major = world?.history.filter((e) => e.importance === "major").at(-1);
    if (!major || !major.id || major.id === seenEvent.current) return;
    seenEvent.current = major.id;
    if (
      autoCamera &&
      ui.observe &&
      major.tile !== undefined &&
      performance.now() - cameraLast.current > 12000
    ) {
      setFocus(major.tile);
      cameraLast.current = performance.now();
    }
  }, [world, autoCamera, ui.observe]);
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
      if (file.size > 60000000) throw Error();
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
  const polity = world?.life?.polities.find((p) => p.nation === selected);
  const frontline =
    world?.life?.armies.find((a) => a.nation === selected && a.fighting) ||
    world?.life?.armies.find((a) => a.nation === selected);
  const cities =
    world?.life?.settlements.filter((c) => c.nation === selected) || [];
  const tile = world?.tiles[hoverTile];
  const hoveredPerson = world?.life?.citizens.find(
    (u) => Math.floor(u.y) * world.width + Math.floor(u.x) === hoverTile,
  );
  const alive = world?.nations.filter((n) => n.alive) || [];
  const population = Math.round(alive.reduce((a, n) => a + n.population, 0));
  const wars = world?.relations.filter((r) => r.war).length || 0;
  return (
    <main className={ui.observe ? "app observing" : "app"}>
      <header>
        <a className="brand" href="#" aria-label="Epocharium 홈">
          <span className="brand-mark">
            <Icon name="world" size={25} />
            <span>✦</span>
          </span>
          <div>
            EPOCH<span className="brand-light">ARIUM</span>
            <small>문명이 피어나는 작은 우주</small>
          </div>
        </a>
        <div className="header-world">
          <span className="live-dot" />{" "}
          {ui.paused ? "잠시 멈춘 세계" : "살아 숨 쉬는 세계"}
          <span className="divider" /> 시드 {world?.seed ?? "…"}
        </div>
        <nav>
          <button
            className="new-world-button"
            aria-label="＋ 새 세계"
            onClick={() => setPanel("new")}
          >
            <Icon name="plus" size={15} /> 새 세계
          </button>
          <button aria-label="▣ 저장" onClick={openSave}>
            <Icon name="save" size={16} /> <span>저장</span>
          </button>
          <button onClick={() => setPanel("help")} aria-label="도움말">
            <Icon name="help" size={17} />
          </button>
          <button
            className="epi-open"
            aria-label="에피"
            aria-expanded={epiOpen}
            disabled={!world}
            onClick={() => setEpiOpen(!epiOpen)}
          >
            <img src="/art/epi.svg" alt="" />
            <span>에피</span>
          </button>
        </nav>
      </header>
      <section className={"viewport" + (epiOpen ? " epi-visible" : "")}>
        {world && epiOpen && (
          <EpiPanel
            key={world.worldId || world.seed}
            world={world}
            selected={selected}
            prompt={epiPrompt}
            onClose={() => setEpiOpen(false)}
            onNation={(id) => {
              const nation = world.nations.find((n) => n.id === id);
              if (nation) {
                setSelected(id);
                setFocus(nation.capital);
              }
            }}
          />
        )}
        {report && !epiOpen && reportsEnabled && (
          <div className="epi-report">
            <img src="/art/epi.svg" alt="" />
            <button
              onClick={() => {
                setEpiPrompt(report.year+'년의 보고: '+report.text + " 이 사건의 배경과 영향을 설명해줘");
                setEpiOpen(true);
                if (report.tile !== undefined) setFocus(report.tile);
                if (report.nation) setSelected(report.nation);
                dismissReport();
              }}
            >
              <small>에피 · {report.year.toLocaleString()}년</small>
              {report.text}
            </button>
            <button aria-label="에피 보고 닫기" onClick={dismissReport}>
              ×
            </button>
          </div>
        )}
        {world && (
          <DiplomacyView
            world={world}
            compact
            onOpen={() => setPanel("history")}
          />
        )}
        {world ? (
          <MapView
            world={world}
            worldEpoch={worldEpoch}
            pair={
              ["war", "alliance", "peace"].includes(ui.tool) ? pair : undefined
            }
            tool={ui.tool}
            radius={ui.radius}
            political={ui.political}
            labels={ui.labels}
            cities={ui.cities}
            diplomacy={ui.diplomacy}
            selected={selected}
            focus={focus}
            command={viewCommand}
            paused={ui.paused}
            speed={ui.speed}
            onStroke={(begin) => {
              if (!["war", "alliance", "peace"].includes(ui.tool))
                worker.current?.postMessage({ type: begin ? "begin" : "end" });
            }}
            onHover={setHoverTile}
            onSelect={(id) => setSelected(id)}
            onUse={(tile) => {
              if (["war", "alliance", "peace"].includes(ui.tool)) {
                const id = world.tiles[tile].owner;
                if (id) {
                  setPair((p) => (pairSide === 0 ? [id, p[1]] : [p[0], id]));
                  setPairSide(pairSide === 0 ? 1 : 0);
                }
                return;
              }
              worker.current?.postMessage({
                type: "apply",
                tool: ui.tool,
                tile,
                radius: ui.radius,
              });
            }}
          />
        ) : (
          <div className="loading">✦ 세계를 빚고 있습니다…</div>
        )}
        {["war", "alliance", "peace"].includes(ui.tool) && (
          <aside className="intervention-picker">
            <strong>두 국가 지정 · {TOOLS[ui.tool].label}</strong>
            <label>
              실행할 개입{" "}
              <select
                aria-label="실행할 외교 개입"
                value={ui.tool}
                onChange={(e) => ui.set({ tool: e.target.value })}
              >
                <option value="war">전쟁</option>
                <option value="alliance">동맹</option>
                <option value="peace">평화</option>
              </select>
            </label>
            <small>선택할 쪽을 누른 뒤 지도 또는 목록에서 지정하세요.</small>
            {([0, 1] as const).map((side) => (
              <label key={side}>
                <button
                  aria-pressed={pairSide === side}
                  onClick={() => setPairSide(side)}
                >
                  {side === 0 ? "대상" : "상대"} 선택
                </button>
                <select
                  aria-label={side === 0 ? "개입 대상 국가" : "개입 상대 국가"}
                  value={pair[side]}
                  onChange={(e) =>
                    setPair((p) =>
                      side === 0
                        ? [+e.target.value, p[1]]
                        : [p[0], +e.target.value],
                    )
                  }
                >
                  <option value={0}>국가 지정</option>
                  {world?.nations
                    .filter((n) => n.alive)
                    .map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.name}
                      </option>
                    ))}
                </select>
              </label>
            ))}
            <button
              disabled={!pair[0] || !pair[1] || pair[0] === pair[1]}
              onClick={() =>
                worker.current?.postMessage({
                  type: "intervene",
                  a: pair[0],
                  b: pair[1],
                  action: ui.tool,
                })
              }
            >
              지정한 두 국가에 적용
            </button>
            <button
              disabled={!pair[0]}
              onClick={() =>
                worker.current?.postMessage({
                  type: "apply",
                  tool: ui.tool,
                  tile: world!.nations[pair[0] - 1].capital,
                  radius: 1,
                })
              }
            >
              {ui.tool === "peace"
                ? "빠른 평화 · 대상의 모든 전쟁 종료"
                : "빠른 개입 · 가까운 국가 자동 선택"}
            </button>
          </aside>
        )}
        <div className="world-status">
          <span className="eyebrow">
            <span className="status-orbit" /> 세계의 연대기
          </span>
          <div className="year">
            {world?.year.toLocaleString() ?? 0}
            <small>년</small>
          </div>
          <div className="stats">
            <span>
              <Icon name="population" size={15} />
              <b>{population.toLocaleString()}</b>
              <small>살아가는 사람들</small>
            </span>
            <span>
              <Icon name="nation" size={15} />
              <b>{alive.length}</b>
              <small>왕국</small>
            </span>
            <span className={wars ? "war-count" : ""}>
              <Icon name="war" size={15} />
              <b>{wars}</b>
              <small>전쟁</small>
            </span>
          </div>
          {world?.life && (
            <div className="living-summary">
              <Icon name="human" size={12} />
              <span>
                움직이는 주민 {world.life.citizens.length} · 1명 표시 ≈{" "}
                {world.life.peoplePerAgent}명
              </span>
            </div>
          )}
        </div>
        <div className="map-actions">
          <button
            className="undo-action"
            aria-label="개입 실행 취소"
            disabled={!canUndo}
            title="직전 개입 직전의 세계 상태로 복원합니다"
            onClick={() => worker.current?.postMessage({ type: "undo" })}
          >
            ↶ 취소
          </button>

          <button
            className={ui.political ? "active" : ""}
            title="국가의 영토와 국경 표시"
            onClick={() => ui.set({ political: !ui.political })}
          >
            <Icon name="nation" size={15} /> 국경
          </button>
          <button
            className={ui.observe ? "active" : ""}
            onClick={() => ui.set({ observe: !ui.observe, tool: "inspect" })}
          >
            <Icon name="eye" size={15} />{" "}
            {ui.observe ? "도구 펼치기" : "관찰 모드"}
          </button>
          <button
            title="실제 세계 사건 기록"
            onClick={() => setPanel("history")}
          >
            <Icon name="history" size={15} /> 역사
          </button>
          <button
            aria-expanded={displayMenu}
            onClick={() => setDisplayMenu(!displayMenu)}
          >
            <Icon name="settings" size={15} /> 표시
          </button>
          {displayMenu && (
            <div
              className="display-menu"
              role="group"
              aria-label="지도 표시 설정"
            >
              <label>
                <input
                  type="checkbox"
                  checked={ui.labels}
                  onChange={(e) => ui.set({ labels: e.target.checked })}
                />
                국가 이름 · 레벨
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={ui.cities}
                  onChange={(e) => ui.set({ cities: e.target.checked })}
                />
                확대 시 도시 이름
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={ui.diplomacy}
                  onChange={(e) => ui.set({ diplomacy: e.target.checked })}
                />
                선택 국가의 외교 연결
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={reportsEnabled}
                  onChange={(e) => {
                    setReportsEnabled(e.target.checked);
                    try {
                      localStorage.setItem(
                        "epi-reports",
                        e.target.checked ? "on" : "off",
                      );
                    } catch {}
                  }}
                />
                에피의 조용한 사건 보고
              </label>
              <small>
                국가에 마우스를 올리면 동맹은 청록색, 전쟁은 주홍색 선으로
                표시됩니다.
              </small>
            </div>
          )}
        </div>
        {!ui.observe && world && (
          <div className="atlas-corner">
            <Minimap world={world} onFocus={setFocus} />
            <p>
              <Icon name="inspect" size={12} /> 드래그로 탐험 · 휠로 확대
            </p>
          </div>
        )}
        {!n && !ui.observe && (
          <aside className="kingdoms-panel">
            <div className="section-caption">
              <span>
                <Icon name="nation" size={14} /> 이 세계의 왕국
              </span>
              <small>{alive.length}</small>
            </div>
            {world && (
              <NationBrowser
                world={world}
                onSelect={(nation) => {
                  setSelected(nation.id);
                  setFocus(nation.capital);
                }}
              />
            )}
            <button
              className="kingdom-history"
              onClick={() => setPanel("history")}
            >
              모든 이야기는 역사로 남습니다 <Icon name="chevron" size={13} />
            </button>
          </aside>
        )}
        {tile && !ui.observe && (
          <aside className="tile-inspector">
            <span className="eyebrow">가까이 들여다보기</span>
            <h3>
              {
                ["바다", "모래 해안", "비옥한 평야", "숲", "산악", "설원"][
                  tile.t
                ]
              }
              <small>
                {hoverTile % world!.width},{" "}
                {Math.floor(hoverTile / world!.width)}
              </small>
            </h3>
            <div>
              <span>
                목재 <b>{Math.round(tile.wood || 0)}</b>
              </span>
              <span>
                광물{" "}
                <b>
                  {Math.round(
                    Object.values(tile.deposits || {}).reduce(
                      (s, v) => s + (v || 0),
                      0,
                    ),
                  )}
                </b>
              </span>
              <span>
                비옥도 <b>{Math.round(tile.fertility * 100)}%</b>
              </span>
            </div>
            {hoveredPerson && (
              <p>
                <Icon
                  name={hoveredPerson.role === "ruler" ? "revolt" : "human"}
                  size={13}
                />
                <b>
                  {hoveredPerson.role === "ruler"
                    ? hoveredPerson.name
                    : ROLES[hoveredPerson.role] + " 집단"}
                </b>
                <small>
                  {hoveredPerson.route.length
                    ? "일터로 이동 중"
                    : hoveredPerson.work
                      ? hoveredPerson.returning
                        ? "집에서 쉬는 중"
                        : "작업 중"
                      : "이동 준비"}
                </small>
              </p>
            )}
          </aside>
        )}
        {n && (
          <NationPanel
            world={world!}
            nation={n}
            onClose={() => setSelected(0)}
            onHistory={() => setPanel("history")}
            onFocus={setFocus}
            onDetail={() => {
              setFocus(n.capital);
              moveView("detail");
            }}
            onFront={() => {
              if (frontline) {
                setFocus(
                  Math.floor(frontline.y) * world!.width +
                    Math.floor(frontline.x),
                );
                moveView("detail");
              }
            }}
          />
        )}
        <div className="zoom-controls">
          <button
            aria-label="지도 확대"
            title="지도 확대"
            onClick={() => moveView("in")}
          >
            <Icon name="plus" />
          </button>
          <button
            aria-label="지도 축소"
            title="지도 축소"
            onClick={() => moveView("out")}
          >
            <Icon name="minus" />
          </button>
          <span />
          <button
            aria-label="세계 전체 보기"
            title="세계 전체 보기"
            onClick={() => moveView("fit")}
          >
            <Icon name="fit" size={16} />
          </button>
        </div>
        <div className="map-coordinate">
          <Icon name="compass" size={16} />
          <span>
            SEED {world?.seed} <b>·</b> 무한한 가능성의 세계
          </span>
        </div>
        {tutorial && ready && (
          <div className="tutorial">
            <div className="welcome-icon">
              <Icon name="life" size={24} />
            </div>
            <span>당신의 세계가 시작되었습니다</span>
            <p>
              왕국을 눌러 이야기를 읽거나, 아래에서 인간을 선택해 땅에
              놓아보세요.
              <br />
              왕국을 선택하고 ‘도시 가까이 보기’로 움직이는 주민을 만나보세요.
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
        {eventLevel !== "off" && (
          <div className="event-feed event-stack" role="log" aria-live="polite">
            <span className="event-indicator">
              <Icon name="history" size={16} />
            </span>
            <div>
              {world?.history
                .filter((e) => eventLevel === "all" || e.importance === "major")
                .slice(eventLevel === "all" ? -3 : -1)
                .reverse()
                .map((e, i) => (
                  <button
                    className="event-location"
                    key={e.id ?? i}
                    onClick={() => {
                      if (e.tile !== undefined) setFocus(e.tile);
                    }}
                  >
                    <b>{e.year}년</b> {e.text}
                  </button>
                ))}
            </div>
            <button
              onClick={() => setPanel("history")}
              aria-label="역사 펼치기"
            >
              <Icon name="arrow" size={16} />
            </button>
          </div>
        )}
      </section>
      <footer>
        <div
          className="time-controls"
          title="1배속: 4초에 1년 · 20배속: 초당 5년"
        >
          <button
            className="play"
            aria-label={ui.paused ? "재생" : "일시정지"}
            onClick={() => ui.set({ paused: !ui.paused })}
          >
            <Icon name={ui.paused ? "play" : "pause"} size={19} />
          </button>
          <div>
            <small>
              <span className={ui.paused ? "paused-dot" : "live-dot"} />
              {ui.paused ? "시간이 멈췄습니다" : "시간의 흐름"}
            </small>
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
                    <Icon
                      name={
                        (
                          {
                            생명: "life",
                            지형: "mountain",
                            자연: "nature",
                            재해: "fire",
                            문명: "nation",
                            "세계 설정": "settings",
                          } as Record<string, IconName>
                        )[c]
                      }
                      size={14}
                    />
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
                    aria-label={v.label}
                    data-tooltip={v.description}
                    className={ui.tool === key ? "selected" : ""}
                    onClick={() => ui.set({ tool: key })}
                  >
                    <span>
                      <Icon name={key as IconName} size={24} />
                    </span>
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
                <Icon name="settings" size={13} /> 브러시 <b>{ui.radius}</b>
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
                <img
                  className="creation-panorama"
                  src="/art/living-valley.png"
                  alt="Epocharium을 위해 제작한 강 유역과 산업·항만 원화"
                />
                <p className="muted">
                  각각의 세계에는 아직 발견하지 못한 가능성이 있습니다.
                </p>
                <div className="presets">
                  {PRESETS.map((p) => (
                    <button
                      key={p.id}
                      aria-label={p.name}
                      className={options.preset === p.id ? "selected" : ""}
                      onClick={() => setOptions({ ...options, preset: p.id })}
                    >
                      <PresetArt preset={p.id} />
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
                      <option value={192}>대륙 · 192</option>
                      <option value={256}>광대한 세계 · 256</option>
                    </select>
                  </label>
                  <label>
                    문명 발전 속도
                    <select
                      aria-label="문명 발전 속도"
                      value={options.developmentSpeed || "standard"}
                      onChange={(e) =>
                        setOptions({
                          ...options,
                          developmentSpeed: e.target
                            .value as Options["developmentSpeed"],
                        })
                      }
                    >
                      <option value="relaxed">느긋하게</option>
                      <option value="standard">표준</option>
                      <option value="fast">빠르게</option>
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
                <div className="observation-settings">
                  <label>
                    사건 표시{" "}
                    <select
                      aria-label="사건 표시량"
                      value={eventLevel}
                      onChange={(e) => setEventLevel(e.target.value)}
                    >
                      <option value="major">주요 사건 1개</option>
                      <option value="all">최근 사건 3개</option>
                      <option value="off">숨김</option>
                    </select>
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={autoCamera}
                      onChange={(e) => setAutoCamera(e.target.checked)}
                    />{" "}
                    주요 사건 자동 이동 (관찰 모드, 최소 12초 간격)
                  </label>
                </div>
                {world && <HistoryOverview world={world} />}
                {world && <DiplomacyView world={world} />}
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
                        <img
                          src={`/art/objects/${/전쟁|점령/.test(e.text) ? "war" : /성소|석상/.test(e.text) ? "faith" : /진입/.test(e.text) ? "research" : "nation"}.svg`}
                          alt=""
                          width="38"
                          height="38"
                        />
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
if (import.meta.env.PROD && "serviceWorker" in navigator)
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
