const ROOTS = [
  "아르덴",
  "루미아",
  "벨로아",
  "에린",
  "세레니아",
  "노르딘",
  "아스텔",
  "미르",
  "칼데아",
  "오르벨",
  "라벤",
  "테르나",
  "로덴",
  "바실",
  "엘로아",
  "하르벤",
  "카르모",
  "릴리안",
  "메로스",
  "이셀",
  "나비르",
  "발레온",
  "오르카",
  "가르온",
  "레비아",
  "티렌",
  "브레아",
  "솔레아",
  "카이론",
  "루세아",
  "페르나",
  "올리온",
  "드레반",
  "헤르나",
  "모리안",
  "바르셀",
  "마레온",
  "이브라",
  "셀레온",
  "크레아",
  "벨티아",
  "아르코",
  "로세인",
  "니베아",
  "탈리아",
  "레나스",
  "파르온",
  "오세아",
  "유르나",
  "브리온",
  "마르딘",
  "루벨",
  "레비온",
  "라크아",
  "하르나",
  "페리온",
  "오브라",
  "나르딘",
  "아벨라",
  "키르나",
  "벨세아",
  "오렌",
  "테르빈",
  "멜리아",
];
const FIRST = [
  "가",
  "나",
  "다",
  "라",
  "마",
  "바",
  "사",
  "아",
  "차",
  "카",
  "타",
  "파",
  "하",
  "보",
  "세",
  "루",
];
const SECOND = [
  "르",
  "엘",
  "온",
  "린",
  "스",
  "라",
  "벨",
  "몬",
  "시",
  "안",
  "네",
  "바",
  "크",
  "비",
  "데",
  "토",
];
const LAST = ["니아", "리아", "탄아", "오나", "하임", "벨라", "나아", "스아"];
export function nationName(id: number) {
  if (id <= ROOTS.length) return ROOTS[id - 1] + " 왕국";
  const k = id - ROOTS.length - 1;
  const base =
    FIRST[k % 16] +
    SECOND[Math.floor(k / 16) % 16] +
    LAST[Math.floor(k / 256) % 8];
  return (
    base +
    (k >= 2048 ? String.fromCharCode(0xac00 + Math.floor(k / 2048)) : "") +
    " 왕국"
  );
}
const CLASSIC = [
  "#efb968",
  "#72bbbd",
  "#d88da4",
  "#a7b971",
  "#ad9ad9",
  "#e78b65",
  "#83acd7",
  "#d5ce8c",
];
export function nationColor(id: number) {
  if (id <= 8) return CLASSIC[id - 1];
  const h = ((id - 9) * 137.508 + 17) % 360,
    s = 0.58 + (id % 3) * 0.045,
    l = 0.51 + (id % 2) * 0.09;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))))
      .toString(16)
      .padStart(2, "0");
  };
  return "#" + f(0) + f(8) + f(4);
}
