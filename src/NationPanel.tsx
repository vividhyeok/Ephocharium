import { useEffect, useRef } from "react";
import type { Nation, World } from "./engine";
import { eraOf, ERAS } from "./eras";
import { CULTURES, FAITHS } from "./culture";
import { MATERIALS, MATERIAL_NAMES } from "./livingTypes";
import { developmentGate } from "./progression";
import { skylineSvg } from "./art";
import Icon from "./Icons";
const ROLE_NAMES = {
  farm: "농업",
  mine: "광업",
  industry: "산업",
  port: "항구",
  faith: "신앙",
  capital: "수도",
  research: "연구",
  junction: "교통",
};
export default function NationPanel({
  world: w,
  nation: n,
  onClose,
  onHistory,
  onFocus,
  onDetail,
  onFront,
}: {
  world: World;
  nation: Nation;
  onClose: () => void;
  onHistory: () => void;
  onFocus: (tile: number) => void;
  onDetail: () => void;
  onFront: () => void;
}) {
  const mini = useRef<HTMLCanvasElement>(null);
  const cities = w.life?.settlements.filter((c) => c.nation === n.id) || [],
    primary = cities.find((c) => c.tile === n.capital) || cities[0],
    u = primary?.urban,
    e = eraOf(n),
    d = n.demography,
    cohorts = d?.cohorts || u?.cohorts || [0, 0, 0],
    culture = n.culture,
    armies = w.life?.armies.filter((a) => a.nation === n.id) || [],
    flights =
      (w.life?.flights.filter((f) => f.nation === n.id).length || 0) +
      (w.living?.vehicles.filter((v) => v.nation === n.id && v.mode === "air")
        .length || 0);
  const scene = skylineSvg({
    era: e,
    culture: culture?.id || 0,
    population: n.population,
    farm: cities.some((c) => c.urban?.roles.includes("farm")) ? 1 : 0,
    mine: cities.some((c) => c.urban?.roles.includes("mine")) ? 1 : 0,
    industry: cities.reduce((s, c) => s + (c.industry || 0), 0),
    port: cities.reduce((s, c) => s + (c.urban?.port || 0), 0),
    faith: cities.reduce((s, c) => s + (c.urban?.temple || 0), 0),
    war: armies.length,
    research: cities.some((c) => c.urban?.roles.includes("research")) ? 1 : 0,
    river: !!w.tiles[n.capital]?.river,
    damage: u?.damage || 0,
  });
  useEffect(() => {
    const el = mini.current;
    if (!el) return;
    el.width = w.width;
    el.height = w.height;
    const ctx = el.getContext("2d")!;
    w.tiles.forEach((t, i) => {
      ctx.fillStyle =
        t.owner === n.id ? n.color : t.t === 0 ? "#477c86" : "#526d60";
      ctx.fillRect(i % w.width, Math.floor(i / w.width), 1, 1);
      if (t.river) {
        ctx.fillStyle = "#8dc4c2";
        ctx.fillRect(i % w.width, Math.floor(i / w.width), 1, 1);
      }
      if (t.rail) {
        ctx.fillStyle = "#e5d5a4";
        ctx.fillRect(i % w.width, Math.floor(i / w.width), 1, 1);
      }
    });
    for (const c of cities) {
      ctx.fillStyle = c.urban?.port ? "#bad8ca" : "#f4e7ae";
      ctx.fillRect(
        (c.tile % w.width) - 1,
        Math.floor(c.tile / w.width) - 1,
        2,
        2,
      );
    }
  }, [w, n.id]);
  const life = d?.lifeExpectancy || u?.lifeExpectancy || 0,
    total = cohorts.reduce((s, v) => s + v, 0) || 1;
  return (
    <aside className="nation-panel illustrated-nation">
      <button className="close" aria-label="국가 정보 닫기" onClick={onClose}>
        <Icon name="close" />
      </button>
      <figure className="nation-skyline">
        <img
          src={"data:image/svg+xml;charset=utf-8," + encodeURIComponent(scene)}
          alt={`${n.name}의 실제 시대·문화·도시 역할을 반영한 풍경`}
        />
        <figcaption>
          <span className="era-label">{ERAS[e].name}</span>
          <h2 style={{ color: n.color }}>{n.name}</h2>
          <small>
            {culture
              ? CULTURES[culture.id].name + " 문화권 · " + culture.official
              : "문화 관측 중"}{" "}
            ·{" "}
            {w.relations.some((r) => r.war && (r.a === n.id || r.b === n.id))
              ? "전쟁 중"
              : n.stability < 0.4
                ? "회복이 필요한 세계"
                : "살아가는 문명"}
          </small>
        </figcaption>
      </figure>
      <div className="nation-actions"><button onClick={onDetail}><Icon name="inspect"/> 도시 가까이 보기</button><button onClick={onHistory}><Icon name="history"/> 외교와 전체 역사</button></div>
      <div className="nation-grid illustrated-metrics">
        <span>
          <img src="/art/objects/population.svg" alt="" />
          인구<b>{Math.round(n.population).toLocaleString()}명</b>
          <small>
            출생 {d?.birthRate.toFixed(1) || 0} · 사망{" "}
            {d?.deathRate.toFixed(1) || 0} / 천 명
          </small>
        </span>
        <span>
          <img src="/art/objects/health.svg" alt="" />
          출생 기대수명<b>{life.toFixed(1)}년</b>
          <small>성인 생존자 {d?.adultLongevity.toFixed(1) || 0}년</small>
        </span>
        <span>
          <img src="/art/objects/land.svg" alt="" />
          영토<b>{n.territory}개 구역</b>
          <small>부양 압력 {Math.round((d?.pressure || 0) * 100)}%</small>
        </span>
      </div>
      <section className="cohort-card">
        <img src="/art/objects/demography.svg" alt="" />
        <div>
          <b>인구의 생애</b>
          <div className="cohort-bar">
            {cohorts.map((v, k) => (
              <i key={k} style={{ width: (v / total) * 100 + "%" }} />
            ))}
          </div>
          <small>
            유소년 {Math.round((cohorts[0] / total) * 100)}% · 생산연령{" "}
            {Math.round((cohorts[1] / total) * 100)}% · 고령{" "}
            {Math.round((cohorts[2] / total) * 100)}% · 출산{" "}
            {d?.fertility.toFixed(2) || u?.fertility.toFixed(2) || 0}
          </small>
        </div>
      </section>
      <section className="nation-causes">
        <h3>이 문명이 지금 변하는 이유</h3>
        {(u?.causes || []).slice(0, 4).map((c) => (
          <article key={c.key}>
            <img
              src={`/art/objects/${{ water: "farm", mining: "mine", logistics: "transport", pressure: "population", war: "army" }[c.key] || "research"}.svg`}
              alt=""
            />
            <div>
              <b>{c.label}</b>
              <small>
                관측 {c.value.toFixed(2)} → 실제 연간 효과 {c.effect.toFixed(1)}
              </small>
            </div>
          </article>
        ))}
      </section>
      <div className="nation-mini-map">
        <canvas
          ref={mini}
          aria-label="국가의 강·도시·항만·철도 지도"
          role="button" tabIndex={0}
          onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();onFocus(n.capital);}}}
          onClick={() => onFocus(n.capital)}
        />
        <button onClick={() => onFocus(n.capital)}>수도 위치로 이동</button>
      </div>
      <section className="city-role-cards">
        {cities.slice(0, 6).map((c) => (
          <button key={c.id} onClick={() => onFocus(c.tile)}>
            <img
              src={`/art/objects/${c.urban?.port ? "port" : c.urban?.roles.includes("industry") ? "industry" : c.urban?.roles.includes("mine") ? "mine" : c.urban?.temple ? "faith" : "farm"}.svg`}
              alt=""
            />
            <b>{c.name}</b>
            <small>
              {c.urban?.roles.map((r) => ROLE_NAMES[r]).join(" · ")} ·{" "}
              {Math.round(c.population).toLocaleString()}명
            </small>
          </button>
        ))}
      </section>
      <section className="stock-gallery">
        {MATERIALS.map((k) => (
          <div key={k}>
            <img src={`/art/objects/${k}.svg`} alt="" />
            <span>{MATERIAL_NAMES[k]}</span>
            <b>{Math.floor(n.inventory?.[k] || 0).toLocaleString()}</b>
          </div>
        ))}
      </section>
      <div className="civilization-card">
        <p>{ERAS[e].description}</p>
        <small>
          {developmentGate(w, n) || "경제·교류·교육에 따라 연구 진행 중"}
        </small>
        <div className="era-progress">
          <i
            style={{
              width:
                Math.min(
                  100,
                  e === 13
                    ? 100
                    : ((n.tech - ERAS[e].threshold) /
                        (ERAS[e + 1].threshold - ERAS[e].threshold)) *
                        100,
                ) + "%",
            }}
          />
        </div>
      </div>
      <section className="culture-card">
        <img src="/art/objects/temple.svg" alt="" />
        <div>
          <b>{culture ? FAITHS[culture.faith].name : "신앙 관측 중"}</b>
          <small>
            공동체 결속 {Math.round((culture?.cohesion || 0) * 100)}% · 성소{" "}
            {cities.reduce((s, c) => s + (c.urban?.temple || 0), 0)}곳
          </small>
          <small>
            {n.leader} · {Math.floor(n.age)}세 ·{" "}
            {culture?.reignSince ?? n.foundedYear ?? 0}년부터 재위
          </small>
        </div>
      </section>
      <div className="city-activity">
        <span>
          주민 {w.life?.citizens.filter((c) => c.nation === n.id).length || 0}개
          집단
        </span>
        <span>군대 {armies.length}개 부대</span>
        <span>항공기 {flights}대</span>
      </div>
      {armies.length > 0 && (
        <button className="front-action" onClick={onFront}>
          전선 가까이 보기
        </button>
      )}
      <details>
        <summary>정확한 수치와 발전 기록</summary>
        <p>
          {n.foundedYear === undefined
            ? "건국 시점 미상"
            : n.foundedYear + "년 건국"}{" "}
          · 최대 영토 {n.peak} · 기술 {n.tech.toFixed(2)} · 안정{" "}
          {Math.round(n.stability * 100)}%
        </p>
        <p>
          장군 {culture?.general} · 신앙 지도자 {culture?.religiousLeader}
        </p>
        {culture?.deeds.map((text, i) => (
          <p key={i}>{text}</p>
        ))}
      </details>
      <section className="pictured-history">
        {w.history
          .filter((h) => h.nations.includes(n.id) && h.importance === "major")
          .slice(-4)
          .reverse()
          .map((h, i) => (
            <button
              key={h.id || i}
              onClick={() => h.tile !== undefined && onFocus(h.tile)}
            >
              <img
                src={`/art/objects/${/전쟁|점령/.test(h.text) ? "war" : /진입/.test(h.text) ? "research" : "nation"}.svg`}
                alt=""
              />
              <span>
                <small>{h.year}년</small>
                {h.text}
              </span>
            </button>
          ))}
      </section>
    </aside>
  );
}
