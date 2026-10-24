export const ICON_NAMES = [
  "inspect",
  "human",
  "population",
  "erase",
  "land",
  "ocean",
  "mountain",
  "forest",
  "rain",
  "resource",
  "fire",
  "meteor",
  "plague",
  "flood",
  "nation",
  "aid",
  "war",
  "peace",
  "alliance",
  "revolt",
  "protect",
  "eye",
  "history",
  "plus",
  "minus",
  "fit",
  "save",
  "help",
  "play",
  "pause",
  "world",
  "nature",
  "settings",
  "close",
  "arrow",
  "chevron",
  "compass",
  "life",
] as const;
export type IconName = (typeof ICON_NAMES)[number];
export default function Icon({
  name,
  size = 18,
}: {
  name: IconName;
  size?: number;
}) {
  return (
    <img
      src={`/art/objects/${name}.svg`}
      width={size}
      height={size}
      aria-hidden="true"
      className="pixel-icon"
      alt=""
    />
  );
}
