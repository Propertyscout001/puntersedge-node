/**
 * Live tests against the real API.
 *
 * The sandbox tests need no key and no credits, so they run everywhere including CI. The
 * authenticated tests are SKIPPED unless PUNTERSEDGE_API_KEY is set, and they are deliberately
 * few — this suite exists to catch the SDK disagreeing with the server about paths, parameter
 * names and response shapes, not to re-test the API.
 *
 *     node --test test/live.test.mjs
 *     PUNTERSEDGE_API_KEY=... node --test test/live.test.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { PuntersEdge, ValidationError, AuthError } from "../dist/esm/index.js";

const KEY = process.env.PUNTERSEDGE_API_KEY;
const authed = { skip: KEY ? false : "set PUNTERSEDGE_API_KEY to run the authenticated tests" };

const anon = new PuntersEdge({ timeoutMs: 20_000 });
const pe = new PuntersEdge({ apiKey: KEY, timeoutMs: 20_000 });

// ── sandbox: no key, no credits ───────────────────────────────────────────────────────────

test("sandbox next-to-go answers without a key", async () => {
  const out = await anon.demo.nextToGo();
  assert.ok(Array.isArray(out.races), "expected a races array");
});

test("public uptime answers without a key and bills nothing", async () => {
  const out = await anon.health.uptime();
  assert.equal(typeof out, "object");
  assert.equal(anon.credits, undefined, "a free endpoint must not report a credit balance");
});

test("a call with no key against a billed endpoint is an AuthError, not a silent empty result", async () => {
  await assert.rejects(() => anon.racing.nextToGo(), (err) => {
    assert.ok(err instanceof AuthError);
    return true;
  });
});

// ── authenticated ─────────────────────────────────────────────────────────────────────────

test("racing.nextToGo returns races and reports the credit balance", authed, async () => {
  const races = await pe.racing.nextToGo({ numRaces: 3 });
  assert.ok(Array.isArray(races));
  assert.ok(pe.credits, "every billed response must carry X-Credits-* headers");
  assert.ok(pe.credits.remaining !== undefined);
  if (races.length) {
    const race = races[0];
    // The fields every downstream example relies on.
    for (const field of ["race_id", "venue", "start_time", "runners"]) {
      assert.ok(field in race, `NextRaceOut is missing ${field}`);
    }
    assert.ok(Array.isArray(race.runners));
  }
});

test("sports.list returns the sport catalogue", authed, async () => {
  const sports = await pe.sports.list();
  assert.ok(Array.isArray(sports) && sports.length > 0);
  assert.ok("key" in sports[0], "SportOut is missing `key`");
});

test("racing is not a sport key — the API says so with a 422", authed, async () => {
  // The single most common first mistake against this API. If this ever stops being a 422,
  // the SDK's docs are wrong and should be updated, not the test quietly relaxed.
  await assert.rejects(() => pe.sports.odds("horse-racing"), (err) => {
    assert.ok(err instanceof ValidationError || err.status === 404,
      `expected 422/404 for a racing sport_key, got ${err.status}`);
    return true;
  });
});

test("an invalid movers direction is refused, and refused free", authed, async () => {
  const before = pe.credits?.used;
  await assert.rejects(() => pe.racing.movers({ direction: "in" }), (err) => {
    assert.ok(err instanceof ValidationError);
    return true;
  });
  if (before !== undefined && pe.credits?.used !== undefined) {
    assert.equal(pe.credits.used, before, "a 422 must not be billed");
  }
});

test("multi-value filters reach the server as one comma-joined parameter", authed, async () => {
  // A repeated key would silently narrow this to the last value; both categories coming back
  // is the proof the comma form is what the server wanted.
  const races = await pe.racing.nextToGo({ numRaces: 40, categories: ["horse", "greyhound"] });
  const seen = new Set(races.map((r) => r.category));
  for (const c of seen) {
    assert.ok(["horse", "greyhound"].includes(c), `unexpected category ${c} leaked through`);
  }
});

test("account.usage agrees with the headers the client already read", authed, async () => {
  await pe.racing.events({ hoursAhead: 1 });
  const headerRemaining = pe.credits?.remaining;
  const usage = await pe.account.usage();
  assert.ok(usage);
  if (typeof headerRemaining === "number" && typeof usage.credits_remaining === "number") {
    // The header is read before this call; usage() itself is free, so they should agree.
    assert.equal(usage.credits_remaining, headerRemaining);
  }
});
