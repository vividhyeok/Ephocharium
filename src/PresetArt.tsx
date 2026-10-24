import { useId } from "react";
import type { Preset } from "./engine";
/** Decorative atlas vignette; generated worlds remain seed-driven. */
export default function PresetArt({ preset }: { preset: Preset }) {
  const id = useId();
  const islands = preset === "islands";
  const empty = preset === "empty";
  const snow = preset === "war";
  return (
    <svg className="preset-art" viewBox="0 0 180 68" aria-hidden="true">
      <defs>
        <linearGradient id={id} x2="1" y2="1">
          <stop stopColor="#36747c" />
          <stop offset="1" stopColor="#24555e" />
        </linearGradient>
      </defs>
      <rect width="180" height="68" rx="6" fill={"url(#" + id + ")"} />
      {[12, 30, 48, 60].map((y) => (
        <path
          key={y}
          d={"M0 " + y + " H180"}
          stroke="#b7d4b3"
          opacity=".06"
          strokeWidth=".7"
        />
      ))}
      <g fill="#c5bf8b">
        {islands ? (
          <>
            <path d="M20 18l13-6 13 5 1 11-11 7-16-6zM70 7l15 1 8 10-5 9-18-4-5-9zM111 31l21-8 13 13-6 15-19 1-10-10zM51 46l14-8 16 4 4 13-16 9-20-7z" />
            <path d="M152 9l12 5-1 9-10 3-8-9z" />
          </>
        ) : (
          <path d="M-5 9L23 5 38 12 59 7 74 14 99 9 115 20 143 15 159 24 181 23 186 49 164 54 146 48 130 61 107 54 85 62 66 54 47 58 26 46 5 51z" />
        )}
      </g>
      <g fill={snow ? "#9da98b" : "#91aa70"} transform="translate(0,-2)">
        {islands ? (
          <>
            <path d="M23 20l11-4 8 5-3 7-8 3-8-5zM72 12l10-1 5 8-6 4-10-4zM117 35l14-7 9 10-7 10-13-1zM55 48l11-6 12 4 1 8-11 6-14-6z" />
          </>
        ) : (
          <path d="M-5 13L22 10 39 17 60 12 75 19 98 15 113 26 142 20 155 31 180 28 184 44 164 48 146 42 130 55 108 48 85 56 66 48 48 52 26 40 5 45z" />
        )}
      </g>
      {!islands && (
        <path
          d="M92 14l-8 12 9 10-12 18"
          fill="none"
          stroke="#629b9e"
          strokeWidth="3"
        />
      )}
      <g fill="#426f54">
        {(islands
          ? [
              [28, 22],
              [76, 16],
              [123, 36],
              [65, 49],
            ]
          : [
              [18, 25],
              [31, 28],
              [42, 23],
              [57, 35],
              [70, 27],
              [108, 32],
              [117, 37],
              [133, 29],
              [147, 34],
            ]
        ).map(([x, y]) => (
          <path key={x} d={"M" + x + " " + (y - 5) + "l-3 7h6z"} />
        ))}
      </g>
      {!islands && (
        <g>
          <path d="M43 22l7-13 8 14zM56 22l9-16 9 17z" fill="#7d917e" />
          <path d="M47 14l3-5 4 6-3-1-2 2zM61 12l4-6 4 7-4-2z" fill="#d2d5b7" />
        </g>
      )}
      {!empty && (
        <g>
          {(preset === "four" || preset === "war"
            ? [
                [32, 34],
                [68, 41],
                [117, 29],
                [147, 37],
              ]
            : [[119, 33]]
          ).map(([x, y], i) => (
            <g key={x}>
              <rect x={x - 2} y={y} width="5" height="5" fill="#ece0b2" />
              <path d={"M" + (x - 3) + " " + y + "l3-3 4 3z"} fill="#ad7955" />
              <path
                d={"M" + (x + 5) + " " + (y + 3) + "v-12"}
                stroke="#d9d6a8"
              />
              <path
                d={"M" + (x + 5) + " " + (y - 9) + "h6v4h-6z"}
                fill={["#e3bb6b", "#9bc9bc", "#d59eab", "#b9c685"][i]}
              />
            </g>
          ))}
        </g>
      )}
      <rect
        x=".5"
        y=".5"
        width="179"
        height="67"
        rx="6"
        fill="none"
        stroke="#c9d9b0"
        opacity=".12"
      />
    </svg>
  );
}
