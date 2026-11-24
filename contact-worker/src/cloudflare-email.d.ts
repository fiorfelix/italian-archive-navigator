// Minimal type for the Workers runtime module used to send e-mail (Email Routing).
declare module 'cloudflare:email' {
  export class EmailMessage {
    constructor(from: string, to: string, raw: string);
  }
}
