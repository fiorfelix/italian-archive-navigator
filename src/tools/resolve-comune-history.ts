import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import type { Store } from '../data/store.js';
import { instrument } from '../log.js';
import { resolveComuneHistory } from '../resolve/comune-history.js';
import { toolError, type StoreProvider } from './common.js';
import { nameText } from './validation.js';

const CURRENT_YEAR = new Date().getFullYear();

export const resolveInput = z.object({
  name: nameText(100).describe(
    'Place name in any era or spelling, e.g. "Corneto", "Bagnaja", "Calcata Vecchia".',
  ),
  province: nameText(60)
    .optional()
    .describe('Optional province: two-letter code (e.g. "VT") or name (e.g. "Viterbo").'),
  year: z
    .number()
    .int()
    .min(1000)
    .max(CURRENT_YEAR)
    .optional()
    .describe('Optional year of the event being researched.'),
});

export function registerResolveComuneHistory(server: McpServer, getStore: StoreProvider): void {
  server.registerTool(
    'resolve_comune_history',
    {
      title: 'Resolve comune history',
      description:
        'Finds the Italian comune a place name refers to, from any period since 1861: current and former names, suppressed and re-established comuni, and frazioni. Returns the comune today (ISTAT code, province, region), its dated changes (renames, mergers, province moves, annexation), and its name and province in a given year.',
      inputSchema: resolveInput,
      annotations: {
        title: 'Resolve comune history',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (args) =>
      instrument('resolve_comune_history', async () => {
        let store: Store;
        try {
          store = getStore();
        } catch (err) {
          return toolError(err);
        }
        const result = resolveComuneHistory(store, args);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result) }],
          structuredContent: result,
        };
      }),
  );
}
