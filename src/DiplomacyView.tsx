import { useState } from "react";
import type { World } from "./engine";
import { TREATY_LABELS } from "./diplomacy";
import Icon from './Icons';

export default function DiplomacyView({
  world,
  compact = false,
  onOpen,
}: {
  world: World;
  compact?: boolean;
  onOpen?: () => void;
}) {
  const [filter, setFilter] = useState<"all" | "war" | "alliance" | "colony">("all");
  const active = world.relations.filter((r) => r.war || r.allied || r.subject);
  const name = (id: number) => world.nations[id - 1]?.name || "사라진 국가";
  if (compact)
    return (
      <div className="diplomacy-summary" aria-label="외교 현황">
        {(["war", "alliance", "subject"] as const).map((kind) => {
          const list = active.filter((r) =>
            kind === "war" ? r.war : kind === "alliance" ? r.allied : !!r.subject,
          );
          return (
            <div className="diplomacy-status" key={kind}>
              <button onClick={onOpen}>
                <Icon name={kind === 'war' ? 'war' : kind === 'alliance' ? 'alliance' : 'protect'} size={16}/>
                {kind === "war" ? "전쟁" : kind === "alliance" ? "동맹" : "종속국"} <b>{list.length}</b>
              </button>
              <div className="diplomacy-preview" role="tooltip">
                <strong>
                  {kind === "war" ? "진행 중인 전쟁" : kind === "alliance" ? "유효한 상호 방위 조약" : "조공과 외교 종속 관계"}
                </strong>
                {list.length ? (
                  list.map((r) => (
                    <p key={`${r.a}-${r.b}`}>
                      {name(r.a)} · {name(r.b)}
                      <small>
                        {kind === "war" ? r.since : kind === "alliance" ? r.allianceSince : r.subjectSince}년부터 ·{" "}
                        {r.reason || "이전 저장에 상세 원인 기록이 없습니다."}
                      </small>
                    </p>
                  ))
                ) : (
                  <p>현재 해당 관계가 없습니다.</p>
                )}
                <small>선택하면 외교 연표를 열 수 있습니다.</small>
              </div>
            </div>
          );
        })}
      </div>
    );
  const events = (world.diplomacyLog || [])
    .filter((e) => filter === "all" || e.kind === filter || (filter === "colony" && ["raid", "subjugation", "independence"].includes(e.kind)))
    .slice()
    .reverse();
  return (
    <section className="diplomacy-view">
      <h3>외교 관측실</h3>
      <p className="muted">
        지도 위 상태와 조약이 만들어진 이유를 함께 읽습니다. 동맹은 자원·기술
        교류와 접경국의 방어 참전으로 이어집니다.
      </p>
      <div className="diplomacy-filters">
        {(["all", "war", "alliance", "colony"] as const).map((f) => (
          <button
            key={f}
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
          >
            {f === "all" ? "전체 기록" : f === "war" ? "전쟁" : f === "alliance" ? "동맹" : "약탈·종속"}
          </button>
        ))}
      </div>
      <div className="treaty-grid">
        {active.map((r) => (
          <details key={`${r.a}-${r.b}`}>
            <summary>
              <span>{r.war ? "전쟁 중" : r.subject ? "종속 관계" : "동맹 중"}</span>
              <b>
                {name(r.a)} · {name(r.b)}
              </b>
            </summary>
            <p>
              {r.reason || "이전 저장의 상세 원인은 기록되어 있지 않습니다."}
            </p>
            <small>
              {r.war ? r.since : r.subject ? r.subjectSince : r.allianceSince}년부터 · 신뢰{" "}
              {Math.round(r.score * 100)}
            </small>
            <ol>
              {(world.diplomacyLog || [])
                .filter((e) => e.a === r.a && e.b === r.b)
                .map((e) => (
                  <li key={e.id}>
                    <b>
                      {e.year}년 · {TREATY_LABELS[e.kind]}
                    </b>
                    <p>{e.reason}</p>
                  </li>
                ))}
            </ol>
          </details>
        ))}
      </div>
      <h3>외교 연표</h3>
      <ol className="diplomacy-timeline">
        {events.map((e) => (
          <li key={e.id}>
            <time>{e.year}년</time>
            <div>
              <strong>
                {TREATY_LABELS[e.kind]} · {name(e.a)} / {name(e.b)}
              </strong>
              <p>{e.reason}</p>
              {e.actor && <small>행위 주체: {name(e.actor)}</small>}
            </div>
          </li>
        ))}
      </ol>
      {!events.length && (
        <p className="muted">
          아직 기록된 외교 사건이 없습니다. 교역과 국경 접촉이 쌓이면 관계가
          형성됩니다.
        </p>
      )}
    </section>
  );
}
