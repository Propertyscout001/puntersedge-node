# Changelog

## 1.0.2 — 2026-09-12

Corrected the repository URL. 1.0.0 and 1.0.1 declared
`github.com/puntersedge/puntersedge-node` for both `repository` and `bugs`.

**That account is not ours.** `puntersedge` on GitHub exists and belongs to someone else —
its public repos are ATP Betfair tooling, a holding-company website and an ASP.NET forum.
Every PuntersEdge repo lives under `Propertyscout001`. npm renders the repository link on
the package page, so those two releases pointed anyone looking for the source at a
stranger's account.

Inherited from the 0.1.0 stub published in June, which declared
`github.com/puntersedge/node-sdk` for the same reason, and not questioned when this package
replaced it.

No code changed.

## 1.0.1 — 2026-09-11

Corrected the credit cost on the two CSV archive methods, and added a test so it cannot
happen again.

`closingLinesCsv` and `pricePathsCsv` said "same filters, same 5 credits". CSV on those
endpoints is **20 credits**, not 5 — they are the only two on the API whose price depends
on the format, because a CSV pull is capped at 50,000 rows against 5,000 for a JSON page
and is priced as the bulk export it is. The schema said so all along ("Cost: 5 credits
(JSON) / 20 credits (CSV)"); 1.0.0 read the first figure out of that sentence and stopped.

An understated cost is the harmful direction: a reader budgets from the doc comment and
runs out earlier than they planned. `test/contract.test.mjs` now checks every stated cost
against the operation's own description in the OpenAPI document, and resolves the
JSON/CSV split by method name. Reintroducing the old figure fails the suite.

No API surface changed. Upgrading is documentation only.

## 1.0.0 — 2026-09-11

First release of the rewritten client.

Zero dependencies, ESM and CommonJS, 48 methods covering the whole customer-facing read
surface. Runs on Node 18+, Deno, Bun, Cloudflare Workers, Vercel Edge and in the browser.

- Response types generated from the live OpenAPI document rather than hand-written.
- One error class per status: a 402 is not a 429 is not a 422, and each carries what you
  need to act on it — including the `X-Upgrade-*` recommendation on a 402.
- Nothing is retried silently. Odds are time-sensitive and a hidden retry can return a
  price recorded before a move.
- Credit balance parsed from the response headers, so checking it never costs a call.
- Webhook signature verification over raw bytes, using WebCrypto.
- The API key is held in a `#private` field, so `console.log(client)` cannot print it.

Supersedes 0.1.0 (2026-06-07), a five-method stub whose homepage pointed at a URL that now
redirects.
