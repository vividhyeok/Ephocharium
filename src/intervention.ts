import { neighbors, type World } from "./engine";
import { getRelation, treaty } from "./diplomacy";
import { refreshLife } from "./civilization";
export function intervene(
  w: World,
  a: number,
  b: number,
  action: "war" | "alliance" | "peace",
) {
  const one = w.nations[a - 1],
    two = w.nations[b - 1];
  if (a === b || !one?.alive || !two?.alive)
    return "서로 다른 생존 국가 두 곳을 선택하세요.";
  const relation = getRelation(w, a, b);
  treaty(
    w,
    relation,
    action,
    `관찰자가 ${one.name}과 ${two.name} 사이의 ${action === "war" ? "개전" : action === "alliance" ? "상호 방위·교류 조약" : "휴전"}을 중재했습니다.`,
    action === "war" ? a : undefined,
  );
  refreshLife(w);
  const border = w.tiles.some(
    (t, i) =>
      t.owner === a && neighbors(w, i).some((j) => w.tiles[j].owner === b),
  );
  return `${one.name} · ${two.name}: ${action === "war" ? "전쟁" : action === "alliance" ? "동맹" : "평화"} 적용.${action === "war" && !border ? " 접경이 없어 현재 지상군이 교전할 전선이 없습니다." : ""}`;
}
