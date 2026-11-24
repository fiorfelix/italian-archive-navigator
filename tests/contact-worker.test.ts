import { describe, expect, it, vi } from 'vitest';
import {
  buildMime,
  handle,
  parseForm,
  SENT_PAGE,
  ERROR_PAGE,
  type Env,
} from '../contact-worker/src/handler.js';

const form = (fields: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
};
const good = {
  topic: 'thanks',
  message: 'Grazie! It found my great-grandfather in Montefiore.',
  reply: 'someone@example.org',
  'cf-turnstile-response': 'token-123',
};

function setup(
  turnstile: Record<string, unknown> = {
    success: true,
    hostname: 'archives.fiorfelix.com',
    action: 'contact',
  },
) {
  const sent: { message: unknown }[] = [];
  const env: Env = {
    TURNSTILE_SECRET: 'test-secret',
    CONTACT_TO: 'inbox@example.org',
    EMAIL: { send: vi.fn(async (message: unknown) => void sent.push({ message })) },
  };
  const fetchMock = vi.fn(async () => new Response(JSON.stringify(turnstile)));
  const deps = {
    fetch: fetchMock as unknown as typeof fetch,
    makeMessage: (from: string, to: string, raw: string) => ({ from, to, raw }),
    now: () => new Date('2026-11-23T20:00:00Z'),
    uuid: () => 'fixed-id',
  };
  const post = (fields: Record<string, string>, path = '/api/contact') =>
    handle(
      new Request(`https://archives.fiorfelix.com${path}`, {
        method: 'POST',
        body: form(fields),
        headers: { 'cf-connecting-ip': '203.0.113.9' },
      }),
      env,
      deps,
    );
  return { env, deps, sent, fetchMock, post };
}

const location = (r: Response) => new URL(r.headers.get('location') ?? '').pathname;

describe('contact form: parseForm', () => {
  it('accepts a complete form and normalises line breaks', () => {
    const p = parseForm(form({ ...good, message: ' line 1\r\nline 2 ' }));
    expect(p).toEqual({
      topic: 'thanks',
      message: 'line 1\nline 2',
      reply: 'someone@example.org',
      token: 'token-123',
    });
  });
  it('treats a filled hidden field as a bot', () => {
    expect(parseForm(form({ ...good, website: 'http://spam' }))).toBe('bot');
  });
  it.each([
    ['unknown topic', { topic: 'sales' }],
    ['empty message', { message: '   ' }],
    ['too long message', { message: 'x'.repeat(5001) }],
    ['bad reply address', { reply: 'not-an-address' }],
    ['header injection in reply', { reply: 'a@b.org\r\nBcc: x@y.org' }],
    ['missing Turnstile token', { 'cf-turnstile-response': '' }],
  ])('rejects %s', (_name, change) => {
    expect(parseForm(form({ ...good, ...change }))).toBe('invalid');
  });
  it('allows no reply address', () => {
    const p = parseForm(form({ ...good, reply: '' }));
    expect(p).toMatchObject({ reply: null });
  });
});

describe('contact form: buildMime', () => {
  it('builds a plain-text UTF-8 message with Reply-To and a Message-ID', () => {
    const { raw, subject } = buildMime(
      {
        topic: 'thanks',
        message: 'Grazie mille — è perfetto',
        reply: 'someone@example.org',
        token: 't',
      },
      'inbox@example.org',
      new Date('2026-11-23T20:00:00Z'),
      'abc',
    );
    expect(subject).toBe('[fiorfelix] Thank you (contact form)');
    expect(raw).toContain('From: fiorfelix contact form <contact-form@fiorfelix.com>\r\n');
    expect(raw).toContain('To: <inbox@example.org>\r\n');
    expect(raw).toContain('Reply-To: <someone@example.org>\r\n');
    expect(raw).toContain('Message-ID: <abc@fiorfelix.com>\r\n');
    expect(raw).toContain('Content-Transfer-Encoding: base64\r\n');
    const body = raw.split('\r\n\r\n')[1]!.replace(/\r\n/g, '');
    const text = new TextDecoder().decode(Uint8Array.from(atob(body), (c) => c.charCodeAt(0)));
    expect(text).toContain('Grazie mille — è perfetto');
    expect(text).toContain('Reply to: someone@example.org');
  });
  it('leaves out Reply-To when no address was given', () => {
    const { raw } = buildMime(
      { topic: 'question', message: 'Hi', reply: null, token: 't' },
      'i@example.org',
      new Date(),
      'x',
    );
    expect(raw).not.toContain('Reply-To');
  });
});

describe('contact form: handle', () => {
  it('verifies Turnstile, sends one e-mail to the configured inbox and redirects to the sent page', async () => {
    const s = setup();
    const r = await s.post(good);
    expect(r.status).toBe(303);
    expect(location(r)).toBe(SENT_PAGE);
    expect(s.fetchMock).toHaveBeenCalledTimes(1);
    const sentBody = (s.fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1]
      .body as FormData;
    expect(sentBody.get('secret')).toBe('test-secret');
    expect(sentBody.get('response')).toBe('token-123');
    expect(sentBody.get('remoteip')).toBe('203.0.113.9');
    expect(s.sent).toHaveLength(1);
    expect(s.sent[0]!.message).toMatchObject({
      from: 'contact-form@fiorfelix.com',
      to: 'inbox@example.org',
    });
  });
  it.each([
    ['failed check', { success: false }],
    ['other hostname', { success: true, hostname: 'evil.example', action: 'contact' }],
    ['other action', { success: true, hostname: 'archives.fiorfelix.com', action: 'login' }],
  ])('sends nothing when Turnstile says %s', async (_n, verdict) => {
    const s = setup(verdict);
    const r = await s.post(good);
    expect(location(r)).toBe(ERROR_PAGE);
    expect(s.sent).toHaveLength(0);
  });
  it('pretends success to bots without checking or sending', async () => {
    const s = setup();
    const r = await s.post({ ...good, website: 'x' });
    expect(location(r)).toBe(SENT_PAGE);
    expect(s.fetchMock).not.toHaveBeenCalled();
    expect(s.sent).toHaveLength(0);
  });
  it('rejects other methods and paths', async () => {
    const s = setup();
    const get = await handle(
      new Request('https://archives.fiorfelix.com/api/contact'),
      s.env,
      s.deps,
    );
    expect(get.status).toBe(405);
    const other = await s.post(good, '/api/other');
    expect(other.status).toBe(404);
  });
  it('fails closed when the secrets are not configured', async () => {
    const s = setup();
    s.env.TURNSTILE_SECRET = '';
    const r = await s.post(good);
    expect(location(r)).toBe(ERROR_PAGE);
    expect(s.sent).toHaveLength(0);
  });
  it('shows the error page if sending fails', async () => {
    const s = setup();
    s.env.EMAIL.send = vi.fn(async () => {
      throw new Error('E_RECIPIENT_NOT_ALLOWED');
    });
    const r = await s.post(good);
    expect(location(r)).toBe(ERROR_PAGE);
  });
});
