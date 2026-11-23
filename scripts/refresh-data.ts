import { refreshData } from '../src/refresh/run.js';

refreshData().catch((err: unknown) => {
  console.error(`\nrefresh-data FAILED. The previous database (if any) was kept.\n`);
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
