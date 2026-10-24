import { useState } from "react";
import type { World, Nation } from "./engine";
import { eraOf, ERAS } from "./eras";
import { FAITHS } from "./culture";
import { politicalColors } from "./politicalColors";

export default function NationBrowser({
  world: w,
  onSelect,
}: {
  world: World;
  onSelect: (n: Nation) => void;
}) {
  const [sort, setSort] = useState("population"),
    [query, setQuery] = useState("");
  const alive = w.nations.filter((n) => n.alive),
    colors = politicalColors(w);
  const members = new Map<number, number>();
  for (const n of alive) members.set(n.id, n.id);
  const root = (id: number): number =>
    members.get(id) === id ? id : root(members.get(id)!);
  for (const r of w.relations)
    if (r.allied && !r.war && members.has(r.a) && members.has(r.b)) {
      const a = root(r.a),
        b = root(r.b);
      members.set(Math.max(a, b), Math.min(a, b));
    }
  const group = (n: Nation) =>
    sort === "alliance"
      ? root(n.id)
      : sort === "religion"
        ? (n.culture?.faith ?? -1)
        : 0;
  const metric = (n: Nation) =>
    sort === "level"
      ? n.tech
      : sort === "territory"
        ? n.territory
        : n.population;
  const ordered = alive
    .filter(
      (n) => n.name.includes(query) || n.culture?.baseName.includes(query),
    )
    .sort(
      (a, b) => group(a) - group(b) || metric(b) - metric(a) || a.id - b.id,
    );
  const groups = [...new Set(ordered.map(group))];
  const max = Math.max(1, ...alive.map(metric));
  return (
    <>
      <div className="nation-browser-controls">
        <select
          aria-label="국가 정렬 기준"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="population">인구 많은 순</option>
          <option value="level">문명 수준순</option>
          <option value="alliance">동맹별</option>
          <option value="religion">종교별</option>
          <option value="territory">영토 넓은 순</option>
        </select>
        <input
          aria-label="국가 검색"
          placeholder="국가 검색"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="kingdom-list nation-browser-list">
        {groups.map((key) => {
          const list = ordered.filter((n) => group(n) === key),
            all = alive.filter((n) => group(n) === key);
          return (
            <section key={key}>
              {(sort === "alliance" || sort === "religion") && (
                <div className="nation-group-heading">
                  <b>
                    {sort === "religion"
                      ? FAITHS[key]?.name || "미분류"
                      : all.length === 1
                        ? "독립 외교 · " +
                          (all[0].culture?.baseName || all[0].name)
                        : (w.nations[key - 1].culture?.baseName ||
                            w.nations[key - 1].name) + " 동맹망"}
                  </b>
                  <small>
                    {all.length}국 ·{" "}
                    {Math.round(
                      all.reduce((s, n) => s + n.population, 0),
                    ).toLocaleString()}
                    명
                  </small>
                </div>
              )}
              {list.map((n) => (
                <button
                  key={n.id}
                  aria-label={n.name}
                  onClick={() => onSelect(n)}
                  title={`${n.name} · ${ERAS[eraOf(n)].name} · ${FAITHS[n.culture?.faith ?? -1]?.name || "미분류"}`}
                >
                  <span
                    className="nation-rank"
                    style={{ color: colors.get(n.id) }}
                  >
                    {alive.filter((other) => metric(other) > metric(n)).length +
                      1}
                  </span>
                  <span className="kingdom-info">
                    <b>{n.culture?.baseName || n.name}</b>
                    <small>
                      Lv.{eraOf(n) + 1} ·{" "}
                      {sort === "territory"
                        ? n.territory + "구역"
                        : sort === "religion"
                          ? ERAS[eraOf(n)].name
                          : FAITHS[n.culture?.faith ?? -1]?.name}
                    </small>
                    <span className="kingdom-progress">
                      <i
                        style={{
                          width: Math.max(2, (metric(n) / max) * 100) + "%",
                          background: colors.get(n.id),
                        }}
                      />
                    </span>
                  </span>
                  <span className="kingdom-pop">
                    {Math.round(n.population).toLocaleString()}
                    <small>명</small>
                  </span>
                </button>
              ))}
            </section>
          );
        })}
        {!ordered.length && (
          <p className="empty-nations">검색 결과가 없습니다.</p>
        )}
      </div>
      {(sort === "alliance" || sort === "religion") && (
        <small className="group-note">
          {sort === "alliance"
            ? "동맹망은 간접 연결을 포함합니다. 지도 연결선에서 직접 동맹을 확인하세요."
            : "국가의 대표 종교 기준입니다."}
        </small>
      )}
    </>
  );
}
