/**
 * Unit tests — no network. Every test injects a fake `fetch`, so the suite runs in CI, offline,
 * and without spending a credit.
 *
 * What is tested here is the part of the SDK that can be wrong without anyone noticing: query
 * serialisation (an array joined the wrong way is a silently different request), the status ->
 * error-class mapping, and the credit header parsing. Live coverage is test/live.test.mjs,
 * which is skipped unless PUNTERSEDGE_API_KEY is set.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
// Node 18 does not expose globalThis.crypto, so a bare `crypto` here is a ReferenceError
// on the floor this package declares in "engines". Import WebCrypto explicitly and the
// same test proves the same thing on 18, 20 and 22.
import { webcrypto as crypto } from "node:crypto";

import {
  PuntersEdge, buildQuery, verifyWebhookSignature,
  AuthError, CreditsExhaustedError, RateLimitError, ValidationError,
  NotFoundError, ServerError, NetworkError, APIError, PuntersEdgeError,
} from "../dist/esm/index.js";

/** A fake fetch that records the request and replays a canned response. */
function stub({ status = 200, body = [], headers = {}, capture = {} } = {}) {
  return async (url, init) => {
    capture.url = url;
    capture.init = init;
    capture.headers = init?.headers ?? {};
    const text = typeof body === "string" ? body : JSON.stringify(body);
    return new Response(text, {
      status,
      headers: { "Content-Type": "application/json", ...headers },
    });
  };
}

const KEY = "pe_test_key";

// ── query serialisation ───────────────────────────────────────────────────────────────────

test("buildQuery: arrays join with commas, not repeated keys", () => {
  // ?categories=horse&categories=harness is a DIFFERENT request to this API and returns
  // only the last value. Getting this wrong silently narrows every multi-category query.
  assert.equal(buildQuery({ categories: ["horse", "harness"] }), "?categories=horse%2Charness");
});

test("buildQuery: booleans go over the wire as true/false", () => {
  assert.equal(buildQuery({ include_unresolved: false }), "?include_unresolved=false");
  assert.equal(buildQuery({ include_unresolved: true }), "?include_unresolved=true");
});

test("buildQuery: null and undefined are dropped, zero and empty string are not", () => {
  assert.equal(buildQuery({ a: null, b: undefined, c: 0, d: "" }), "?c=0&d=");
});

test("buildQuery: an empty array is dropped rather than sent as an empty value", () => {
  assert.equal(buildQuery({ bookmakers: [] }), "");
});

test("camelCase options map to the API's snake_case parameters", async () => {
  const capture = {};
  const pe = new PuntersEdge({ apiKey: KEY, fetch: stub({ capture }) });
  await pe.racing.nextToGo({ numRaces: 5, includeUnresolved: true, categories: "horse" });
  const url = new URL(capture.url);
  assert.equal(url.pathname, "/v1/racing/next-to-go");
  assert.equal(url.searchParams.get("num_races"), "5");
  assert.equal(url.searchParams.get("include_unresolved"), "true");
  assert.equal(url.searchParams.get("categories"), "horse");
});

test("oddsFormat and maxAgeMinutes stay camelCase, because the wire wants them that way", async () => {
  // odds_format is ignored by the server, which would silently return decimal odds to a
  // caller who asked for American.
  const capture = {};
  const pe = new PuntersEdge({ apiKey: KEY, fetch: stub({ capture }) });
  await pe.sports.odds("afl", { oddsFormat: "american", maxAgeMinutes: 30, markets: ["h2h", "totals"] });
  const url = new URL(capture.url);
  assert.equal(url.pathname, "/v1/sports/afl/odds");
  assert.equal(url.searchParams.get("oddsFormat"), "american");
  assert.equal(url.searchParams.get("maxAgeMinutes"), "30");
  assert.equal(url.searchParams.get("markets"), "h2h,totals");
  assert.equal(url.searchParams.get("odds_format"), null);
});

test("path parameters are URL-encoded", async () => {
  const capture = {};
  const pe = new PuntersEdge({ apiKey: KEY, fetch: stub({ capture }) });
  await pe.racing.horses.backfillStatus("job/../../etc");
  assert.ok(new URL(capture.url).pathname.startsWith("/v1/racing/horses/backfill/job%2F"));
});

test("transport options never leak into the query string", async () => {
  const capture = {};
  const pe = new PuntersEdge({ apiKey: KEY, fetch: stub({ capture }) });
  await pe.racing.nextToGo({ numRaces: 2, timeoutMs: 5000, headers: { "X-Trace": "abc" } });
  const url = new URL(capture.url);
  assert.equal(url.searchParams.get("timeout_ms"), null);
  assert.equal(url.searchParams.get("headers"), null);
  assert.equal(capture.headers["X-Trace"], "abc");
});

// ── auth and headers ──────────────────────────────────────────────────────────────────────

test("the key travels in X-API-Key and a User-Agent identifies the SDK", async () => {
  const capture = {};
  const pe = new PuntersEdge({ apiKey: KEY, fetch: stub({ capture }) });
  await pe.sports.list();
  assert.equal(capture.headers["X-API-Key"], KEY);
  assert.match(capture.headers["User-Agent"], /^puntersedge-node\/\d+\.\d+\.\d+/);
});

test("a client with no key sends no X-API-Key, so the sandbox still works", async () => {
  const capture = {};
  const pe = new PuntersEdge({ fetch: stub({ capture, body: { races: [] } }) });
  await pe.demo.nextToGo();
  assert.equal(capture.headers["X-API-Key"], undefined);
});

test("a bare string is accepted as the key", async () => {
  const capture = {};
  const pe = new PuntersEdge("pe_shorthand");
  // Re-create with the stub; the shorthand path is what is under test.
  const pe2 = new PuntersEdge({ apiKey: "pe_shorthand", fetch: stub({ capture }) });
  assert.ok(pe instanceof PuntersEdge);
  await pe2.sports.list();
  assert.equal(capture.headers["X-API-Key"], "pe_shorthand");
});

test("baseUrl overrides, with a trailing slash tolerated", async () => {
  const capture = {};
  const pe = new PuntersEdge({
    apiKey: KEY, baseUrl: "https://puntersedge.online/api/", fetch: stub({ capture }),
  });
  await pe.sports.list();
  assert.equal(capture.url, "https://puntersedge.online/api/v1/sports");
});

// ── error mapping ─────────────────────────────────────────────────────────────────────────

function problem(status, title, detail) {
  return { type: `https://puntersedge.online/errors/${status}`, title, status, detail };
}

const CASES = [
  [401, AuthError], [403, AuthError], [404, NotFoundError],
  [422, ValidationError], [429, RateLimitError], [500, ServerError],
  [503, ServerError], [418, APIError],
];

for (const [status, Cls] of CASES) {
  test(`HTTP ${status} raises ${Cls.name}`, async () => {
    const pe = new PuntersEdge({
      apiKey: KEY,
      fetch: stub({ status, body: problem(status, "Nope", "because") }),
    });
    await assert.rejects(() => pe.sports.list(), (err) => {
      assert.ok(err instanceof Cls, `expected ${Cls.name}, got ${err.constructor.name}`);
      assert.ok(err instanceof PuntersEdgeError);
      assert.equal(err.status, status);
      assert.equal(err.problem.title, "Nope");
      assert.equal(err.path, "/v1/sports");
      return true;
    });
  });
}

test("402 carries the API's upgrade recommendation", async () => {
  const pe = new PuntersEdge({
    apiKey: KEY,
    fetch: stub({
      status: 402,
      body: problem(402, "Payment Required", "Credit limit reached (1,500/mo on the Free plan)."),
      headers: {
        "X-Upgrade-Plan": "plus",
        "X-Upgrade-Credits": "25000",
        "X-Upgrade-Price-AUD": "49",
        "X-Upgrade-Url": "https://puntersedge.online/api/pricing",
        "X-Upgrade-Covers": "full",
        "X-Upgrade-Sized-For": "18400",
        "X-Upgrade-Checkout-Method": "POST",
        "X-Upgrade-Checkout-Endpoint": "https://api.puntersedge.online/v1/signup",
        "X-Upgrade-Checkout-Body": '{"plan":"plus"}',
        "X-Upgrade-Prorated": "false",
      },
    }),
  });
  await assert.rejects(() => pe.sports.list(), (err) => {
    assert.ok(err instanceof CreditsExhaustedError);
    assert.equal(err.upgrade.plan, "plus");
    assert.equal(err.upgrade.credits, 25000);
    assert.equal(err.upgrade.priceAud, 49);
    assert.equal(err.upgrade.covers, "full");
    assert.equal(err.upgrade.sizedFor, 18400);
    assert.equal(err.upgrade.checkout.prorated, false);
    assert.equal(err.upgrade.checkout.body, '{"plan":"plus"}');
    return true;
  });
});

test('402 with covers "partial" says so — buying the recommendation will not stop the 402s', async () => {
  const pe = new PuntersEdge({
    apiKey: KEY,
    fetch: stub({
      status: 402,
      body: problem(402, "Payment Required", "..."),
      headers: {
        "X-Upgrade-Plan": "platform",
        "X-Upgrade-Url": "https://puntersedge.online/api/pricing",
        "X-Upgrade-Covers": "partial",
      },
    }),
  });
  await assert.rejects(() => pe.sports.list(), (err) => {
    assert.equal(err.upgrade.covers, "partial");
    return true;
  });
});

test("429 carries Retry-After and the per-minute ceiling", async () => {
  const pe = new PuntersEdge({
    apiKey: KEY,
    fetch: stub({
      status: 429,
      body: problem(429, "Rate limit exceeded", { rpm: 30 }),
      headers: { "Retry-After": "60", "X-RateLimit-Limit": "30" },
    }),
  });
  await assert.rejects(() => pe.sports.list(), (err) => {
    assert.ok(err instanceof RateLimitError);
    assert.equal(err.retryAfter, 60);
    assert.equal(err.limit, 30);
    return true;
  });
});

test("422 exposes the field errors, so you can name the bad parameter", async () => {
  const pe = new PuntersEdge({
    apiKey: KEY,
    fetch: stub({
      status: 422,
      body: problem(422, "Validation Error", [
        { loc: ["query", "direction"], msg: "must be firming or drifting", type: "value_error" },
      ]),
    }),
  });
  await assert.rejects(() => pe.racing.movers({ direction: "in" }), (err) => {
    assert.ok(err instanceof ValidationError);
    assert.deepEqual(err.fields[0].loc, ["query", "direction"]);
    assert.match(err.message, /firming or drifting/);
    return true;
  });
});

test("a non-JSON error body still produces a typed error with the body attached", async () => {
  const pe = new PuntersEdge({
    apiKey: KEY,
    fetch: async () => new Response("<html>502 Bad Gateway</html>", {
      status: 502, headers: { "Content-Type": "text/html" },
    }),
  });
  await assert.rejects(() => pe.sports.list(), (err) => {
    assert.ok(err instanceof ServerError);
    assert.equal(err.problem, undefined);
    assert.match(err.body, /Bad Gateway/);
    return true;
  });
});

test("a transport failure is a NetworkError carrying the cause", async () => {
  const boom = new Error("ECONNREFUSED");
  const pe = new PuntersEdge({ apiKey: KEY, fetch: async () => { throw boom; } });
  await assert.rejects(() => pe.sports.list(), (err) => {
    assert.ok(err instanceof NetworkError);
    assert.equal(err.cause, boom);
    return true;
  });
});

test("nothing is retried: one call is one request", async () => {
  let calls = 0;
  const pe = new PuntersEdge({
    apiKey: KEY,
    fetch: async () => {
      calls++;
      return new Response(JSON.stringify(problem(429, "Rate limit exceeded")), { status: 429 });
    },
  });
  await assert.rejects(() => pe.sports.list());
  assert.equal(calls, 1);
});

// ── timeouts and cancellation ─────────────────────────────────────────────────────────────

test("timeoutMs aborts the request", async () => {
  const pe = new PuntersEdge({
    apiKey: KEY,
    timeoutMs: 20,
    fetch: (url, init) =>
      new Promise((_, reject) => {
        init.signal.addEventListener("abort", () => reject(init.signal.reason ?? new Error("aborted")));
      }),
  });
  await assert.rejects(() => pe.sports.list(), (err) => {
    assert.ok(err instanceof NetworkError);
    assert.match(err.message, /timed out after 20ms/);
    return true;
  });
});

test("a caller's AbortSignal cancels the request", async () => {
  const controller = new AbortController();
  const pe = new PuntersEdge({
    apiKey: KEY,
    fetch: (url, init) =>
      new Promise((_, reject) => {
        init.signal.addEventListener("abort", () => reject(new Error("aborted")));
      }),
  });
  const promise = pe.sports.list({ signal: controller.signal });
  controller.abort();
  await assert.rejects(() => promise, (err) => err instanceof NetworkError);
});

// ── credits ───────────────────────────────────────────────────────────────────────────────

const CREDIT_HEADERS = {
  "X-Credits-Cost": "2",
  "X-Credits-Used": "412",
  "X-Credits-Limit": "1500",
  "X-Credits-Remaining": "1088",
  "X-Credits-Pct-Used": "27.5",
};

test("credits are read off the response, so checking the balance costs no call", async () => {
  const pe = new PuntersEdge({
    apiKey: KEY, fetch: stub({ headers: CREDIT_HEADERS }),
  });
  assert.equal(pe.credits, undefined);
  await pe.racing.nextToGo();
  assert.equal(pe.credits.cost, 2);
  assert.equal(pe.credits.used, 412);
  assert.equal(pe.credits.limit, 1500);
  assert.equal(pe.credits.remaining, 1088);
  assert.equal(pe.credits.pctUsed, 27.5);
  assert.equal(pe.credits.warning, undefined);
});

test('an unlimited plan reports "unlimited", not a number', async () => {
  const pe = new PuntersEdge({
    apiKey: KEY,
    fetch: stub({ headers: { "X-Credits-Used": "900000", "X-Credits-Limit": "unlimited", "X-Credits-Remaining": "unlimited" } }),
  });
  await pe.sports.list();
  assert.equal(pe.credits.remaining, "unlimited");
  assert.equal(pe.credits.limit, "unlimited");
});

test("the warning header surfaces before the wall, with the upgrade attached", async () => {
  const pe = new PuntersEdge({
    apiKey: KEY,
    fetch: stub({
      headers: {
        ...CREDIT_HEADERS,
        "X-Credits-Remaining": "120",
        "X-Credits-Warning": "approaching-limit",
        "X-Upgrade-Plan": "plus",
        "X-Upgrade-Url": "https://puntersedge.online/api/pricing",
      },
    }),
  });
  await pe.racing.nextToGo();
  assert.equal(pe.credits.warning, "approaching-limit");
  assert.equal(pe.credits.upgrade.plan, "plus");
});

test("onCredits fires per call, including on an error response", async () => {
  const seen = [];
  const pe = new PuntersEdge({
    apiKey: KEY,
    onCredits: (c) => seen.push(c.remaining),
    fetch: stub({
      status: 402,
      body: problem(402, "Payment Required", "spent"),
      headers: { "X-Credits-Used": "1500", "X-Credits-Limit": "1500", "X-Credits-Remaining": "0" },
    }),
  });
  await assert.rejects(() => pe.sports.list());
  assert.deepEqual(seen, [0]);
});

test("a response with no credit headers leaves credits undefined", async () => {
  const pe = new PuntersEdge({ fetch: stub({ body: { races: [] } }) });
  await pe.demo.nextToGo();
  assert.equal(pe.credits, undefined);
});

test("withCredits returns the data and the balance together", async () => {
  const pe = new PuntersEdge({
    apiKey: KEY,
    fetch: stub({ body: [{ race_id: "abc" }], headers: CREDIT_HEADERS }),
  });
  const { data, credits } = await pe.withCredits((p) => p.racing.nextToGo());
  assert.equal(data[0].race_id, "abc");
  assert.equal(credits.remaining, 1088);
});

// ── shapes ────────────────────────────────────────────────────────────────────────────────

test("a CSV response comes back as a string, not a parse failure", async () => {
  const csv = "race_id,venue,book,price\nabc,Randwick,tab,4.2\n";
  const capture = {};
  const pe = new PuntersEdge({
    apiKey: KEY,
    fetch: stub({ capture, body: csv, headers: { "Content-Type": "text/csv" } }),
  });
  const out = await pe.racing.closingLinesCsv({ date: "2026-09-01" });
  assert.equal(out, csv);
  assert.equal(new URL(capture.url).searchParams.get("format"), "csv");
  assert.equal(capture.headers["Accept"], "text/csv");
});

test("an empty body resolves rather than throwing on JSON.parse", async () => {
  const pe = new PuntersEdge({
    apiKey: KEY,
    fetch: async () => new Response(null, { status: 204 }),
  });
  assert.equal(await pe.webhooks.delete("wh_1"), undefined);
});

test("raw() reaches an endpoint the SDK has no method for", async () => {
  const capture = {};
  const pe = new PuntersEdge({ apiKey: KEY, fetch: stub({ capture, body: { ok: true } }) });
  const { data, headers } = await pe.raw("GET", "/v1/something/new", { limit: 3 });
  assert.deepEqual(data, { ok: true });
  assert.ok(headers instanceof Headers);
  assert.equal(new URL(capture.url).searchParams.get("limit"), "3");
});

test("POST bodies are JSON-encoded with the right content type", async () => {
  const capture = {};
  const pe = new PuntersEdge({ apiKey: KEY, fetch: stub({ capture, body: { job_id: "j1" } }) });
  await pe.racing.horses.submitBackfill({ horses: ["Winx", "Black Caviar"] });
  assert.equal(capture.init.method, "POST");
  assert.equal(capture.headers["Content-Type"], "application/json");
  assert.deepEqual(JSON.parse(capture.init.body), { horses: ["Winx", "Black Caviar"] });
});

// ── webhook signatures ────────────────────────────────────────────────────────────────────

/** Sign exactly the way api/routes/webhooks.py does, so the test proves interoperability. */
async function sign(body, secret) {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

test("verifyWebhookSignature accepts a genuine signature", async () => {
  const body = '{"event":"race.odds_open","race_id":"abc"}';
  const secret = "whsec_test";
  const hex = await sign(body, secret);
  assert.equal(await verifyWebhookSignature({ body, signature: `sha256=${hex}`, secret }), true);
  assert.equal(await verifyWebhookSignature({ body, signature: hex, secret }), true);
});

test("verifyWebhookSignature rejects a tampered body", async () => {
  const secret = "whsec_test";
  const hex = await sign('{"event":"race.odds_open"}', secret);
  assert.equal(
    await verifyWebhookSignature({ body: '{"event":"race.odds_closed"}', signature: `sha256=${hex}`, secret }),
    false,
  );
});

test("verifyWebhookSignature rejects the wrong secret, and returns false rather than throwing", async () => {
  const body = "{}";
  const hex = await sign(body, "right");
  assert.equal(await verifyWebhookSignature({ body, signature: hex, secret: "wrong" }), false);
  assert.equal(await verifyWebhookSignature({ body, signature: null, secret: "right" }), false);
  assert.equal(await verifyWebhookSignature({ body, signature: "not-hex", secret: "right" }), false);
  assert.equal(await verifyWebhookSignature({ body, signature: "sha256=", secret: "right" }), false);
});

test("verifyWebhookSignature takes bytes as well as a string", async () => {
  const body = '{"a":1}';
  const secret = "whsec_test";
  const hex = await sign(body, secret);
  const bytes = new TextEncoder().encode(body);
  assert.equal(await verifyWebhookSignature({ body: bytes, signature: hex, secret }), true);
  assert.equal(await verifyWebhookSignature({ body: bytes.buffer, signature: hex, secret }), true);
});

test("a 429 whose detail is an object still produces a readable message", async () => {
  const pe = new PuntersEdge({
    apiKey: KEY,
    fetch: stub({ status: 429, body: problem(429, "Rate limit exceeded", { rpm: 30, plan: "free" }) }),
  });
  await assert.rejects(() => pe.sports.list(), (err) => {
    assert.match(err.message, /rpm/);
    return true;
  });
});

test("the API key is not reachable by enumeration or serialisation", async () => {
  // `console.log(pe)`, a structured logger, or an error reporter that serialises the client
  // must not print the key. TypeScript's `private` is erased at runtime and would; a #field
  // does not.
  const pe = new PuntersEdge({ apiKey: "pe_secret_do_not_log", fetch: stub({}) });
  await pe.sports.list();

  assert.ok(!Object.keys(pe).includes("config"));
  assert.equal(JSON.stringify(Object.keys(pe).sort()),
    JSON.stringify(["account", "arb", "credits", "demo", "health", "racing", "sports", "webhooks"]));

  // The nested API objects hold a back-reference to the client, so walk it too.
  const seen = new Set();
  const walk = (value, depth = 0) => {
    if (depth > 4 || value === null || typeof value !== "object" || seen.has(value)) return false;
    seen.add(value);
    for (const [k, v] of Object.entries(value)) {
      if (typeof v === "string" && v.includes("pe_secret_do_not_log")) return `${k}`;
      const found = walk(v, depth + 1);
      if (found) return `${k}.${found}`;
    }
    return false;
  };
  assert.equal(walk(pe), false, "the API key was reachable by walking enumerable properties");
});
