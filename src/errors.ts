/**
 * Typed errors for the PuntersEdge client.
 *
 * WHY A CLASS PER STATUS. Odds code has to branch on *why* a call failed, and it has to do it
 * without parsing an error string. A 402 means buy more credits; a 429 means wait and try the
 * same call again; a 422 means the request itself is wrong and retrying will fail identically
 * forever. Collapsing those into one `Error` pushes the branch into a regex over `.message`,
 * which is how a "rate limited, back off" path silently starts swallowing "sport_key does not
 * exist".
 *
 * Every error carries the RFC 7807 `Problem` body the API returned, when it returned one, so
 * `err.problem.type` is a stable URI you can switch on and `err.problem.detail` is the
 * explanation. `instanceof PuntersEdgeError` catches everything from this SDK.
 */

import type { UpgradeHint } from "./credits.js";

/** The RFC 7807 problem document the API returns on every error it generates itself. */
export interface Problem {
  /** Stable URI identifying the error class, e.g. `https://puntersedge.online/errors/rate-limit`. */
  type: string;
  /** Short human-readable summary. */
  title: string;
  /** HTTP status code. */
  status: number;
  /**
   * Explanation of this occurrence. A string for most errors; an array of field errors on a
   * 422; an object on a 429.
   */
  detail?: unknown;
  [key: string]: unknown;
}

/** One field-level complaint from a 422. */
export interface FieldError {
  /** Path to the offending input, e.g. `["query", "direction"]`. */
  loc: (string | number)[];
  msg: string;
  type: string;
}

export interface PuntersEdgeErrorInit {
  status?: number;
  problem?: Problem;
  /** Raw response body, when it was not valid JSON or not a Problem. */
  body?: string;
  /** The path that failed, e.g. `/v1/racing/next-to-go`. */
  path?: string;
  headers?: Headers;
  cause?: unknown;
}

/** Base class — `catch (e) { if (e instanceof PuntersEdgeError) ... }` catches every SDK error. */
export class PuntersEdgeError extends Error {
  /** HTTP status, or undefined when the request never got a response. */
  readonly status?: number;
  /** The RFC 7807 body, when the API supplied one. */
  readonly problem?: Problem;
  /** Raw response body (truncated to 2KB), for errors that are not a Problem document. */
  readonly body?: string;
  /** API path that produced this error. */
  readonly path?: string;
  /** Response headers, when there was a response. */
  readonly headers?: Headers;

  constructor(message: string, init: PuntersEdgeErrorInit = {}) {
    super(message, init.cause === undefined ? undefined : { cause: init.cause });
    this.name = new.target.name;
    this.status = init.status;
    this.problem = init.problem;
    this.body = init.body;
    this.path = init.path;
    this.headers = init.headers;
    // Restores `instanceof` when the package is compiled down to ES5 by a consumer's bundler.
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * 401 or 403. The key is missing, wrong, inactive, IP-blocked, or on a plan that does not
 * include this endpoint — the closing-line archive and webhook creation need Standard or above.
 * Retrying will not help; read `problem.detail`.
 */
export class AuthError extends PuntersEdgeError {}

/**
 * 402. The monthly credit allowance is spent.
 *
 * This is NOT a rate limit, and backing off does not clear it — the balance resets on the
 * billing date. `upgrade` carries the API's own recommendation: which plan, what it costs, the
 * link to send a human to, and the exact request to POST to buy it without leaving the shell.
 *
 * Check `upgrade.covers`. `"partial"` means the recommended plan is the largest self-serve tier
 * and is *still* below the measured need, so buying it will not stop the 402s.
 */
export class CreditsExhaustedError extends PuntersEdgeError {
  /** The API's upgrade recommendation, from the `X-Upgrade-*` headers. */
  readonly upgrade?: UpgradeHint;

  constructor(message: string, init: PuntersEdgeErrorInit & { upgrade?: UpgradeHint } = {}) {
    super(message, init);
    this.upgrade = init.upgrade;
  }
}

/**
 * 429. Too many requests per minute for this key's plan. `retryAfter` is the server's own
 * `Retry-After` in seconds — wait that long and repeat the identical call. This SDK never waits
 * for you; see the note on retries in the README.
 *
 * A 429 is not billed, so nothing was spent.
 */
export class RateLimitError extends PuntersEdgeError {
  /** Seconds to wait, from `Retry-After`. The API sends 60 on a per-minute limit. */
  readonly retryAfter?: number;
  /** Requests-per-minute ceiling for this plan, from `X-RateLimit-Limit`. */
  readonly limit?: number;

  constructor(message: string, init: PuntersEdgeErrorInit & {
    retryAfter?: number; limit?: number;
  } = {}) {
    super(message, init);
    this.retryAfter = init.retryAfter;
    this.limit = init.limit;
  }
}

/**
 * 422. The request is malformed — an unknown `sport_key`, an unrecognised bookmaker key, a
 * `direction` other than firming/drifting. These are refused **before billing**, so a 422 costs
 * nothing; `fields` lists what the server objected to.
 */
export class ValidationError extends PuntersEdgeError {
  /** Field-level complaints, when the 422 body carried them. */
  readonly fields: FieldError[];

  constructor(message: string, init: PuntersEdgeErrorInit & { fields?: FieldError[] } = {}) {
    super(message, init);
    this.fields = init.fields ?? [];
  }
}

/** 404. No such race, horse, webhook or route. */
export class NotFoundError extends PuntersEdgeError {}

/** Any 5xx. The request may be fine; the API or an upstream is not. Safe to retry with backoff. */
export class ServerError extends PuntersEdgeError {}

/**
 * The request never completed: DNS failure, connection reset, TLS error, or the timeout /
 * `AbortSignal` fired. `cause` holds the underlying `fetch` rejection.
 */
export class NetworkError extends PuntersEdgeError {}

/** A 4xx this SDK has no dedicated class for. */
export class APIError extends PuntersEdgeError {}

/** True when `value` looks like an RFC 7807 document rather than some other JSON body. */
export function isProblem(value: unknown): value is Problem {
  return (
    typeof value === "object" && value !== null &&
    typeof (value as Problem).type === "string" &&
    typeof (value as Problem).title === "string" &&
    typeof (value as Problem).status === "number"
  );
}
