import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import { TEMPLATES_DIR } from '../config.js';
import { draftRequestLetter, MILITARY_ADDRESSEES, REQUEST_TYPES } from '../letters/draft.js';
import { instrument } from '../log.js';
import { toolError, type StoreProvider } from './common.js';
import { nameText, pastDate } from './validation.js';

const CURRENT_YEAR = new Date().getFullYear();
const name = nameText(120);
/** Identifiers such as act or matricola numbers: clients may send them as numbers or text. */
const identifier = z.union([z.string().trim().max(40), z.number().int().nonnegative()]);
const person = z.object({
  given_names: name.optional(),
  surname: name.optional(),
  father: name.optional(),
  mother: name.optional(),
  birth_place: name.optional(),
  birth_date: pastDate().optional(),
  death_place: name.optional(),
  death_date: pastDate().optional(),
  occupation: nameText(80).optional(),
  sex: z.enum(['M', 'F']).optional().describe('For Italian agreement (nato/nata).'),
});
const isoOrYear = pastDate();

export const letterInput = z.object({
  request_type: z
    .enum(REQUEST_TYPES)
    .describe(
      'comune_copia_integrale (Comune, full copy of an act), archivio_di_stato_riproduzione (State Archive, search and copy), parrocchia_ricerca (parish register search), militare_foglio_matricolare (military service record).',
    ),
  comune: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .describe('Comune of the record (any era) or ISTAT code.'),
  province: nameText(60).optional(),
  addressee: z
    .enum(MILITARY_ADDRESSEES)
    .optional()
    .describe(
      'Military requests only: the Army documentation office (default), the State Archive, or the Ministry of Defence (PERSOMIL: career officers, from the 10th year after death).',
    ),
  person: person.describe('The person the record is about.'),
  event: z
    .object({
      type: z.enum(['birth', 'marriage', 'death']).optional(),
      date: isoOrYear.optional(),
      year: z.number().int().min(1500).max(CURRENT_YEAR).optional(),
      place: name.optional(),
    })
    .optional(),
  parents: z.object({ father: name.optional(), mother: name.optional() }).optional(),
  spouse: z.union([name, person]).optional().describe('Spouse: a name, or details like person.'),
  act: z
    .object({
      number: identifier.optional(),
      year: z.number().int().min(1500).max(CURRENT_YEAR).optional(),
      series: nameText(120).optional(),
      banns: z
        .object({ number: identifier.optional(), date: isoOrYear.optional() })
        .optional()
        .describe('Marriage banns (pubblicazioni) linked to the act.'),
      supporting_papers: z
        .boolean()
        .optional()
        .describe(
          'Ask for the supporting papers (allegati). Default: yes for State Archive marriages.',
        ),
    })
    .optional(),
  military: z
    .object({
      birth_date: isoOrYear.optional(),
      birth_class: z.number().int().min(1800).max(CURRENT_YEAR).optional(),
      birth_place: name.optional(),
      matricola: identifier.optional(),
      district: nameText(120).optional(),
      register: nameText(60).optional(),
      document: z.enum(['foglio_matricolare', 'stato_di_servizio']).optional(),
      rank: nameText(60).optional(),
    })
    .optional(),
  parish: z.object({ name: name.optional() }).optional(),
  details: z
    .array(nameText(300))
    .max(8)
    .optional()
    .describe('Further known facts, one line each (e.g. a note in a register).'),
  requester: z
    .object({
      name: name.optional(),
      relationship: nameText(60).optional(),
      contact: z
        .string()
        .trim()
        .max(200)
        .refine(
          // eslint-disable-next-line no-control-regex -- rejecting control characters is the point
          (v) => !/[\u0000-\u001f\u007f]|[a-z][a-z0-9+.-]*:\/\//i.test(v),
          'enter an e-mail, PEC or phone number, not a link',
        )
        .optional(),
      place: nameText(100).optional(),
      residence: nameText(200).optional(),
      birth_place: name.optional(),
      birth_date: isoOrYear.optional(),
      sex: z.enum(['M', 'F']).optional(),
    })
    .optional()
    .describe('The person sending the letter. Used only to fill in the letter; never stored.'),
});

export function registerDraftRequestLetter(server: McpServer, getStore: StoreProvider): void {
  server.registerTool(
    'draft_request_letter',
    {
      title: 'Draft request letter',
      description:
        'Drafts a formal Italian letter requesting a record (from a Comune, State Archive, parish or military records office), with the recipient filled from official contact data, an English summary, a checklist of attachments and the list of details still missing. Fees and response times are never stated; the letter asks the office. The letter is returned as text and is not sent.',
      inputSchema: letterInput,
      annotations: {
        title: 'Draft request letter',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (args) =>
      instrument('draft_request_letter', async () => {
        try {
          const str = (v: string | number | undefined) => (v === undefined ? undefined : String(v));
          const result = draftRequestLetter(
            getStore(),
            {
              ...args,
              act: args.act
                ? {
                    ...args.act,
                    number: str(args.act.number),
                    banns: args.act.banns
                      ? { ...args.act.banns, number: str(args.act.banns.number) }
                      : undefined,
                  }
                : undefined,
              military: args.military
                ? { ...args.military, matricola: str(args.military.matricola) }
                : undefined,
            },
            TEMPLATES_DIR,
          );
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
