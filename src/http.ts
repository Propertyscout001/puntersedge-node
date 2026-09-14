/**
 * The transport: one `fetch`, one place where a non-2xx becomes a typed error.
 *
 * Runs anywhere `fetch`, `AbortController` and `Headers` exist — Node 18+, Deno, Bun,
 * Cloudflare Workers, Vercel Edge, and browsers. There are no dependencies and nothing is
 * imported from `node:*`, so a bundler targeting the edge does not have to polyfill anything.
 *
 * NOTHING IS RETRIED HERE, on purpose. Odds are time-sensitive. A transparent retry inside the
 * client can hand you a price recorded before a move you would have seen, and it can double a
 * billed call without telling you. Retry deliberately, at the layer that knows whether a stale
 * answer is acceptable — `RateLimitError.retryAfter` gives you the wait the server asked for.
 */

import {
  APIError, AuthError, CreditsExhaustedError, NetworkError, NotFoundError,
  PuntersEdgeError, RateLimitError, ServerError, ValidationError,
  isProblem, type FieldError, type Problem,
} from "./errors.js";
import { parseCredits, parseUpgrade, type Credits } from "./credits.js";

/** A query value the client knows how to serialise. */
export type QueryValue = string | number | boolean | null | undefined | (string | number)[];
export type Query = Record<string, QueryValue>;

/** A response with its credit accounting alongside. */
export interface Result<T> {
  data: T;
  /** Undefined for the sandbox and other endpoints that take no key and bill nothing. */
  credits?: Credits;
  /** Raw response headers, for anything this SDK does not model. */
  headers: Headers;
}

export interface RequestOptions {
  /** Abort this call. Composed with the client's `timeoutMs`, whichever fires first. */
  signal?: AbortSignal;
  /** Override the client's timeout for this call. */
  timeoutMs?: number;
  /** Extra headers for this call. */
  headers?: Record<string, string>;
}

export interface TransportConfig {
  baseUrl: string;
  apiKey?: string;
  timeoutMs: number;
  userAgent: string;
  fetch: typeof globalThis.fetch;
  onCredits?: (credits: Credits) => void;
}

/**
 * Serialise query parameters.
 *
 * Booleans go over the wire as `true`/`false`. Arrays are joined with commas rather than
 * repeated, because that is what this API's `categories`, `bookmakers`, `country` and `venue`
 * parameters expect — `?categories=horse&categories=harness` is not the same request as
 * `?categories=horse,harness` and only the second one works. `null` and `undefined` are dropped,
 * so an unset option is an absent parameter rather than the string "undefined".
 */
export function buildQuery(params: Query | undefined): string {
  if (!params) return "";
  const usp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined) continue;
    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      usp.set(key, value.join(","));
    } else if (typeof value === "boolean") {
      usp.set(key, value ? "true" : "false");
    } else {
      usp.set(key, String(value));
    }
  }
  const qs = usp.toString();
  return qs ? "?" + qs : "";
}

/** Read a body as JSON, falling back to text. Never throws. */
async function readBody(res: Response): Promise<{ json?: unknown; text?: string }> {
  const raw = await res.text().catch(() => "");
  if (!raw) return {};
  try {
    return { json: JSON.parse(raw), text: raw };
  } catch {
    return { text: raw };
  }
}

function fieldErrors(problem: Problem | undefined): FieldError[] {
  const detail = problem?.detail;
  if (!Array.isArray(detail)) return [];
  return detail.filter(
    (d): d is FieldError =>
      typeof d === "object" && d !== null && Array.isArray((d as FieldError).loc),
  );
}

/**
 * Render `problem.detail` into one line.
 *
 * The API types `detail` three ways deliberately: a string for most errors, an ARRAY of field
 * errors on a 422, and an OBJECT on a 429. Only handling the string case leaves the two most
 * actionable errors reading `422 Validation Error` — a message that tells a developer nothing
 * about which parameter they got wrong.
 */
function renderDetail(detail: unknown): string | undefined {
  if (detail === undefined || detail === null) return undefined;
  if (typeof detail === "string") return detail;

  if (Array.isArray(detail)) {
    const parts = detail.map((d) => {
      if (typeof d === "object" && d !== null && Array.isArray((d as FieldError).loc)) {
        const fe = d as FieldError;
        // `["query", "direction"]` reads better as `direction` than as the full path.
        const field = fe.loc.filter((p) => p !== "body" && p !== "query" && p !== "path").join(".");
        return field ? `${field}: ${fe.msg}` : fe.msg;
      }
      return typeof d === "string" ? d : JSON.stringify(d);
    });
    return parts.length ? parts.join("; ") : undefined;
  }

  if (typeof detail === "object") {
    try {
      return JSON.stringify(detail);
    } catch {
      return undefined;
    }
  }
  return String(detail);
}

/** Best available human-readable message: the Problem's own words, else the raw body, else the status. */
function messageFor(res: Response, problem: Problem | undefined, text: string | undefined): string {
  if (problem) {
    const detail = renderDetail(problem.detail);
    return detail && detail !== problem.title
      ? `${res.status} ${problem.title}: ${detail}`
      : `${res.status} ${problem.title}`;
  }
  const snippet = (text ?? "").trim().slice(0, 300);
  return snippet ? `HTTP ${res.status}: ${snippet}` : `HTTP ${res.status} ${res.statusText}`;
}

function toError(res: Response, path: string, body: { json?: unknown; text?: string }): PuntersEdgeError {
  const problem = isProblem(body.json) ? body.json : undefined;
  const init = {
    status: res.status,
    problem,
    body: body.text?.slice(0, 2048),
    path,
    headers: res.headers,
  };
  const message = messageFor(res, problem, body.text);

  switch (res.status) {
    case 401:
    case 403:
      return new AuthError(message, init);
    case 402:
      return new CreditsExhaustedError(message, { ...init, upgrade: parseUpgrade(res.headers) });
    case 404:
      return new NotFoundError(message, init);
    case 422:
      return new ValidationError(message, { ...init, fields: fieldErrors(problem) });
    case 429: {
      const retry = Number(res.headers.get("Retry-After"));
      const limit = Number(res.headers.get("X-RateLimit-Limit"));
      return new RateLimitError(message, {
        ...init,
        retryAfter: Number.isFinite(retry) ? retry : undefined,
        limit: Number.isFinite(limit) ? limit : undefined,
      });
    }
    default:
      return res.status >= 500 ? new ServerError(message, init) : new APIError(message, init);
  }
}

/**
 * Compose the caller's signal with a timeout.
 *
 * `AbortSignal.any` landed in Node 20 and is still missing in enough runtimes that relying on it
 * would narrow where this package works, so the fallback wires the listener by hand.
 */
function withTimeout(signal: AbortSignal | undefined, ms: number): {
  signal: AbortSignal;
  done: () => void;
} {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(new Error(`timed out after ${ms}ms`)),
    ms,
  );
  const onAbort = () => controller.abort(signal?.reason);
  if (signal) {
    if (signal.aborted) onAbort();
    else signal.addEventListener("abort", onAbort, { once: true });
  }
  return {
    signal: controller.signal,
    done: () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    },
  };
}

export async function request<T>(
  config: TransportConfig,
  method: "GET" | "POST" | "DELETE",
  path: string,
  params?: Query,
  jsonBody?: unknown,
  options: RequestOptions = {},
): Promise<Result<T>> {
  const url = config.baseUrl + path + buildQuery(params);

  const headers: Record<string, string> = {
    Accept: "application/json",
    "User-Agent": config.userAgent,
    ...options.headers,
  };
  if (config.apiKey) headers["X-API-Key"] = config.apiKey;
  if (jsonBody !== undefined) headers["Content-Type"] = "application/json";

  const { signal, done } = withTimeout(
    options.signal,
    options.timeoutMs ?? config.timeoutMs,
  );

  let res: Response;
  try {
    res = await config.fetch(url, {
      method,
      headers,
      body: jsonBody === undefined ? undefined : JSON.stringify(jsonBody),
      signal,
    });
  } catch (cause) {
    throw new NetworkError(
      `${method} ${path} failed: ${cause instanceof Error ? cause.message : String(cause)}`,
      { path, cause },
    );
  } finally {
    done();
  }

  const credits = parseCredits(res.headers);
  // Reported even on an error: a 402 still tells you the balance, and that is the response
  // where a caller most needs it.
  if (credits && config.onCredits) config.onCredits(credits);

  if (!res.ok) throw toError(res, path, await readBody(res));

  // 204 and an empty 200 (DELETE /v1/webhooks/{id}) have no body to parse.
  if (res.status === 204) return { data: undefined as T, credits, headers: res.headers };
  const body = await readBody(res);
  if (body.text === undefined || body.text === "") {
    return { data: undefined as T, credits, headers: res.headers };
  }
  if (!("json" in body)) {
    // A 2xx that is not JSON: the CSV format on the archive endpoints comes back this way.
    return { data: body.text as unknown as T, credits, headers: res.headers };
  }
  return { data: body.json as T, credits, headers: res.headers };
}
