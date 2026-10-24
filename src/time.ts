import { step, type World } from "./engine";
export const QUANTUM_MS = 100;
export const QUANTA_PER_YEAR = 40;
/** Same sequence of annual computations at every speed; saved sub-year phase. */
export function advanceClock(w: World, speed: number, quanta = 1) {
  w.clockPhase ??= 0;
  w.clockPhase += speed * quanta;
  let years = 0;
  while (w.clockPhase >= QUANTA_PER_YEAR) {
    w.clockPhase -= QUANTA_PER_YEAR;
    step(w);
    years++;
  }
  return years;
}
