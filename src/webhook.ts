/**
 * Verify the signature on a delivered webhook.
 *
 * Every delivery carries `X-Webhook-Signature: sha256=<hex>`, an HMAC-SHA256 over the **exact
 * bytes of the request body**, keyed with the secret the API returned when you created the
 * subscription.
 *
 * THE MISTAKE THIS FUNCTION EXISTS TO PREVENT. Most web frameworks parse JSON for you, so the
 * obvious implementation is `JSON.stringify(req.body)` and hash that. It will never match. The
 * API signs a canonical serialisation — keys sorted, no spaces — and your framework's
 * re-serialisation will differ in key order or whitespace. Hash the raw body you received,
 * before anything parses it:
 *
 * ```ts
 * // Express
 * app.post("/hook", express.raw({ type: "application/json" }), async (req, res) => {
 *   const ok = await verifyWebhookSignature({
 *     body: req.body,                                  // a Buffer, unparsed
 *     signature: req.header("X-Webhook-Signature"),
 *     secret: process.env.PUNTERSEDGE_WEBHOOK_SECRET!,
 *   });
 *   if (!ok) return res.sendStatus(401);
 *   const event = JSON.parse(req.body.toString("utf8"));
 *   res.sendStatus(200);                               // ack fast, work later
 * });
 * ```
 *
 * ```ts
 * // Cloudflare Workers / Hono / any Fetch-API runtime
 * const raw = await request.text();
 * const ok = await verifyWebhookSignature({
 *   body: raw, signature: request.headers.get("X-Webhook-Signature"), secret: SECRET,
 * });
 * ```
 *
 * Uses WebCrypto, so it runs unchanged on Node 19+, Deno, Bun, Cloudflare Workers and in the
 * browser, with no dependency on `node:crypto`. Node 18 is the one exception: it has no
 * `globalThis.crypto`, so pass `crypto: webcrypto` from `node:crypto` there.
 */

export interface VerifyOptions {
  /** The raw request body, exactly as received — a string, `Buffer`, `Uint8Array` or `ArrayBuffer`. */
  body: string | Uint8Array | ArrayBuffer;
  /** The `X-Webhook-Signature` header value, with or without the `sha256=` prefix. */
  signature: string | null | undefined;
  /** The subscription's signing secret, shown once when the webhook was created. */
  secret: string;
  /** Supply your own WebCrypto, for a runtime where it is not global. */
  crypto?: Crypto;
}

function toBytes(body: string | Uint8Array | ArrayBuffer): Uint8Array {
  if (typeof body === "string") return new TextEncoder().encode(body);
  if (body instanceof Uint8Array) return body;
  return new Uint8Array(body);
}

function hex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let out = "";
  for (let i = 0; i < bytes.length; i++) out += bytes[i].toString(16).padStart(2, "0");
  return out;
}

/**
 * Constant-time string comparison.
 *
 * `a === b` on hex digests leaks, through timing, how many leading characters an attacker got
 * right, which turns forging a signature into 64 cheap guesses instead of one impossible one.
 * Both strings are lower-cased by the caller, and length is folded into the result rather than
 * short-circuiting on it.
 */
function timingSafeEqual(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

/**
 * True when `signature` is a valid HMAC-SHA256 of `body` under `secret`.
 *
 * Returns false — never throws — for a missing, malformed or wrong signature, so a bad delivery
 * is a 401 rather than a 500 in your logs.
 */
export async function verifyWebhookSignature(options: VerifyOptions): Promise<boolean> {
  const { body, signature, secret } = options;
  if (!signature || !secret) return false;

  const subtle = (options.crypto ?? globalThis.crypto)?.subtle;
  if (!subtle) {
    throw new Error(
      "No WebCrypto available. Node 19+, Deno, Bun, Workers and browsers have it as a " +
      "global; Node 18 does not, so pass one: import { webcrypto } from 'node:crypto' " +
      "then verifyWebhookSignature({ crypto: webcrypto, ... }).",
    );
  }

  const provided = (signature.startsWith("sha256=") ? signature.slice(7) : signature)
    .trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(provided)) return false;

  const key = await subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await subtle.sign("HMAC", key, toBytes(body) as BufferSource);

  return timingSafeEqual(hex(mac), provided);
}
