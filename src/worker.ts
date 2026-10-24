import { generate, apply, validate, type World } from "./engine";
import { refreshLife } from "./civilization";
import { upgradeWorld } from "./cartography";
import { initializeDiplomacy } from "./diplomacy";
import { prepareProgress } from "./progression";
import { advanceClock, QUANTUM_MS } from "./time";
import { intervene } from "./intervention";
let world: World | undefined, undo: World | undefined;
let epoch = 0;
let speed = 1,
  paused = false,
  stroke = false;
function send(notice?: string) {
  self.postMessage({ world, canUndo: !!undo, notice, epoch });
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
  if (data.type === "end") stroke = false;
  if (data.type === "apply") {
    if (!stroke) checkpoint();
    apply(world, data.tool, data.tile, data.radius);
    refreshLife(world);
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
