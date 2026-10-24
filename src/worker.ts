import { generate, step, apply, validate, type World } from "./engine";
let world: World;
let speed = 1;
let paused = false;
self.onmessage = ({ data }) => {
  if (data.type === "generate") world = generate(data.options);
  if (data.type === "load" && validate(data.world)) world = data.world;
  if (data.type === "speed") speed = data.speed;
  if (data.type === "pause") paused = data.paused;
  if (data.type === "apply" && world)
    apply(world, data.tool, data.tile, data.radius);
  if (world) self.postMessage(world);
};
setInterval(() => {
  if (!world || paused) return;
  for (let i = 0; i < speed; i++) step(world);
  self.postMessage(world);
}, 500);
