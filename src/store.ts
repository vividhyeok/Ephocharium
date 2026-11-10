import { create } from "zustand";
interface UI {
  tool: string;
  category: string;
  radius: number;
  speed: number;
  paused: boolean;
  political: boolean;
  labels: boolean;
  cities: boolean;
  diplomacy: boolean;
  observe: boolean;
  set: (p: Partial<UI>) => void;
}
function playback() {
  try {
    const speed = Number(sessionStorage.getItem("epocharium-speed"));
    return {
      paused: sessionStorage.getItem("epocharium-paused") === "1",
      speed: [1, 2, 5, 10, 20].includes(speed) ? speed : 5,
    };
  } catch {
    return { paused: false, speed: 5 };
  }
}
export const useUI = create<UI>((set) => ({
  tool: "inspect",
  category: "생명",
  radius: 1,
  ...playback(),
  political: true,
  labels: true,
  cities: false,
  diplomacy: true,
  observe: true,
  set: (p) => {
    set(p);
    try {
      if (p.speed !== undefined)
        sessionStorage.setItem("epocharium-speed", String(p.speed));
      if (p.paused !== undefined)
        sessionStorage.setItem("epocharium-paused", p.paused ? "1" : "0");
    } catch {
      /* Playback works without browser storage. */
    }
  },
}));
