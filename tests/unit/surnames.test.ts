import { describe, expect, it } from 'vitest';
import { matchSurname, matchSurnames } from '../../src/names/surnames.js';

// Invented and common surnames only.
describe('surname matching', () => {
  it.each([
    ['Rossi', 'Rossi', 'exact', 1],
    ['ROSSI', 'rossi', 'exact', 1],
    ['Rosi', 'Rossi', 'spelling_variant', 0.95],
    ['Bianchj', 'Bianchi', 'spelling_variant', 0.95],
    ['Fiorentino', 'Fiorentini', 'different_ending', 0.9],
    ['Fiorentine', 'Fiorentini', 'different_ending', 0.9],
    ['Marcuccí', 'Marcucci', 'exact', 1],
    ['Marcncci', 'Marcucci', 'possible_misreading', 0.8],
    ['Femandini', 'Fernandini', 'possible_misreading', 0.8],
    ['Benedetfi', 'Benedetti', 'similar', 0.7],
  ] as const)('%s ~ %s → %s', (candidate, target, reason, score) => {
    expect(matchSurname(candidate, target)).toMatchObject({ reason, score });
  });

  it.each([
    ['Rossi', 'Russo'],
    ['Bianchi', 'Neri'],
    ['Conti', 'Costa'],
    ['Ricci', 'Rizzi'],
    ['', 'Rossi'],
  ])('does not match %s and %s', (candidate, target) => {
    expect(matchSurname(candidate, target)).toBeNull();
  });

  it('short surnames need a closer match than long ones', () => {
    expect(matchSurname('Fena', 'Sena')).toMatchObject({ reason: 'possible_misreading' });
    expect(matchSurname('Neri', 'Nesi')).toBeNull();
  });

  it('returns matches for each candidate, best first, above the threshold', () => {
    const r = matchSurnames(['Fiorentina', 'Verdi', 'Rosi'], ['Rossi', 'Fiorentini']);
    expect(r[0]!.matches.map((m) => m.surname)).toEqual(['Fiorentini']);
    expect(r[1]!.matches).toEqual([]);
    expect(r[2]!.matches[0]).toMatchObject({ surname: 'Rossi', reason: 'spelling_variant' });
    expect(matchSurnames(['Benedetfi'], ['Benedetti'], 0.8)[0]!.matches).toEqual([]);
  });
});
