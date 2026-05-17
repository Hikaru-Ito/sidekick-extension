import { CONFIDENCE_THRESHOLDS, type MatchConfidence } from '../types';

/**
 * Compare two restaurant names and return a similarity score in [0, 1].
 *
 * Uses a character-bigram Dice coefficient on Unicode-normalised strings —
 * straight forward, works well for Japanese where most names share kanji
 * regardless of romaji / katakana variants. Strips common suffixes / punctuation
 * that would otherwise drag the score down (e.g. "店", "本店", parens).
 */
export function similarity(a: string, b: string): number {
  const A = normalise(a);
  const B = normalise(b);
  if (!A || !B) return 0;
  if (A === B) return 1;
  const bigramsA = bigrams(A);
  const bigramsB = bigrams(B);
  if (bigramsA.size === 0 || bigramsB.size === 0) {
    // Single-character strings — fall back to inclusion.
    return A.includes(B) || B.includes(A) ? 0.8 : 0;
  }
  let overlap = 0;
  for (const bg of bigramsA) {
    if (bigramsB.has(bg)) overlap++;
  }
  return (2 * overlap) / (bigramsA.size + bigramsB.size);
}

export function confidenceFor(score: number): MatchConfidence {
  if (score >= CONFIDENCE_THRESHOLDS.high) return 'high';
  if (score >= CONFIDENCE_THRESHOLDS.medium) return 'medium';
  return 'low';
}

function normalise(s: string): string {
  return (
    s
      .normalize('NFKC')
      .toLowerCase()
      // Drop common decorations.
      .replace(/[（）()【】「」『』［］\[\]・･、。.,!！?？·]/g, '')
      // Drop trailing "店" / "本店" / "支店" — they vary between listings.
      .replace(/(本店|支店|店)$/, '')
      .replace(/\s+/g, '')
      .trim()
  );
}

function bigrams(s: string): Set<string> {
  const out = new Set<string>();
  for (let i = 0; i < s.length - 1; i++) {
    out.add(s.slice(i, i + 2));
  }
  return out;
}
