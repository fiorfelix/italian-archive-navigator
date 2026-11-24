import { EmailMessage } from 'cloudflare:email';
import { handle, type Env } from './handler.js';

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    return handle(request, env, {
      fetch: (input, init) => fetch(input, init),
      makeMessage: (from, to, raw) => new EmailMessage(from, to, raw),
    });
  },
};
