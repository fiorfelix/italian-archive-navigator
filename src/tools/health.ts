import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import { SERVER_NAME, SERVER_VERSION } from '../config.js';
import { instrument } from '../log.js';

const startedAt = Date.now();

export const healthOutput = z.object({
  status: z.literal('ok'),
  server: z.string(),
  version: z.string(),
  uptime_s: z.number().int().nonnegative(),
});

export function registerHealthTool(server: McpServer): void {
  server.registerTool(
    'health',
    {
      title: 'Server health',
      description: 'Returns the server name, version and uptime in seconds.',
      outputSchema: healthOutput,
      annotations: {
        title: 'Server health',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () =>
      instrument('health', async () => {
        const output = {
          status: 'ok' as const,
          server: SERVER_NAME,
          version: SERVER_VERSION,
          uptime_s: Math.floor((Date.now() - startedAt) / 1000),
        };
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(output) }],
          structuredContent: output,
        };
      }),
  );
}
