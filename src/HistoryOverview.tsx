import { useEffect, useRef, useState } from "react";
import type { World } from "./engine";
import { ERAS, eraOf } from "./eras";
import { expandAtlas } from "./history";
export default function HistoryOverview({ world: w }: { world: World }) {
  const canvas = useRef<HTMLCanvasElement>(null),
    [index, setIndex] = useState(0);
  const atlas = w.atlases?.[index];
  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    el.width = w.width;
    el.height = w.height;
    const ctx = el.getContext("2d")!;
    const past = atlas ? expandAtlas(atlas) : [];
    for (let i = 0; i < w.tiles.length; i++) {
      const t = w.tiles[i],
        changed = past.length && past[i] !== t.owner;
      ctx.fillStyle =
        t.t === 0
          ? "#397d89"
          : t.owner
            ? w.nations[t.owner - 1]?.color || "#9caf78"
            : "#617e67";
      ctx.fillRect(i % w.width, Math.floor(i / w.width), 1, 1);
      if (changed) {
        ctx.fillStyle = "#fff2bd";
        ctx.fillRect(i % w.width, Math.floor(i / w.width), 1, 1);
      }
    }
  }, [w, atlas]);
  const alive = w.nations.filter((n) => n.alive),
    oldest = [...alive]
      .sort((a, b) => (a.foundedYear ?? w.year) - (b.foundedYear ?? w.year))
      .slice(0, 3),
    recent = [...alive]
      .sort((a, b) => (b.foundedYear ?? 0) - (a.foundedYear ?? 0))
      .slice(0, 3);
  return (
    <section className="history-overview">
      <h3>문명의 긴 흐름</h3>
      <div className="history-summaries">
        {w.chronicle
          ?.slice(-12)
          .reverse()
          .map((c) => (
            <p key={c.from}>
              <b>
                {c.from}–{Math.min(w.year, c.to)}년
              </b>
              <span>
                건국 {c.foundings} · 멸망 {c.falls} · 전쟁 {c.wars} · 시대 변화{" "}
                {c.advances}
              </span>
            </p>
          ))}
      </div>
      <details>
        <summary>시대별 문명 변화 요약</summary>
        <p>
          저장된 발전 발자취와 현재 관측을 집계합니다. 이전 저장에서 누락된 과거
          시대는 추정하지 않습니다.
        </p>
        {ERAS.map((era, index) => {
          const experienced = w.nations.filter((n) =>
            n.eraHistory?.some((e) => e.era === index),
          );
          const years = experienced.flatMap((n) =>
            n.eraHistory!.filter((e) => e.era === index).map((e) => e.year),
          );
          const current = alive.filter((n) => eraOf(n) === index).length;
          if (!experienced.length && !current) return null;
          return (
            <p key={era.name}>
              <b>{era.name}</b> · 첫 관측{" "}
              {years.length ? Math.min(...years) + "년" : "시점 미상"} · 경험
              기록 {experienced.length}개 국가 · 현재 {current}개 국가
            </p>
          );
        })}
      </details>
      <details>
        <summary>국가의 전성기와 발전 발자취</summary>
        <p>
          오래 이어진 국가:{" "}
          {oldest
            .map(
              (n) =>
                `${n.name} (${n.foundedYear === undefined ? "기간 미상" : Math.max(0, w.year - n.foundedYear) + "년"})`,
            )
            .join(" · ")}
        </p>
        <p>최근 등장: {recent.map((n) => n.name).join(" · ")}</p>
        {w.nations.map((n) => {
          const sample =
            [...n.samples].reverse().find((s) => s.year <= w.year - 100) ||
            n.samples[0];
          return (
            <article key={n.id}>
              <strong style={{ color: n.color }}>
                {n.name} · {ERAS[eraOf(n)].name}
              </strong>
              <p>
                최대 영토 {n.peak}개 ·{" "}
                {n.peakYear === undefined
                  ? "전성기 시점 미상"
                  : n.peakYear + "년 전성기"}{" "}
                ·{" "}
                {sample
                  ? `${sample.year}년 대비 영토 ${n.territory - sample.territory >= 0 ? "+" : ""}${n.territory - sample.territory}개`
                  : "영토 표본 수집 중"}
              </p>
              <small>
                {n.eraHistory?.map((e, i) => (
                  <span key={i}>
                    {i ? " → " : ""}
                    {e.year}년 {ERAS[e.era]?.name}
                  </span>
                ))}
              </small>
            </article>
          );
        })}
      </details>
      <details>
        <summary>과거와 현재의 영토 비교</summary>
        {w.atlases?.length ? (
          <>
            <label>
              비교 시점{" "}
              <select
                value={Math.min(index, w.atlases.length - 1)}
                onChange={(e) => setIndex(+e.target.value)}
              >
                {w.atlases.map((a, i) => (
                  <option key={a.year} value={i}>
                    {a.year}년
                  </option>
                ))}
              </select>
            </label>
            <p className="muted">
              현재 국가 색 위의 밝은 구역은 선택 시점 이후 소유국이 바뀐
              땅입니다. 최근 8회, 100년 간격의 관측을 보관합니다.
            </p>
          </>
        ) : (
          <p>
            100년마다 첫 비교 지도를 기록합니다. 이전 저장의 과거 영토는 소급해
            만들지 않습니다.
          </p>
        )}
        <canvas
          ref={canvas}
          aria-label="과거와 현재 영토 변화 비교 지도"
          style={{
            width: "100%",
            imageRendering: "pixelated",
            borderRadius: 8,
          }}
        />
      </details>
    </section>
  );
}
