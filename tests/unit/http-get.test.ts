import { describe, expect, it, vi } from 'vitest';
import { httpGet, RETRY_WAITS_MS } from '../../src/refresh/run.js';

/** A fake fetch that answers from a list, in order. */
function fakeFetch(steps: (number | 'drop' | { status: number; retryAfter: string })[]) {
  let i = 0;
  const fn = vi.fn(async () => {
    const step = steps[Math.min(i++, steps.length - 1)]!;
    if (step === 'drop')
      throw new TypeError('fetch failed', { cause: new Error('other side closed') });
    if (typeof step === 'number') return new Response(step === 200 ? 'ok' : '', { status: step });
    return new Response('', { status: step.status, headers: { 'Retry-After': step.retryAfter } });
  });
  return fn as unknown as typeof fetch & typeof fn;
}

describe('httpGet retries (refresh-data)', () => {
  const quiet = () => vi.spyOn(console, 'log').mockImplementation(() => {});

  it('tries again after a dropped connection, then succeeds', async () => {
    quiet();
    const waits: number[] = [];
    const f = fakeFetch(['drop', 200]);
    const body = await httpGet('https://example.org/a', f, async (ms) => void waits.push(ms));
    expect(new TextDecoder().decode(body)).toBe('ok');
    expect(f).toHaveBeenCalledTimes(2);
    expect(waits).toEqual([RETRY_WAITS_MS[0]]);
  });

  it('tries again when the download times out after the headers arrived', async () => {
    quiet();
    let calls = 0;
    const f = vi.fn(async () => {
      calls++;
      if (calls === 1) {
        const stalled = new ReadableStream({
          start(c) {
            c.error(new DOMException('The operation was aborted due to timeout', 'TimeoutError'));
          },
        });
        return new Response(stalled, { status: 200 });
      }
      return new Response('ok', { status: 200 });
    }) as unknown as typeof fetch;
    const waits: number[] = [];
    const body = await httpGet('https://example.org/slow', f, async (ms) => void waits.push(ms));
    expect(new TextDecoder().decode(body)).toBe('ok');
    expect(calls).toBe(2);
    expect(waits).toEqual([RETRY_WAITS_MS[0]]);
  });

  it('follows Retry-After on 429 and 503, capped at 5 minutes', async () => {
    quiet();
    const waits: number[] = [];
    const f = fakeFetch([
      { status: 429, retryAfter: '20' },
      { status: 503, retryAfter: '9999' },
      200,
    ]);
    await httpGet('https://example.org/b', f, async (ms) => void waits.push(ms));
    expect(waits).toEqual([20_000, 300_000]);
  });

  it('gives up after three attempts', async () => {
    quiet();
    const f = fakeFetch(['drop']);
    await expect(httpGet('https://example.org/c', f, async () => {})).rejects.toThrow(
      /Network error fetching https:\/\/example\.org\/c.*other side closed/,
    );
    expect(f).toHaveBeenCalledTimes(3);
  });

  it('does not retry a 404', async () => {
    quiet();
    const f = fakeFetch([404]);
    await expect(httpGet('https://example.org/d', f, async () => {})).rejects.toThrow('HTTP 404');
    expect(f).toHaveBeenCalledTimes(1);
  });
});
