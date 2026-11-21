// Minimal stand-in for the `cloudflare:workers` runtime module in Node tests.
export class DurableObject {
  constructor(public ctx: unknown, public env: unknown) {}
}
