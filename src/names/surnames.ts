import { editDistance, normalizeName, variantKey } from '../data/normalize.js';

/**
 * Spelling-tolerant surname matching for names read from 19th–20th century Italian registers.
 * Surnames vary in old records (doubled or single consonants, j for i, -i/-e/-o/-a endings) and
 * handwriting is easily misread (u/n, c/e, rn/m, long s/f). Each match states why it matched,
 * from the most to the least certain, so the user can judge it.
 */

export interface SurnameMatch {
  surname: string;
  score: number;
  reason: 'exact' | 'spelling_variant' | 'different_ending' | 'possible_misreading' | 'similar';
  explanation: string;
}

/** Drops the final vowel: Fiorentini / Fiorentino / Fiorentina compare equal. */
function endingKey(s: string): string {
  return variantKey(s).replace(/[aeiou]$/, '');
}

/**
 * Folds letters that look alike in 19th-century handwriting into one class each, so a misread
 * letter doesn't block a match. Applied to the ending-folded key.
 */
function misreadingKey(s: string): string {
  return endingKey(s)
    .replace(/rn/g, 'm')
    .replace(/[un]/g, 'n')
    .replace(/[ce]/g, 'c')
    .replace(/[fs]/g, 's')
    .replace(/[il]/g, 'i')
    .replace(/[ao]/g, 'a')
    .replace(/([a-z])\1+/g, '$1');
}

const EXPLANATION: Record<SurnameMatch['reason'], string> = {
  exact: 'Same surname.',
  spelling_variant: 'Same surname with an old spelling (doubled or single letters, j for i).',
  different_ending: 'Same surname with a different ending (-i, -e, -o, -a), common in old records.',
  possible_misreading:
    'Letters that look alike in old handwriting (u/n, c/e, rn/m, f/s, a/o): check the image.',
  similar: 'Similar spelling: possibly the same surname, possibly not. Check the image.',
};

/** How well a surname read from a record matches one surname the user is looking for. */
export function matchSurname(candidate: string, target: string): SurnameMatch | null {
  const c = normalizeName(candidate);
  const t = normalizeName(target);
  if (!c || !t) return null;
  const result = (score: number, reason: SurnameMatch['reason']): SurnameMatch => ({
    surname: target,
    score,
    reason,
    explanation: EXPLANATION[reason],
  });
  if (c === t) return result(1, 'exact');
  if (variantKey(c) === variantKey(t)) return result(0.95, 'spelling_variant');
  if (endingKey(c) === endingKey(t) && endingKey(t).length >= 3) {
    return result(0.9, 'different_ending');
  }
  if (misreadingKey(c) === misreadingKey(t) && misreadingKey(t).length >= 3) {
    return result(0.8, 'possible_misreading');
  }
  const a = endingKey(c);
  const b = endingKey(t);
  const longest = Math.max(a.length, b.length);
  if (longest >= 5 && editDistance(a, b, 1) <= 1) return result(0.7, 'similar');
  if (longest >= 8 && editDistance(a, b, 2) <= 2) return result(0.6, 'similar');
  return null;
}

/** For each candidate, the matching target surnames at or above `minScore`, best first. */
export function matchSurnames(candidates: string[], targets: string[], minScore = 0.6) {
  return candidates.map((candidate) => ({
    candidate,
    matches: targets
      .map((t) => matchSurname(candidate, t))
      .filter((m): m is SurnameMatch => m !== null && m.score >= minScore)
      .sort((x, y) => y.score - x.score),
  }));
}
