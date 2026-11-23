/**
 * Structured logging. SPEC §2: logs record tool name, timing and error codes only —
 * never arguments, names, or other request content. The `LogEvent` type admits no
 * free-text fields, so request data cannot be passed in by accident.
 */
export type LogEvent =
  | {
      event: 'server_started';
      host: string;
      port: number;
      path: string;
      mode: 'local' | 'public';
    }
  | { event: 'rate_limited'; scope: 'global' | 'client' }
  | { event: 'server_stopped' }
  | { event: 'http_error'; status: number; error_code: string }
  | { event: 'tool_call'; tool: string; ms: number; ok: boolean; error_code?: string };

export function log(entry: LogEvent): void {
  process.stderr.write(JSON.stringify({ ts: new Date().toISOString(), ...entry }) + '\n');
}

/** Run a tool handler and log its name, duration and outcome code. */
export async function instrument<T>(tool: string, fn: () => Promise<T>): Promise<T> {
  const start = performance.now();
  try {
    const result = await fn();
    const ms = Math.round(performance.now() - start);
    const failed = (result as { isError?: boolean } | undefined)?.isError === true;
    log(
      failed
        ? { event: 'tool_call', tool, ms, ok: false, error_code: toolErrorCode(result) }
        : { event: 'tool_call', tool, ms, ok: true },
    );
    return result;
  } catch (err) {
    const error_code = err instanceof Error && 'code' in err ? String(err.code) : 'internal_error';
    log({
      event: 'tool_call',
      tool,
      ms: Math.round(performance.now() - start),
      ok: false,
      error_code,
    });
    throw err;
  }
}

/** The error code from a tool error result ({"error": "<code>", ...}); never its message. */
function toolErrorCode(result: unknown): string {
  try {
    const text = (result as { content?: { text?: string }[] }).content?.[0]?.text ?? '';
    const code = (JSON.parse(text) as { error?: unknown }).error;
    return typeof code === 'string' && /^[a-z_]{1,40}$/.test(code) ? code : 'tool_error';
  } catch {
    return 'tool_error';
  }
}
