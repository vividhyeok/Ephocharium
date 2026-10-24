import { create } from "zustand";
interface UI {
  tool: string;
  category: string;
  radius: number;
  speed: number;
  paused: boolean;
  political: boolean;
  observe: boolean;
  set: (p: Partial<UI>) => void;
}
export const useUI = create<UI>((set) => ({
  tool: "inspect",
  category: "생명",
  radius: 1,
  speed: 1,
  paused: false,
  political: true,
  observe: false,
  set,
}));
