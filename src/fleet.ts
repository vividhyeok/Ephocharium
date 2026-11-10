import { eraOf } from "./eras";
import type { Nation } from "./engine";
import type { TransportMode } from "./livingTypes";

export function fleetEra(n: Nation, energy: number) {
  const era = eraOf(n);
  if (era < 7) return era;
  if (n.wealth < 35) return 6;
  if (era >= 9 && energy < 0.5)
    return (n.inventory?.oil ?? 0) < 0.2 ? 8 : Math.min(10, era);
  return era;
}
export function fleetProfile(
  mode: TransportMode,
  era: number,
  military = false,
) {
  if (mode === "sea" || mode === "river") {
    const stage =
      era >= 11 ? 4 : era >= 9 ? 3 : era >= 7 ? 2 : era >= 3 ? 1 : 0;
    const names = military
      ? ["전투 카누", "무장 범선", "증기 호위함", "구축함", "자동화 호위함"]
      : [
          "하천 나룻배",
          "돛 화물선",
          "증기 화물선",
          "컨테이너선",
          "자동화 화물선",
        ];
    return {
      name: names[stage],
      speed: [1.25, 1.65, 2.1, 2.65, 3.2][stage],
      cargo: [0.8, 1, 1.25, 1.65, 2][stage],
    };
  }
  if (mode === "rail")
    return era >= 11
      ? { name: "고속 자동 화물열차", speed: 5.4, cargo: 1.7 }
      : era >= 9
        ? { name: "전기 화물열차", speed: 4.5, cargo: 1.35 }
        : { name: "증기 화물열차", speed: 3.6, cargo: 1 };
  if (mode === "air")
    return era >= 12
      ? { name: "고고도 화물기", speed: 16, cargo: 1.8 }
      : era >= 11
        ? { name: "무인 화물기", speed: 13, cargo: 1.4 }
        : { name: "화물 비행기", speed: 10, cargo: 1 };
  return era >= 11
    ? { name: "자동화 전기 화물차", speed: 3, cargo: 1.55 }
    : era >= 7
      ? { name: "화물 트럭", speed: 2, cargo: 1.2 }
      : era >= 3
        ? { name: "화물 수레", speed: 1.25, cargo: 1 }
        : { name: "운반대", speed: 1, cargo: 0.75 };
}
