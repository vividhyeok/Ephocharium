export type Observation = {
  seed: number;
  year: number;
  name: string;
  population: number;
  territory: number;
  wars: number;
  rule: string;
  era: string;
  food?: number;
  reason?: string;
};
export const baselineKey = "epocharium-observation-baseline";
export function readBaseline(): Observation | null {
  try {
    const b = JSON.parse(localStorage.getItem(baselineKey) || "null");
    if (
      !b ||
      [b.name, b.rule, b.era].some(
        (v) => typeof v !== "string" || v.length > 300,
      ) ||
      ![b.seed, b.year, b.population, b.territory, b.wars].every(
        Number.isFinite,
      )
    )
      return null;
    return {
      seed: b.seed,
      year: b.year,
      name: b.name,
      population: b.population,
      territory: b.territory,
      wars: b.wars,
      rule: b.rule,
      era: b.era,
      food: Number.isFinite(b.food) && b.food >= 0 ? b.food : undefined,
      reason: typeof b.reason === "string" ? b.reason.slice(0, 300) : undefined,
    };
  } catch {
    return null;
  }
}
