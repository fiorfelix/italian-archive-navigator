import { DEFAULT_PORT, publicConfig } from './config.js';
import { startServer } from './server.js';

const port = process.env.PORT ? Number(process.env.PORT) : DEFAULT_PORT;
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  process.stderr.write(`Invalid PORT "${process.env.PORT}"; expected an integer 1-65535.\n`);
  process.exit(1);
}

let pub;
try {
  pub = publicConfig();
} catch (err) {
  process.stderr.write(`${(err as Error).message}\n`);
  process.exit(1);
}

const running = await startServer(port, { public: pub });
process.stderr.write(
  pub
    ? `Public mode: MCP endpoint at https://${pub.allowedHosts[0]}/mcp (listening on port ${running.port})\n`
    : `MCP endpoint: ${running.url}\n`,
);

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    void running.close().then(() => process.exit(0));
  });
}
