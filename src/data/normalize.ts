/**
 * Place-name normalisation. Historical Italian spellings differ in accents, apostrophes,
 * "j" for "i" (Bagnaja/Bagnaia) and doubled consonants (Fabbrica/Fabrica). Two keys:
 * - `normalizeName`: exact-match key (case, accents, punctuation, spacing removed).
 * - `variantKey`: looser key that also folds j→i and doubled letters, for old spellings.
 */
export function normalizeName(input: string): string {
  return input
    .normalize('NFD')
    .replace(/\p{M}/gu, '') // strip accents
    .toLowerCase()
    .replace(/[’'`´.\-_/,()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function variantKey(input: string): string {
  return normalizeName(input)
    .replace(/j/g, 'i')
    .replace(/([a-z])\1+/g, '$1')
    .replace(/ /g, '');
}

/** Levenshtein distance, capped: returns `max + 1` as soon as the distance exceeds `max`. */
export function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const v = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + cost);
      cur.push(v);
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    prev = cur;
  }
  return prev[b.length]!;
}
