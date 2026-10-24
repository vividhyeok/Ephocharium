import { tileStamp, DYNAMIC_TILE_FIELDS, type TilePatch } from "./wire";
import { ensureLiving, reconcileLiving } from "./living";
import { buildGeography } from "./geography";
import { generate, apply, validate, type World } from "./engine";
import { refreshLife } from "./civilization";
import { upgradeWorld } from "./cartography";
import { initializeDiplomacy } from "./diplomacy";
import { prepareProgress } from "./progression";
import { advanceClock, QUANTUM_MS } from "./time";
import { intervene } from "./intervention";
let world: World | undefined, undo: World | undefined;
let epoch = 0;
let lastTool = "";
let speed = 1,
  paused = false,
  stroke = false;
let lastEpoch = -1,
  lastGeography = -1,
  stamps: string[] = [];
function send(notice?: string) {
  if (!world) return;
  if (
    lastEpoch !== epoch ||
    lastGeography !== world.living?.geographyRevision
  ) {
    stamps = world.tiles.map(tileStamp);
    lastEpoch = epoch;
    lastGeography = world.living?.geographyRevision || 0;
    self.postMessage({ world, canUndo: !!undo, notice, epoch });
    return;
  }
  const patches: TilePatch[] = [];
  world.tiles.forEach((t, index) => {
    const stamp = tileStamp(t);
    if (stamp !== stamps[index]) {
      patches.push({ index, values: DYNAMIC_TILE_FIELDS.map((k) => t[k]) });
      stamps[index] = stamp;
    }
  });
  const { tiles, ...meta } = world;
  self.postMessage({ meta, patches, canUndo: !!undo, notice, epoch });
}
function checkpoint() {
  undo = structuredClone(world);
}
self.onmessage = ({ data }) => {
  if (data.type === "generate") {
    epoch++;
    world = generate(data.options);
    undo = undefined;
    send();
  }
  if (data.type === "load" && validate(data.world)) {
    epoch++;
    world = upgradeWorld(data.world);
    prepareProgress(world);
    initializeDiplomacy(world);
    ensureLiving(world);
    if (!world.life) refreshLife(world);
    undo = undefined;
    send();
  }
  if (data.type === "speed" && [1, 2, 5, 10, 20].includes(data.speed))
    speed = data.speed;
  if (data.type === "pause") {
    paused = !!data.paused;
    self.postMessage({ clockPhase: world?.clockPhase, canUndo: !!undo, epoch });
  }
  if (!world) return;
  if (data.type === "begin") {
    checkpoint();
    stroke = true;
  }
  if (data.type === "end") {
    stroke = false;
    if (
      world.living &&
      ["land", "ocean", "mountain", "forest"].includes(data.tool || lastTool)
    ) {
      buildGeography(world);
      world.renderRevision = (world.renderRevision || 0) + 1;
      send();
    }
  }
  if (data.type === "apply") {
    if (!stroke) checkpoint();
    lastTool = data.tool;
    apply(world, data.tool, data.tile, data.radius);
    refreshLife(world);
    ensureLiving(world);
    reconcileLiving(world);
    world.renderRevision = (world.renderRevision || 0) + 1;
    send();
  }
  if (data.type === "intervene") {
    checkpoint();
    const notice = intervene(world, data.a, data.b, data.action);
    world.renderRevision = (world.renderRevision || 0) + 1;
    send(notice);
  }
  if (data.type === "undo" && undo) {
    epoch++;
    world = undo;
    undo = undefined;
    stroke = false;
    send("직전 개입 직전의 세계로 복원했습니다.");
  }
};
setInterval(() => {
  if (world && !paused && !stroke && advanceClock(world, speed)) {
    send();
  }
}, QUANTUM_MS);
