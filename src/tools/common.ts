import type { Store } from '../data/store.js';

export type StoreProvider = () => Store;

/** Tool-level error result with an actionable message (no stack traces, no request data). */
export function toolError(err: unknown) {
  const message = err instanceof Error ? err.message : 'Unexpected error.';
  const code = err instanceof Error && 'code' in err ? String(err.code) : 'internal_error';
  return {
    isError: true,
    content: [{ type: 'text' as const, text: JSON.stringify({ error: code, message }) }],
  };
}
