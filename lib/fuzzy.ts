export function fuzzyScore(query: string, target: string): number | null {
  const q = query.trim().toLowerCase();
  const t = target.toLowerCase();
  if (!q) return 0;

  let score = 0;
  let tIndex = 0;
  let consecutive = 0;

  for (const ch of q) {
    const idx = t.indexOf(ch, tIndex);
    if (idx === -1) return null;
    consecutive = idx === tIndex ? consecutive + 1 : 0;
    score += consecutive > 0 ? 3 : 1;
    score -= (idx - tIndex) * 0.1;
    tIndex = idx + 1;
  }

  if (t.startsWith(q)) score += 10;
  return score;
}

export function bestFuzzyScore(query: string, candidates: string[]): number | null {
  let best: number | null = null;
  for (const c of candidates) {
    const s = fuzzyScore(query, c);
    if (s !== null && (best === null || s > best)) best = s;
  }
  return best;
}
