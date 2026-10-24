import { openDB } from "idb";
import { validate, type World } from "./engine";
const db = () =>
  openDB("epocharium", 1, {
    upgrade(db) {
      db.createObjectStore("worlds");
    },
  });
export async function save(slot: string, world: World) {
  await (await db()).put("worlds", { world, date: Date.now() }, slot);
}
export async function load(slot: string) {
  const entry = await (await db()).get("worlds", slot);
  if (entry && !validate(entry.world))
    throw new Error("올바르지 않은 저장 데이터입니다");
  return entry?.world as World | undefined;
}
export async function slots() {
  const d = await db();
  return Promise.all(
    (await d.getAllKeys("worlds")).map(async (key) => ({
      key: String(key),
      ...(await d.get("worlds", key)),
    })),
  );
}
export async function remove(slot: string) {
  await (await db()).delete("worlds", slot);
}
