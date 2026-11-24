/**
 * Contact form handler. Kept free of Workers-only imports so it can be tested in Node.
 * Flow: POST form -> checks -> Turnstile siteverify -> e-mail to the verified inbox -> 303 redirect.
 * Nothing is stored and nothing is logged.
 */

export const HOST = 'archives.fiorfelix.com';
export const SENDER = 'contact-form@fiorfelix.com';
export const SENT_PAGE = '/contact-sent';
export const ERROR_PAGE = '/contact-error';
/** The Italian form sends lang=it and gets the Italian result pages. */
export const PAGES_IT = { sent: '/it/contatti-inviato', error: '/it/contatti-errore' };
export const MAX_BODY_BYTES = 20_000;
export const MAX_MESSAGE = 5000;

export const TOPICS: Record<string, string> = {
  question: 'Question',
  correction: 'Correction',
  thanks: 'Thank you',
  other: 'Message',
};

export interface Env {
  TURNSTILE_SECRET: string;
  CONTACT_TO: string;
  EMAIL: { send(message: unknown): Promise<void> };
}

export interface Deps {
  fetch: typeof fetch;
  makeMessage: (from: string, to: string, raw: string) => unknown;
  now?: () => Date;
  uuid?: () => string;
}

export interface ContactForm {
  topic: string;
  message: string;
  reply: string | null;
  token: string;
}

const EMAIL_RE = /^[^\s@<>"(),;:\\[\]]+@[^\s@<>"(),;:\\[\]]+\.[^\s@<>"(),;:\\[\]]+$/;

/** Validates the submitted fields. Returns the form, 'bot' for the hidden trap, or an error code. */
export function parseForm(form: FormData): ContactForm | 'bot' | 'invalid' {
  const get = (k: string) => {
    const v = form.get(k);
    return typeof v === 'string' ? v : '';
  };
  if (get('website').trim() !== '') return 'bot';
  const topic = get('topic');
  const message = get('message').replace(/\r\n?/g, '\n').trim();
  const reply = get('reply').trim();
  const token = get('cf-turnstile-response');
  if (!(topic in TOPICS)) return 'invalid';
  if (message.length === 0 || message.length > MAX_MESSAGE) return 'invalid';
  if (reply !== '' && (reply.length > 254 || !EMAIL_RE.test(reply))) return 'invalid';
  if (token === '' || token.length > 4096) return 'invalid';
  return { topic, message, reply: reply === '' ? null : reply, token };
}

/** Asks Turnstile whether the token is valid for this site and form. */
export async function verifyTurnstile(
  doFetch: typeof fetch,
  secret: string,
  token: string,
  ip: string | null,
): Promise<boolean> {
  const body = new FormData();
  body.set('secret', secret);
  body.set('response', token);
  if (ip) body.set('remoteip', ip);
  try {
    const res = await doFetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body,
    });
    if (!res.ok) return false;
    const out = (await res.json()) as { success?: boolean; hostname?: string; action?: string };
    return out.success === true && out.hostname === HOST && out.action === 'contact';
  } catch {
    return false;
  }
}

const base64 = (text: string) => {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
};

/** Builds a plain-text MIME message. Header values come only from fixed text or validated input. */
export function buildMime(
  form: ContactForm,
  to: string,
  date: Date,
  id: string,
): { subject: string; raw: string } {
  const subject = `[fiorfelix] ${TOPICS[form.topic]} (contact form)`;
  const body = `${form.message}\n\n--\nTopic: ${TOPICS[form.topic]}\nReply to: ${form.reply ?? '(no address given)'}\nSent through the contact form on ${HOST}.\n`;
  const lines = [
    `From: fiorfelix contact form <${SENDER}>`,
    `To: <${to}>`,
    ...(form.reply ? [`Reply-To: <${form.reply}>`] : []),
    `Subject: ${subject}`,
    `Message-ID: <${id}@fiorfelix.com>`,
    `Date: ${date.toUTCString().replace('GMT', '+0000')}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: base64',
    '',
    ...(base64(body).match(/.{1,76}/g) ?? []),
    '',
  ];
  return { subject, raw: lines.join('\r\n') };
}

const redirect = (path: string) =>
  new Response(null, { status: 303, headers: { Location: `https://${HOST}${path}` } });

export async function handle(request: Request, env: Env, deps: Deps): Promise<Response> {
  const url = new URL(request.url);
  if (url.pathname !== '/api/contact') return new Response('Not found', { status: 404 });
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: { Allow: 'POST' } });
  }
  const type = request.headers.get('content-type') ?? '';
  if (!/^(application\/x-www-form-urlencoded|multipart\/form-data)/i.test(type)) {
    return redirect(ERROR_PAGE);
  }
  const length = Number(request.headers.get('content-length') ?? '0');
  if (length > MAX_BODY_BYTES) return redirect(ERROR_PAGE);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return redirect(ERROR_PAGE);
  }
  const italian = form.get('lang') === 'it';
  const sent = italian ? PAGES_IT.sent : SENT_PAGE;
  const failed = italian ? PAGES_IT.error : ERROR_PAGE;
  const parsed = parseForm(form);
  if (parsed === 'bot') return redirect(sent); // say nothing useful to bots
  if (parsed === 'invalid') return redirect(failed);

  if (!env.TURNSTILE_SECRET || !env.CONTACT_TO) return redirect(failed);
  const ok = await verifyTurnstile(
    deps.fetch,
    env.TURNSTILE_SECRET,
    parsed.token,
    request.headers.get('cf-connecting-ip'),
  );
  if (!ok) return redirect(failed);

  const { raw } = buildMime(
    parsed,
    env.CONTACT_TO,
    deps.now?.() ?? new Date(),
    deps.uuid?.() ?? crypto.randomUUID(),
  );
  try {
    await env.EMAIL.send(deps.makeMessage(SENDER, env.CONTACT_TO, raw));
  } catch {
    return redirect(failed);
  }
  return redirect(sent);
}
