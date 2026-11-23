/**
 * Network settings. Local mode (the default): bind to 127.0.0.1 only, accept only localhost
 * Host and Origin headers. There is no flag that changes this host.
 *
 * Public mode: enabled only by setting PUBLIC_HOST to the server's public
 * host name. The server then listens on all interfaces for the hosting service's proxy, which
 * terminates HTTPS, and accepts MCP requests only for that host name, with rate limits.
 */
export const HOST = '127.0.0.1' as const;
export const PUBLIC_BIND_HOST = '0.0.0.0' as const;
export const DEFAULT_PORT = 8788;
export const MCP_PATH = '/mcp';
export const HEALTH_PATH = '/healthz';

export interface PublicConfig {
  /** Host names accepted in the Host header (the public name, plus the host's own name). */
  allowedHosts: string[];
  /** Requests per minute for all clients together. */
  globalPerMinute: number;
  /** Requests per minute from one client address. */
  clientPerMinute: number;
  /**
   * Request header that holds the caller's address, set by a trusted proxy in front of the
   * server (on Render, Cloudflare's `cf-connecting-ip`). Unset: the address of the connection.
   */
  clientIpHeader: string | null;
}

const HOSTNAME =
  /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;

function positiveInt(env: NodeJS.ProcessEnv, key: string, fallback: number): number {
  const raw = env[key];
  if (raw === undefined || raw === '') return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 1_000_000) {
    throw new Error(`Invalid ${key} "${raw}": expected a whole number from 1 to 1000000.`);
  }
  return n;
}

function hostname(env: NodeJS.ProcessEnv, key: string): string | undefined {
  const raw = env[key]?.trim().toLowerCase();
  if (!raw) return undefined;
  if (!HOSTNAME.test(raw)) {
    throw new Error(`Invalid ${key} "${env[key]}": expected a host name such as mcp.example.com.`);
  }
  return raw;
}

function headerName(env: NodeJS.ProcessEnv, key: string): string | null {
  const raw = env[key]?.trim().toLowerCase();
  if (!raw) return null;
  if (!/^[a-z0-9-]{1,64}$/.test(raw)) {
    throw new Error(
      `Invalid ${key} "${env[key]}": expected a header name such as cf-connecting-ip.`,
    );
  }
  return raw;
}

/**
 * Public mode settings from the environment, or null for local mode (PUBLIC_HOST unset).
 * Throws on malformed values so a misconfigured deploy fails at start instead of running open.
 */
export function publicConfig(env: NodeJS.ProcessEnv = process.env): PublicConfig | null {
  const host = hostname(env, 'PUBLIC_HOST');
  if (!host) return null;
  // Render sets RENDER_EXTERNAL_HOSTNAME to the service's onrender.com name; accepting it
  // allows testing before the custom domain's DNS is in place.
  const extra = hostname(env, 'RENDER_EXTERNAL_HOSTNAME');
  return {
    allowedHosts: [...new Set([host, ...(extra ? [extra] : [])])],
    globalPerMinute: positiveInt(env, 'RATE_LIMIT_GLOBAL_PER_MINUTE', 600),
    clientPerMinute: positiveInt(env, 'RATE_LIMIT_CLIENT_PER_MINUTE', 120),
    clientIpHeader: headerName(env, 'CLIENT_IP_HEADER'),
  };
}

export const SERVER_NAME = 'italian-archive-navigator';
export const SERVER_VERSION = '0.1.0';

import { fileURLToPath } from 'node:url';

/** Project root: one level above src/ (or dist/ when compiled). */
export const PROJECT_ROOT = fileURLToPath(new URL('..', import.meta.url));
export const DATA_DIR = `${PROJECT_ROOT}data`;
export const DB_PATH = `${DATA_DIR}/navigator.sqlite`;
export const RULES_DIR = `${DATA_DIR}/rules/it`;
export const TEMPLATES_DIR = `${PROJECT_ROOT}templates/it`;
export const SERIES_DIR = `${DATA_DIR}/curated/archive-series/it`;
export const REGISTER_GUIDE_PATH = `${DATA_DIR}/curated/register-guide.yaml`;
