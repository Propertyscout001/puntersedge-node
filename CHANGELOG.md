# Changelog

## 1.3.0

Conditional requests, on by default. Every 200 from the API carries an `ETag`; the client now
remembers it (with the body) per URL and sends `If-None-Match` on the next identical GET. An
unchanged answer comes back `304 Not Modified` for 0 credits and no body, and the client returns
the remembered body, so the call reads exactly as before. `withCredits()` reports it as
`notModified: true`. Up to 32 distinct requests are remembered. Pass
`new PuntersEdge({ conditionalRequests: false })` to switch it off. POST is never conditional.

## 1.2.1 — 2026-09-24

Documentation only. The free tier is 3,000 credits a month, not 1,500; the README said 1,500.
No code changes.

## 1.2.0 — 2026-09-21

Methods for every customer endpoint the API added on 20–21 September. No behaviour changes to
existing methods.

- **`pe.racing.clv(input)`** — score up to 200 bets against the line each race closed at. 5 credits
  per request, Plus and above.
- **`pe.bulk.datasets()`** and **`pe.bulk.download(dataset, period, { format, ifNoneMatch })`** —
  the pre-built dataset files (Business and above; monthly bundles Platform and above). The
  download comes back as bytes with the ETag and row count off the headers; pass the ETag back as
  `ifNoneMatch` and an unchanged file is `{ unchanged: true }`, not charged and not an error.
- **`pe.account.overage()` / `setOverage(enabled)`**, **`teamKeys()` / `mintTeamKey()` /
  `updateTeamKey()` / `revokeTeamKey()`**, **`referral()` / `setReferralPayout()`**.
- `raw()` accepts `PATCH`, and `RequestOptions.responseType: "binary"` returns a body as
  `Uint8Array`. `HttpMethod`, `BulkDownloadOptions` and `BulkDownload` are exported.
- The contract test now lists only the console sign-in flow (`login/*`, `logout`, `keys/reveal`)
  as a deliberate omission: it authenticates a browser session by email, not a key.

## 1.1.0 — 2026-09-21

`runner_ref` on a thoroughbred is not a horse identity, and the generated types said it was.

- **`horse_ref`** is on every thoroughbred runner and placing in results, every live-board
  runner, every closing-line and price-path row (the last column) and both form responses:
  `pe:<name>`, the same value everywhere, and the key that joins one horse across meetings.
  `runner_ref` (`ra:<code>`) is Racing Australia's code for that meeting's entry and changes
  from meeting to meeting — measured 21 September 2026, 1,450 of the 1,452 horses with two or
  more runs carried a different code on each. The types, regenerated from the live OpenAPI
  document, say so; the old text ("a STABLE runner ref ... persists across meetings") is gone.
- **`pe.racing.horses.runs(horse)`** is new: every run we hold for one horse out of our own
  settled results, with a starts/wins/places summary. 3 credits. It is the answer when `form()`
  returns a 503 because Racing Australia is refusing fresh reads.
- Greyhound form and stats are documented as what they are: our own results since
  13 September 2026, keyed by `grv:`/`grsa:` registry refs. Nothing here mentions Topaz any
  more; that feed is not ours and is not served.
- Types regenerated against the 67-path document (was 55): the horse-runs, CLV, bulk-dataset,
  team-key, overage and referral shapes are exported. Those endpoints have no methods yet and
  are listed as deliberate omissions in the contract test; `raw()` reaches them.

No behaviour changes to existing methods.

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
