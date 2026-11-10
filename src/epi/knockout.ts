import type { World } from "../engine";
import { nationalScores } from "./analysis";

function requestedSurvivors(question: string) {
  const q = question.normalize("NFKC");
  if (
    !/(?:붙|싸우|대결|전쟁|맞붙|탈락)/.test(q) ||
    !/(?:1\s*[·,과와–-]\s*2\s*위|상위\s*(?:2|두)|(?:가장|제일).*(?:다음|두\s*번째)|강한.*순서)/.test(
      q,
    )
  )
    return null;
  if (
    /(?:피해|소모|동맹|지형|보급).{0,10}(?:반영|고려|포함)|(?:낮은|약한).{0,8}쪽이\s*이기/.test(
      q,
    )
  )
    return null;
  const count = q.match(
    /(\d{1,2}|한|두|세|네|다섯)\s*(?:개\s*)?(?:국가|나라|왕국|국)\s*(?:만|이|가)?\s*남/,
  );
  if (!count) return null;
  const parsed =
    ({ 한: 1, 두: 2, 세: 3, 네: 4, 다섯: 5 } as Record<string, number>)[
      count[1]
    ] ?? Number(count[1]);
  return parsed >= 1 && parsed <= 10 ? parsed : null;
}

export function knockoutAnswer(w: World, question: string): string | null {
  const keep = requestedSurvivors(question);
  if (keep === null) return null;
  const { alive, power } = nationalScores(w);
  const ranking = alive
    .map((n) => ({ n, score: power(n) }))
    .sort((a, b) => b.score - a.score || a.n.id - b.n.id);
  if (!ranking.length) return "지금은 생존 국가가 없어요.";
  const tied = ranking.some(
    (row, i) => i > 0 && Math.abs(row.score - ranking[i - 1].score) < 1e-9,
  );
  // With unchanged scores, the same leader wins every match; second place is removed each time.
  const survivors =
    ranking.length <= keep
      ? ranking
      : [ranking[0], ...ranking.slice(ranking.length - keep + 1)];
  const names = survivors
    .map(({ n }) => `[${n.name}](nation:${n.id})`)
    .join(" · ");
  return (
    `남는 ${survivors.length}개국: ${names}\n` +
    (ranking.length <= keep
      ? "현재 생존국 수가 목표 이하라 대결은 없어요."
      : `매번 현재 1·2위를 붙여 국력이 낮은 쪽을 탈락시켰어요(전투 피해 제외${tied ? ", 동점은 국가 ID순" : ""}).`)
  );
}
