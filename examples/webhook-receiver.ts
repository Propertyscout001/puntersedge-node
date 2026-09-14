/**
 * A signed-webhook receiver, with no framework.
 *
 *   PUNTERSEDGE_WEBHOOK_SECRET=... npx tsx examples/webhook-receiver.ts
 *
 * Two things this example is built around, because both are easy to get wrong in a way that
 * looks fine until it doesn't:
 *
 * 1. VERIFY THE RAW BYTES. The API signs a canonical serialisation — keys sorted, no spaces.
 *    `JSON.stringify(parsedBody)` produces different bytes and will never match. Read the body
 *    as bytes, verify, and only then parse.
 *
 * 2. ACK FIRST, WORK LATER. The sender waits 10 seconds and retries once. If your handler does
 *    the work before responding, a slow database turns one event into two deliveries — and your
 *    idempotency, or lack of it, becomes a production problem during a busy card.
 */
import { createServer } from "node:http";
import { verifyWebhookSignature } from "puntersedge";

const SECRET = process.env.PUNTERSEDGE_WEBHOOK_SECRET;
const PORT = Number(process.env.PORT ?? 8787);

if (!SECRET) {
  console.error("Set PUNTERSEDGE_WEBHOOK_SECRET — it is shown once, when you create the webhook.");
  process.exit(1);
}

/** Events already handled, so a redelivery is a no-op. In production this belongs in a store. */
const seen = new Set<string>();

const server = createServer(async (req, res) => {
  if (req.method !== "POST") {
    res.writeHead(405).end();
    return;
  }

  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const raw = Buffer.concat(chunks);

  const ok = await verifyWebhookSignature({
    body: raw,
    signature: req.headers["x-webhook-signature"] as string | undefined,
    secret: SECRET,
  });

  if (!ok) {
    console.warn("rejected an unsigned or mis-signed delivery");
    res.writeHead(401).end();
    return;
  }

  // Acknowledge before doing anything slow.
  res.writeHead(200).end();

  const event = JSON.parse(raw.toString("utf8"));
  const eventType = req.headers["x-puntersedge-event"];
  const id = `${eventType}:${event.race_id ?? ""}:${event.occurred_at ?? ""}`;

  if (seen.has(id)) {
    console.log(`duplicate ${id} — ignored`);
    return;
  }
  seen.add(id);

  console.log(`${eventType}`, JSON.stringify(event).slice(0, 300));
});

server.listen(PORT, () => {
  console.log(`listening on http://localhost:${PORT}`);
  console.log("Expose it (ngrok, cloudflared), register the URL with pe.webhooks.create(),");
  console.log("then pe.webhooks.test(id) to fire a delivery at it.");
});
