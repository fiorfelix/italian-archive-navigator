import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import { instrument } from '../log.js';
import { matchSurnames } from '../names/surnames.js';
import { toolError } from './common.js';
import { nameText } from './validation.js';

export const surnamesInput = z.object({
  candidates: z
    .array(nameText(80))
    .min(1)
    .max(500)
    .describe('Surnames as read from records or an index (up to 500).'),
  surnames: z
    .array(nameText(80))
    .min(1)
    .max(30)
    .describe('The surnames being looked for (up to 30).'),
  min_score: z
    .number()
    .min(0.5)
    .max(1)
    .optional()
    .describe('Lowest score to report, from 0.5 to 1 (default 0.6).'),
});

export function registerMatchSurnames(server: McpServer): void {
  server.registerTool(
    'match_surnames',
    {
      title: 'Match surnames',
      description:
        'Compares surnames read from Italian records or indexes with the surnames being looked for, tolerating old spellings (doubled letters, j for i), changed endings (-i, -e, -o, -a) and letters that look alike in old handwriting. Returns each match with a score and the reason, from exact to similar. Stores nothing.',
      inputSchema: surnamesInput,
      annotations: {
        title: 'Match surnames',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (args) =>
      instrument('match_surnames', async () => {
        try {
          const results = matchSurnames(args.candidates, args.surnames, args.min_score ?? 0.6);
          const result = {
            results: results.filter((r) => r.matches.length),
            unmatched: results.filter((r) => !r.matches.length).length,
            note: 'Scores show how likely the names are the same surname, not that the people are related. Check each match against the record image.',
          };
          return {
            content: [{ type: 'text' as const, text: JSON.stringify(result) }],
            structuredContent: result,
          };
        } catch (err) {
          return toolError(err);
        }
      }),
  );
}
