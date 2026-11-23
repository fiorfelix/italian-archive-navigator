import type express from 'express';
import { log } from '../log.js';

export interface RateLimitOptions {
  globalPerMinute: number;
  clientPerMinute: number;
  /** Header with the caller's address, set by a trusted proxy (see PublicConfig). */
  clientIpHeader?: string | null;
  /** Current time in ms; replaceable in tests. */
  now?: () => number;
}

const WINDOW_MS = 60_000;

/**
 * Fixed one-minute windows: one counter for all clients and one per client address.
 * Addresses are held in memory for the current window only and never logged. Requests over
 * the global limit are refused before their address is recorded, so the table can hold at
 * most `globalPerMinute` entries.
 *
 * Requests that reach this server through Claude come from Anthropic's addresses, so the
 * per-address limit can't tell individual Claude users apart; it mainly stops direct abuse.
 */
export function rateLimit(options: RateLimitOptions): express.RequestHandler {
  const now = options.now ?? Date.now;
  let windowStart = 0;
  let total = 0;
  let perClient = new Map<string, number>();

  return (req, res, next) => {
    const t = now();
    if (t - windowStart >= WINDOW_MS) {
      windowStart = t - (t % WINDOW_MS);
      total = 0;
      perClient = new Map();
    }
    const retryAfter = Math.max(1, Math.ceil((windowStart + WINDOW_MS - t) / 1000));
    const refuse = (scope: 'global' | 'client') => {
      log({ event: 'rate_limited', scope });
      res
        .status(429)
        .set('Retry-After', String(retryAfter))
        .json({
          jsonrpc: '2.0',
          id: null,
          error: {
            code: -32000,
            message: `Too many requests. Try again in ${retryAfter} seconds.`,
          },
        });
    };

    if (total >= options.globalPerMinute) return refuse('global');
    const fromHeader = options.clientIpHeader ? req.get(options.clientIpHeader)?.trim() : '';
    const client = fromHeader || req.ip || 'unknown';
    const count = perClient.get(client) ?? 0;
    if (count >= options.clientPerMinute) return refuse('client');
    total += 1;
    perClient.set(client, count + 1);
    next();
  };
}
