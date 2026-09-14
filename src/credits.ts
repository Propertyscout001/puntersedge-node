/**
 * Credit accounting, read off the headers of the response you already made.
 *
 * WHY THIS EXISTS. The API bills per successful request and reports the running balance on
 * every single response — `X-Credits-Remaining`, plus a `X-Credits-Warning` once you cross the
 * warning threshold and an `X-Upgrade-*` block telling you exactly what to buy and how. Polling
 * `/v1/usage` to learn the same thing is a round-trip that answers a question the last response
 * already answered.
 *
 * So the client parses the headers on every call and hands them to you three ways:
 *
 *   client.credits                       // the most recent snapshot, or undefined
 *   new PuntersEdge({ onCredits })       // a callback fired after every billed call
 *   await client.withCredits(c => ...)   // data and credits together for one call
 *
 * `remaining` and `limit` are `"unlimited"` on an unlimited plan rather than a number, because
 * that is what the header says and coercing it to `Infinity` would let `remaining < 100` quietly
 * mean something different on two plans.
 */

/** A plan the API suggests when the balance is running low or spent. */
export interface UpgradeHint {
  /** Internal plan id (`plus`, `platform`). Note the id `racing` is sold as **Standard**. */
  plan: string;
  /** Monthly credit allowance on that plan. */
  credits?: number;
  /** Monthly price in AUD. */
  priceAud?: number;
  /** Page to send a human to. */
  url: string;
  /**
   * `"full"` when the suggested plan covers the measured need; `"partial"` when it is the
   * largest self-serve plan and is *still* short — in which case buying it will not stop the
   * 402s, and the API says so in the problem detail.
   */
  covers?: "full" | "partial";
  /** Measured monthly need the suggestion was sized against. Absent when sizing fell back to the cap alone. */
  sizedFor?: number;
  /** How to buy it without leaving the shell. */
  checkout?: {
    method: string;
    /** `/v1/billing/upgrade` for an existing subscriber, `/v1/signup` for a free key. */
    endpoint: string;
    /** JSON body to POST, verbatim. */
    body: string;
    /**
     * True when this is an in-place prorated upgrade against the subscription you already
     * have: you pay the difference for the rest of the period and keep your billing date.
     * False means a fresh checkout at full price.
     */
    prorated: boolean;
  };
}

/** What one response said about your balance. */
export interface Credits {
  /** Credits this call cost. 0 for `/v1/usage`, the sandbox, and anything refused before billing. */
  cost?: number;
  /** Credits used this billing period. */
  used?: number;
  /** Monthly allowance, or `"unlimited"`. */
  limit?: number | "unlimited";
  /** Credits left this period, or `"unlimited"`. */
  remaining?: number | "unlimited";
  /** Percentage of the allowance used, to one decimal place. */
  pctUsed?: number;
  /** Set once you cross the warning threshold; the only in-band signal before the wall. */
  warning?: "approaching-limit";
  /** Present alongside a warning, and on every 402. */
  upgrade?: UpgradeHint;
}

function num(h: Headers, name: string): number | undefined {
  const v = h.get(name);
  if (v === null) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function countOrUnlimited(h: Headers, name: string): number | "unlimited" | undefined {
  const v = h.get(name);
  if (v === null) return undefined;
  if (v === "unlimited") return "unlimited";
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/** Pull the `X-Upgrade-*` block off a response, or undefined when the API did not send one. */
export function parseUpgrade(h: Headers): UpgradeHint | undefined {
  const plan = h.get("X-Upgrade-Plan");
  const url = h.get("X-Upgrade-Url");
  if (!plan || !url) return undefined;

  const method = h.get("X-Upgrade-Checkout-Method");
  const endpoint = h.get("X-Upgrade-Checkout-Endpoint");
  const body = h.get("X-Upgrade-Checkout-Body");
  const covers = h.get("X-Upgrade-Covers");

  return {
    plan,
    url,
    credits: num(h, "X-Upgrade-Credits"),
    priceAud: num(h, "X-Upgrade-Price-AUD"),
    covers: covers === "full" || covers === "partial" ? covers : undefined,
    sizedFor: num(h, "X-Upgrade-Sized-For"),
    checkout: method && endpoint && body !== null
      ? { method, endpoint, body, prorated: h.get("X-Upgrade-Prorated") === "true" }
      : undefined,
  };
}

/**
 * Pull the credit block off a response. Returns undefined when the response carried no
 * `X-Credits-*` headers at all — the sandbox endpoints and `/v1/uptime` take no key and bill
 * nothing, so there is nothing to report.
 */
export function parseCredits(h: Headers): Credits | undefined {
  if (h.get("X-Credits-Remaining") === null && h.get("X-Credits-Used") === null) {
    return undefined;
  }
  const warning = h.get("X-Credits-Warning");
  return {
    cost: num(h, "X-Credits-Cost"),
    used: num(h, "X-Credits-Used"),
    limit: countOrUnlimited(h, "X-Credits-Limit"),
    remaining: countOrUnlimited(h, "X-Credits-Remaining"),
    pctUsed: num(h, "X-Credits-Pct-Used"),
    warning: warning === "approaching-limit" ? warning : undefined,
    upgrade: parseUpgrade(h),
  };
}
