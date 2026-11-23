import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import type { Store } from '../data/store.js';
import { instrument } from '../log.js';
import { findArchiveContact, OFFICE_TYPES } from '../resolve/archive-contact.js';
import { toolError, type StoreProvider } from './common.js';
import { nameText } from './validation.js';

export const contactInput = z.object({
  comune: nameText(100).describe(
    'Comune name (any era, or a frazione) or 6-digit ISTAT code, e.g. "Tarquinia" or "056050".',
  ),
  province: nameText(60)
    .optional()
    .describe('Optional province code or name, to tell apart comuni with the same name.'),
  office_type: z
    .enum(OFFICE_TYPES)
    .describe(
      'stato_civile (Comune civil registry), archivio_di_stato (State Archive), ufficio_documentale_militare (Army records office), diocesi (diocese).',
    ),
});

export function registerFindArchiveContact(server: McpServer, getStore: StoreProvider): void {
  server.registerTool(
    'find_archive_contact',
    {
      title: 'Find archive contact',
      description:
        'Returns the office that holds records for a comune, by office type: name, postal address, PEC and other e-mail, website, source and date of the data. Comune and State Archive contacts come from IndicePA; Army documentation offices for Lazio, Umbria, Toscana and Marche come from the Army’s own pages. Elsewhere, and for dioceses, it returns the official directory to consult, marked unverified.',
      inputSchema: contactInput,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (args) =>
      instrument('find_archive_contact', async () => {
        let store: Store;
        try {
          store = getStore();
          const result = findArchiveContact(store, args);
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
