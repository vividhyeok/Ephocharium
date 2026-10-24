export const MATERIALS = [
  "food",
  "timber",
  "stone",
  "clay",
  "copper",
  "iron",
  "coal",
  "oil",
  "gold",
  "metal",
] as const;
export type Material = (typeof MATERIALS)[number];
export type Inventory = Record<Material, number>;
export const emptyStock = (): Inventory =>
  Object.fromEntries(MATERIALS.map((k) => [k, 0])) as Inventory;
export const MATERIAL_NAMES: Record<Material, string> = {
  food: "식량",
  timber: "목재",
  stone: "석재",
  clay: "점토",
  copper: "구리",
  iron: "철광석",
  coal: "석탄",
  oil: "석유",
  gold: "귀금속",
  metal: "가공 금속",
};
export type Cohorts = [number, number, number];
export interface Demography {
  cohorts: Cohorts;
  births: number;
  deaths: number;
  birthRate: number;
  deathRate: number;
  fertility: number;
  lifeExpectancy: number;
  adultLongevity: number;
  pressure: number;
  migration: number;
  capacity: number;
  total: number;
}
export type CityRole =
  | "farm"
  | "mine"
  | "industry"
  | "port"
  | "faith"
  | "capital"
  | "research"
  | "junction";
export interface CityData {
  operation?: number;
  neglect?: number;
  lifecycle?: "active" | "declining" | "ruin" | "recovering";
  stock: Inventory;
  cohorts: Cohorts;
  roles: CityRole[];
  capacity: number;
  pressure: number;
  water: number;
  sanitation: number;
  medicine: number;
  education: number;
  pollution: number;
  damage: number;
  port: number;
  portTile: number;
  station: number;
  logistics: number;
  temple: number;
  mined: number;
  produced: number;
  imported: number;
  exported: number;
  growth: number;
  births: number;
  deaths: number;
  lifeExpectancy: number;
  fertility: number;
  builtEra: number;
  legacyBuildings: number;
  influence: number[];
  causes: { key: string; value: number; effect: number; label: string }[];
}
export interface Culture {
  id: number;
  shares: number[];
  faith: number;
  cohesion: number;
  devotion: number;
  secular: number;
  reignSince: number;
  general: string;
  religiousLeader: string;
  deeds: string[];
  baseName: string;
  official: string;
  legacy: boolean;
}
export type TransportMode = "road" | "rail" | "river" | "sea" | "air";
export interface TransportRoute {
  id: number;
  from: number;
  to: number;
  mode: TransportMode;
  path: number[];
  capacity: number;
  delivered: number;
  blocked: boolean;
  built: number;
}
export interface Vehicle {
  targetTile?: number;
  id: number;
  route: number;
  mode: TransportMode;
  nation: number;
  targetNation: number;
  from: number;
  to: number;
  path: number[];
  progress: number;
  previousProgress: number;
  cargo: Partial<Inventory>;
  people?: Cohorts;
  purpose:
    | "trade"
    | "migration"
    | "escort"
    | "landing"
    | "support"
    | "airlift"
    | "colonize";
  strength: number;
  returning: boolean;
}
export interface Monument {
  id: number;
  tile: number;
  nation: number;
  culture: number;
  faith: number;
  kind: "founding" | "temple" | "statue" | "memorial" | "ruin";
  year: number;
  condition: number;
  reason: string;
  preservedBy?: number;
}
export interface LivingState {
  projects?: {
    id: number;
    nation: number;
    city: number;
    tile: number;
    kind: "reclamation" | "irrigation";
    started: number;
    progress: number;
    duration: number;
    status: "building" | "complete" | "abandoned";
  }[];
  revision: 5;
  geographyRevision: number;
  nextId: number;
  routes: TransportRoute[];
  vehicles: Vehicle[];
  monuments: Monument[];
  trade: number;
  migrants: number;
  births: number;
  deaths: number;
  landRevision: number;
  lastNetwork: number;
  lostCargo: number;
}
