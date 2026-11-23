import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import { citeSource, SEEN_AS } from '../letters/cite.js';
import { instrument } from '../log.js';
import { toolError } from './common.js';
import { nameText, pastDate } from './validation.js';

const CURRENT_YEAR = new Date().getFullYear();
const text = nameText;
/** Identifiers such as act numbers: clients may send them as numbers or as text. */
const identifier = z.union([z.string().trim().min(1).max(40), z.number().int().nonnegative()]);

export const citeInput = z.object({
  archive: text(150).describe('Holding archive or office, e.g. "Archivio di Stato di Viterbo".'),
  fonds: text(150).optional().describe('Fonds (fondo), e.g. "Stato civile italiano".'),
  series: text(150).optional().describe('Series, e.g. "Nati".'),
  comune: text(100).optional(),
  year: z.number().int().min(1000).max(CURRENT_YEAR).optional(),
  record_type: z
    .enum(['birth', 'marriage', 'death', 'baptism', 'burial', 'military', 'other'])
    .optional(),
  act_number: identifier.optional(),
  person: text(120).optional(),
  url: z
    .url({ protocol: /^https?$/ })
    .max(500)
    .optional()
    .describe('Link to the record image or page.'),
  accessed: pastDate()
    .refine((v) => v.length === 10, 'use yyyy-mm-dd')
    .optional()
    .describe('Date the link was consulted.'),
  seen_as: z
    .enum(Object.keys(SEEN_AS) as [keyof typeof SEEN_AS, ...(keyof typeof SEEN_AS)[]])
    .describe(
      'How the fact is known: original_record, index_entry, transcription_or_publication, derived_from_other_records, family_account.',
    ),
});

export function registerCiteSource(server: McpServer): void {
  server.registerTool(
    'cite_source',
    {
      title: 'Cite source',
      description:
        'Formats a citation for a genealogical record in one consistent style (archive, fonds, series, comune, year, record and act number, link and access date) and assigns an evidence label: VERIFIED, INDEX, SECONDARY, INFERENCE or FAMILY_ACCOUNT.',
      inputSchema: citeInput,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (args) =>
      instrument('cite_source', async () => {
        try {
          const result = citeSource({
            ...args,
            act_number: args.act_number === undefined ? undefined : String(args.act_number),
          });
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
