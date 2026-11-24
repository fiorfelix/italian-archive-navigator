import type { McpServer } from '@modelcontextprotocol/server';
import { instrument } from '../log.js';
import { registerGuide } from '../resolve/register-guide.js';
import type { RegisterGuide } from '../rules/register-guide.js';
import type { Rule } from '../rules/schema.js';
import type { SeriesFile } from '../rules/series.js';
import { toolError, type StoreProvider } from './common.js';
import { recordsInput } from './which-records-exist.js';

export function registerRegisterGuide(
  server: McpServer,
  getStore: StoreProvider,
  getRules: () => Rule[],
  getGuide: () => RegisterGuide,
  getSeries: () => SeriesFile[] = () => [],
): void {
  server.registerTool(
    'register_guide',
    {
      title: 'Register guide',
      description:
        'For a comune, year and event (birth, marriage, death, military), explains what to expect inside the register: which registers and volumes exist, where the index usually is, how acts are numbered and laid out, and steps for reading it. Each note says whether it is confirmed from an official source. Use alongside which_records_exist when reading register pages.',
      inputSchema: recordsInput,
      annotations: {
        title: 'Register guide',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (args) =>
      instrument('register_guide', async () => {
        try {
          const result = registerGuide(
            getStore(),
            getRules(),
            getGuide(),
            args,
            new Date(),
            getSeries(),
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
