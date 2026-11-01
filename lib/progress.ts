// PRD §11 levels. A level is a label over XP the server recorded, nothing more:
// it is not a measure of ability or intelligence.
export const levels = [
  ["Explorer", 0],
  ["Thinker", 300],
  ["Solver", 800],
  ["Builder", 1500],
  ["Strategist", 2500],
  ["Innovator", 4000],
  ["Leader", 6000],
  ["Global Challenger", 9000],
] as const;

export function levelFor(xp: number) {
  const points = Math.max(0, Math.floor(xp || 0));
  let i = 0;
  while (i + 1 < levels.length && points >= levels[i + 1][1]) i++;
  const next = levels[i + 1];
  return {
    name: levels[i][0],
    index: i + 1,
    xp: points,
    next: next ? next[0] : null,
    toNext: next ? next[1] - points : 0,
    progress: next ? (points - levels[i][1]) / (next[1] - levels[i][1]) : 1,
  };
}
