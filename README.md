# puntersedge — Australian odds API client for TypeScript and JavaScript

Official TypeScript/JavaScript client for the [PuntersEdge odds API](https://puntersedge.online/api?utm_source=node_sdk&utm_medium=npm)
— Australian and New Zealand **racing** odds (AU thoroughbred, greyhound, harness; NZ thoroughbred
and harness) and Australian **sports** odds, priced per bookmaker, with best-price comparison,
settled results, form, a permanent market-movement archive and signed webhooks.

```bash
npm install puntersedge
```

Python? `pip install puntersedge` — [same endpoints, same design](https://pypi.org/project/puntersedge/).

```ts
import { PuntersEdge } from "puntersedge";

const pe = new PuntersEdge({ apiKey: process.env.PUNTERSEDGE_API_KEY });

for (const race of await pe.racing.nextToGo({ numRaces: 5, categories: "horse" })) {
  const best = race.runners
    .flatMap(r => r.bookmakers.map(b => ({ runner: r.name, book: b.key, price: b.win_price })))
    .filter(q => q.price)
    .sort((a, b) => b.price! - a.price!)[0];

  console.log(`${race.venue} R${race.race_number}  best: ${best?.runner} @ ${best?.price} (${best?.book})`);
}

console.log(`${pe.credits?.remaining} credits left`);
```

- **No dependencies.** Standard `fetch` only.
- **Runs anywhere.** Node 18+, Deno, Bun, Cloudflare Workers, Vercel Edge, browsers. ESM and CommonJS.
- **Fully typed.** Every response type is generated from the live OpenAPI document, so the types
  cannot quietly drift from the server.
- **Errors are typed.** A 402 is not a 429 is not a 422, and each carries what you need to act on it.

## What is actually covered

These numbers are recomputed every 30 minutes and published at
[puntersedge.online/coverage-report.json](https://puntersedge.online/coverage-report.json). Read that
rather than this paragraph; the snapshot below was measured **14 Sep 2026 23:06 UTC**.

- **14 Australian bookmakers on racing** — the keys the API returns are `tab`, `tabtouch`,
  `betdeluxe`, `betr_au`, `pointsbetau`, `betright`, `playup`, `palmerbet`, `unibet`, `neds`,
  `ladbrokes_au`, `sportsbet`, `betgold`, `boostbet`. Median books quoting an AU race: **14**
  (mean 13.18) over 1,539 races in the 7-day window.
- **Racing** — AU thoroughbred, harness and greyhound; NZ thoroughbred and harness. There are **no
  NZ greyhounds**. Races in other countries show up only because an AU book lists the meeting: the
  median there is one book, which is not coverage.
- **Sports** — `afl`, `aflw`, `nrl`, `nrlw`, `nba`, `wnba`, `nfl`, `ncaaf`, `mlb`, `nhl`, `mma`,
  `tennis_atp`, `tennis_wta`, `cricket_test`, `cricket_other`, `rugby_union`, `super_league`,
  `soccer_epl`, `soccer_other`, `basketball_other`. **Sports depth is materially thinner than
  racing** — fewer books quote a fixture than quote a race. Check before you build on it.

### What is not here

- **Betfair Exchange and Pinnacle are excluded.** Betfair is ingested for internal reference only and
  withheld from every customer response pending a Betfair data licence; Pinnacle is a non-Australian
  reference book outside the AU comparison set. There are no exchange prices in any response.
- **`racing.nextToGo()` is not AU-only.** Pass `country: "AU"` unless you want everything an AU book
  happens to list.
- **`racing.closingLines()` is plan-gated** and returns 403 on the free tier.
  `racing.priceHistory()` is the free equivalent.
- **`racing.movers()` direction is `"firming"` or `"drifting"`** — not "in"/"out".

Bookmaker names above are identifiers for publicly posted prices. PuntersEdge is not affiliated with,
endorsed by, or an agent of any bookmaker.

## Get a key

1. Sign up at <https://puntersedge.online/api>. Free tier, no card: 1,500 credits/month, 30 requests/minute.
2. Click the verification link. The key is shown on screen and emailed to you.
3. `export PUNTERSEDGE_API_KEY=...`

You can explore without a key at all — see [the sandbox](#the-sandbox-no-key-needed).

## Racing is not a sport key

The single most common first mistake. There is no `sport_key` of `"horse-racing"`.

```ts
await pe.sports.odds("horse-racing");     // ✗ 422
await pe.racing.nextToGo();               // ✓
```

Racing and sports are separate endpoint families because they are separate shapes: a race has
runners, barriers, a venue and a jump time; a fixture has two teams and a market. They are grouped
the same way here.

| | |
|---|---|
| `pe.racing.*` | thoroughbred, greyhound, harness — AU and NZ |
| `pe.sports.*` | AFL, NRL, NBA, and the rest, by sport key |
| `pe.arb.*` | cross-book comparison and arbitrage scanning |
| `pe.account.*` | usage, key metadata, rotation, billing |
| `pe.webhooks.*` | push delivery instead of polling |
| `pe.health.*` | per-connector freshness, public uptime |
| `pe.demo.*` | the sandbox: real prices, truncated, no key |

## Credits, read for free

The API bills per successful request and reports the running balance on **every** response. The
client parses those headers, so checking your balance never costs a call.

```ts
await pe.racing.nextToGo();

pe.credits?.cost;        // 2
pe.credits?.remaining;   // 1088   — or the string "unlimited"
pe.credits?.pctUsed;     // 27.5
pe.credits?.warning;     // "approaching-limit", once you cross the threshold
```

Prefer this to polling `/v1/usage`: the response you just made already answered the question.

For a callback on every billed call — to feed a gauge, or to log:

```ts
const pe = new PuntersEdge({
  apiKey: KEY,
  onCredits: c => { if (c.warning) console.warn(`${c.remaining} credits left`); },
});
```

### What a call costs

| Endpoints | Credits |
|---|---|
| `/v1/usage`, `/v1/billing/portal`, the sandbox, `/v1/uptime` | 0 |
| `sports.list`, `racing.events`, `racing.venues`, `racing.trackConditions`, coverage endpoints | 1 |
| `sports.odds` | **1 per market requested** |
| `racing.nextToGo`, `racing.results`, `racing.changes`, `racing.acceptances`, jockey/trainer stats, `arb.bestPrices` | 2 |
| `racing.bestOdds`, `racing.movers`, form endpoints, `sports.bestOdds`, `arb.sports`, `arb.lines` | 3 |
| `racing.priceHistory`, `racing.closingLines`, `racing.pricePaths`, sports history and movements | 5 |
| `racing.closingLinesCsv`, `racing.pricePathsCsv` | **20** |

A malformed request — an unknown sport key, an unrecognised bookmaker, a bad date — is refused
**before** billing, so a 422 is free.

## Errors

```ts
import {
  PuntersEdgeError, AuthError, CreditsExhaustedError,
  RateLimitError, ValidationError, NotFoundError, ServerError, NetworkError,
} from "puntersedge";

try {
  await pe.racing.movers({ direction: "firming" });
} catch (err) {
  if (err instanceof RateLimitError) {
    // The server told you how long to wait. Wait, then repeat the identical call.
    await new Promise(r => setTimeout(r, (err.retryAfter ?? 60) * 1000));
  } else if (err instanceof CreditsExhaustedError) {
    // Not a rate limit — backing off will not clear it.
    console.error(`Out of credits. ${err.upgrade?.plan} gives ${err.upgrade?.credits}/mo: ${err.upgrade?.url}`);
    if (err.upgrade?.covers === "partial") {
      console.error("…and that is still below your measured need. Email hello@puntersedge.online.");
    }
  } else if (err instanceof ValidationError) {
    // Deterministic: retrying will fail identically forever.
    for (const f of err.fields) console.error(f.loc.join("."), f.msg);
  } else if (err instanceof PuntersEdgeError) {
    console.error(err.status, err.problem?.type, err.message);
  }
}
```

Every error carries the RFC 7807 body the API returned, so `err.problem.type` is a stable URI you
can switch on, documented at [puntersedge.online/developers/errors](https://puntersedge.online/developers/errors).

### Nothing is retried for you

Deliberately. Odds are time-sensitive: a transparent retry inside the client can hand you a price
recorded before a move you would have acted on, and it can double a billed call without telling
you. Retry at the layer that knows whether a stale answer is acceptable.

```ts
async function withRetry<T>(call: () => Promise<T>, attempts = 3): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      return await call();
    } catch (err) {
      const retryable = err instanceof RateLimitError || err instanceof ServerError;
      if (!retryable || i >= attempts - 1) throw err;
      const wait = err instanceof RateLimitError
        ? (err.retryAfter ?? 60) * 1000
        : 2 ** i * 1000;
      await new Promise(r => setTimeout(r, wait));
    }
  }
}
```

Note what is missing from that list: `CreditsExhaustedError` and `ValidationError` are never
retried, because neither will ever succeed on a second attempt.

## Polling a live board

Do not loop `nextToGo`. It re-downloads every race every time and bills 2 credits for the
privilege. `changes` returns only what moved since a timestamp, and hands back the cursor for the
next call.

```ts
let since = new Date(Date.now() - 60_000).toISOString();

setInterval(async () => {
  const batch = await pe.racing.changes({ since, categories: ["horse", "greyhound"] });
  for (const race of batch.races ?? []) applyUpdate(race);
  since = batch.server_time;          // the cursor for the next poll
}, 15_000);
```

`server_time` is deliberately set back 30 seconds from the server clock so an in-flight write is
never skipped. That makes the feed **at-least-once**: you will occasionally see a race twice, so
`applyUpdate` must be idempotent.

For anything slower than a few seconds, a [webhook](#webhooks) is cheaper still.

## Freshness

A stalled scraper does not return an error — it keeps serving its last value, which is exactly what
a live price looks like. Every quote carries its own age:

```ts
const quotes = race.runners[0].bookmakers.filter(b => !b.stale && (b.age_seconds ?? 0) < 120);
```

And `pe.health.connectors()` reports `last_ok` per bookmaker, which is how you tell a quiet market
from a broken feed.

## Webhooks

Creating a subscription needs the Standard plan or above.

> `verifyWebhookSignature` uses WebCrypto via `globalThis.crypto`, so it works unchanged in
> Deno, Bun, Workers and browsers. **Node 18 does not expose `globalThis.crypto`** — on 18,
> pass it in: `import { webcrypto } from "node:crypto"` then
> `verifyWebhookSignature({ body, signature, secret, crypto: webcrypto })`. Node 19+ needs
> nothing. Without it the call throws with that instruction rather than returning a wrong
> answer.

```ts
const hook = await pe.webhooks.create({
  url: "https://example.com/pe-hook",
  events: ["race.odds_open"],
});
console.log(hook.secret);   // shown once — store it
```

Every delivery is signed. Verify against the **raw body**, before anything parses it:

```ts
import express from "express";
import { verifyWebhookSignature } from "puntersedge";

app.post("/pe-hook", express.raw({ type: "application/json" }), async (req, res) => {
  const ok = await verifyWebhookSignature({
    body: req.body,                                    // a Buffer, unparsed
    signature: req.header("X-Webhook-Signature"),
    secret: process.env.PUNTERSEDGE_WEBHOOK_SECRET!,
  });
  if (!ok) return res.sendStatus(401);

  res.sendStatus(200);                                 // ack fast
  queue.push(JSON.parse(req.body.toString("utf8")));    // work later
});
```

> `JSON.stringify(req.body)` will never match. The API signs a canonical serialisation — keys
> sorted, no whitespace — and your framework's re-serialisation differs. Hash the bytes you
> received.

When nothing arrives, `pe.webhooks.deliveries(id)` shows the attempts and the response codes your
endpoint returned.

## The sandbox, no key needed

Real prices, truncated to 3 races, 5 runners and 3 bookmakers. 0 credits, no signup — so the
example in *your* README stays runnable by someone who has not signed up yet.

```ts
const pe = new PuntersEdge();                 // no key
const { races } = await pe.demo.nextToGo();
```

## Bulk history

The archive endpoints stream CSV in a stable column order, which is the format a modeller actually
wants:

```ts
const csv = await pe.racing.closingLinesCsv({ date: "2026-09-01", category: "horse" });
await writeFile("closing-lines.csv", csv);
```

**CSV costs 20 credits, not 5.** These two endpoints are the only ones on the API whose price
depends on the format you ask for, and the reason is size: the server caps a CSV pull at 50,000
rows against 5,000 for a JSON page, so one call can return ten times the data for four times the
price. If you are paging a small window, ask for JSON.

## Runtime notes

**Timeouts and cancellation.** 30 seconds by default; override per client or per call, and pass
your own `AbortSignal` whenever you have one.

```ts
await pe.racing.nextToGo({ timeoutMs: 5_000, signal: req.signal });
```

**Connection reuse matters more than anything you can tune server-side.** Measured against this
API: a cold TLS handshake costs 137ms against 40.5ms on a reused connection. Node's global fetch
agent pools by default — so reuse one `PuntersEdge` instance for the life of your process rather
than constructing one per request.

**Compression.** Responses are JSON and compress about 9x. Node, Deno and Bun request gzip
automatically. If you supply your own `fetch`, make sure it does too.

**Endpoints newer than this package.** `pe.raw()` reaches anything:

```ts
const { data, credits, headers } = await pe.raw("GET", "/v1/racing/something-new", { limit: 5 });
```

## CommonJS

```js
const { PuntersEdge } = require("puntersedge");
```

## Contributing

```bash
npm install
npm run types:generate     # regenerate src/types.generated.ts from the live schema
npm run typecheck
npm run build
npm test                   # unit + contract tests, offline
PUNTERSEDGE_API_KEY=... node --test test/live.test.mjs
```

`test/contract.test.mjs` checks every call this client can make against the API's own OpenAPI
document — every path template must exist and every query parameter must be one the server
declares. That is the test that catches the failure mode a stubbed unit test cannot: a mis-mapped
parameter name that the server silently ignores while returning a cheerful 200.

## Also available

- **Python** — `pip install puntersedge` ([PyPI](https://pypi.org/project/puntersedge/)), same
  endpoints, same design.
- **MCP server** — `pip install puntersedge-mcp` ([PyPI](https://pypi.org/project/puntersedge-mcp/)),
  the fuller of the two servers, for Claude, Cursor and other agent hosts. A TypeScript MCP server
  also exists and installs straight from GitHub with
  `npx -y github:Propertyscout001/puntersedge-mcp`. **There is no npm package called
  `puntersedge-mcp`** — `npm install -g puntersedge-mcp` will not work. See
  [/developers/mcp-server](https://puntersedge.online/developers/mcp-server).
- **Examples** — [puntersedge-examples](https://github.com/Propertyscout001/puntersedge-examples):
  runnable scripts, starters, n8n workflows and a Google Sheets connector.
- **Postman** — import <https://api.puntersedge.online/postman.json>.

## Licence

MIT. Data licensing is separate: internal use is included on every plan, showing prices to end
users needs attribution on Plus and above, and redistribution needs Platform. See
[the terms](https://puntersedge.online/terms).

---

Odds data is provided for informational and analytical use only. This is not betting advice and no
return of any kind is claimed or implied. 18+ only. Gambling can be addictive — please gamble
responsibly. Gambling Help: 1800 858 858.
