import { describe, expect, it } from 'vitest';
import { editDistance, normalizeName, variantKey } from '../../src/data/normalize.js';

describe('name normalisation', () => {
  it('ignores case, accents, apostrophes and spacing', () => {
    expect(normalizeName("  Sant'Angelo  di Roccalvecce ")).toBe('sant angelo di roccalvecce');
    expect(normalizeName('Agliè')).toBe('aglie');
  });
  it('folds old spellings (j for i, doubled letters)', () => {
    expect(variantKey('Bagnaja')).toBe(variantKey('Bagnaia'));
    expect(variantKey('Fabbrica')).toBe(variantKey('Fabrica'));
  });
  it('computes capped edit distance', () => {
    expect(editDistance('tuscania', 'toscania', 2)).toBe(1);
    expect(editDistance('abc', 'xyzxyz', 2)).toBe(3);
  });
});
