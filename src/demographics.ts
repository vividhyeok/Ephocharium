import type { CityData, Cohorts, Demography } from "./livingTypes";
export const sum = (a: Cohorts) => a[0] + a[1] + a[2];
export function demographicYear(
  u: CityData,
  era: number,
  stability: number,
  war: boolean,
  plague: number,
) {
  const total = sum(u.cohorts),
    foodRatio = u.stock.food / Math.max(1, total * 0.22),
    nutrition = Math.min(1, foodRatio),
    water = u.water,
    pressure = Math.max(0, total / Math.max(10, u.capacity) - 1);
  u.pressure = pressure;
  const health = Math.max(
    0.05,
    Math.min(
      1,
      nutrition * 0.27 +
        water * 0.18 +
        u.sanitation * 0.22 +
        u.medicine * 0.23 +
        stability * 0.1 -
        pressure * 0.15 -
        u.pollution * 0.1 -
        plague * 0.3 -
        (war ? 0.12 : 0),
    ),
  );
  const infantDeath = 0.65 * (1 - health) + 0.01,
    adultMortality =
      0.0025 + (1 - health) * 0.008 + (war ? 0.002 : 0) + plague * 0.007;
  const adultLongevity = Math.max(
    48,
    Math.min(94, 55 + health * 32 - u.pollution * 5),
  );
  u.lifeExpectancy = Math.max(
    22,
    Math.min(
      89,
      (1 - infantDeath) * adultLongevity - infantDeath * 16 - pressure * 4,
    ),
  );
  u.fertility = Math.max(
    1.25,
    Math.min(
      6.2,
      5.8 -
        u.education * 3.5 -
        u.medicine * 0.9 -
        Math.max(0, era - 7) * 0.08 -
        pressure * 0.8 +
        (stability > 0.65 ? 0.15 : 0),
    ),
  );
  const potential = (u.cohorts[1] * 0.48 * u.fertility) / 32;
  const births =
      potential *
      (1 - infantDeath) *
      (war ? 0.82 : 1) *
      Math.max(0.25, 1 - pressure * 0.35),
    deaths =
      u.cohorts[0] * (0.002 + infantDeath * 0.02) +
      u.cohorts[1] * adultMortality +
      u.cohorts[2] / Math.max(9, adultLongevity - 65) +
      (foodRatio < 0.6 ? total * (0.6 - foodRatio) * 0.04 : 0);
  const childToAdult = u.cohorts[0] / 18,
    adultToOld = u.cohorts[1] / 47;
  const childLoss = u.cohorts[0] * (0.002 + infantDeath * 0.02),
    adultLoss = u.cohorts[1] * adultMortality,
    elderLoss = u.cohorts[2] / Math.max(9, adultLongevity - 65),
    starvation = foodRatio < 0.6 ? (0.6 - foodRatio) * 0.04 : 0;
  u.cohorts = [
    Math.max(0, u.cohorts[0] - childToAdult - childLoss + births) *
      (1 - starvation),
    Math.max(0, u.cohorts[1] + childToAdult - adultToOld - adultLoss) *
      (1 - starvation),
    Math.max(0, u.cohorts[2] + adultToOld - elderLoss) * (1 - starvation),
  ];
  u.births = births;
  u.deaths = deaths;
  u.stock.food = Math.max(0, u.stock.food - total * 0.22);
  return { births, deaths, adultLongevity };
}
export const emptyDemography = (): Demography => ({
  cohorts: [0, 0, 0],
  births: 0,
  deaths: 0,
  birthRate: 0,
  deathRate: 0,
  fertility: 0,
  lifeExpectancy: 0,
  adultLongevity: 0,
  pressure: 0,
  migration: 0,
  capacity: 0,
  total: 0,
});
