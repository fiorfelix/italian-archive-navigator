import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import type { Store } from '../data/store.js';
import { instrument } from '../log.js';
import { whichRecordsExist } from '../resolve/records.js';
import type { Rule } from '../rules/schema.js';
import type { SeriesFile } from '../rules/series.js';
import { EVENT_TYPES } from '../rules/schema.js';
import { toolError, type StoreProvider } from './common.js';
import { nameText } from './validation.js';

const CURRENT_YEAR = new Date().getFullYear();

export const recordsInput = z.object({
  comune: nameText(100).describe('Comune name (any era, or a frazione) or 6-digit ISTAT code.'),
  province: nameText(60).optional().describe('Optional province code or name.'),
  year: z
    .number()
    .int()
    .min(1500)
    .max(CURRENT_YEAR)
    .describe('Year of the event. For "military", the birth year (classe di leva).'),
  event: z.enum(EVENT_TYPES).describe('birth, marriage, death, or military.'),
  person_birth_year: z
    .number()
    .int()
    .min(1500)
    .max(CURRENT_YEAR)
    .optional()
    .describe('Optional birth year of the person, for marriages and deaths.'),
});

export function registerWhichRecordsExist(
  server: McpServer,
  getStore: StoreProvider,
  getRules: () => Rule[],
  getSeries: () => SeriesFile[] = () => [],
): void {
  server.registerTool(
    'which_records_exist',
    {
      title: 'Which records exist',
      description:
        'For a comune, year and event (birth, marriage, death, military), returns the registration regime in force, the record types to expect, which copy is held where today, fallbacks when the primary source is missing, and the source of the rule. Events less than 100 years old, or people born after 1940, are routed to the Comune.',
      inputSchema: recordsInput,
      annotations: {
        title: 'Which records exist',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (args) =>
      instrument('which_records_exist', async () => {
        try {
          const store: Store = getStore();
          const result = whichRecordsExist(store, getRules(), args, new Date(), getSeries());
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
