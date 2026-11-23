import { existsSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { DB_PATH } from '../../src/config.js';
import { looksLikeUrl, nameText } from '../../src/tools/validation.js';

describe('web addresses in name fields', () => {
  it.each([
    'https://evil.example/x',
    'http://192.168.0.1',
    'ftp://example.org',
    'www.example.it',
    'mario.rossi@example.org',
    'example.com',
    'comune-esempio.it',
    'Vedi archivi.cultura.gov.it',
  ])('rejects %s', (v) => expect(looksLikeUrl(v)).toBe(true));

  it.each([
    "Sant'Angelo",
    'S. Agostino',
    "Reggio nell'Emilia",
    'Bolzano/Bozen',
    'Via G.De Ruggiero',
    'Castro dei Volsci',
  ])('accepts %s', (v) => expect(looksLikeUrl(v)).toBe(false));

  it('rejects control characters and over-long text with an actionable message', () => {
    expect(nameText(10).safeParse('Roma\u0000').success).toBe(false);
    const long = nameText(10).safeParse('x'.repeat(11));
    expect(long.success).toBe(false);
    const url = nameText(100).safeParse('https://evil.example');
    expect(url.success).toBe(false);
    expect(JSON.stringify(url.error?.issues)).toMatch(/enter a name only/);
  });

  it.skipIf(!existsSync(DB_PATH))('accepts every place name in the real database', () => {
    const db = new DatabaseSync(DB_PATH, { readOnly: true });
    const names = db.prepare('SELECT DISTINCT name FROM name_index').all() as { name: string }[];
    db.close();
    const rejected = names.map((n) => n.name).filter(looksLikeUrl);
    expect(rejected).toEqual([]);
  });
});
