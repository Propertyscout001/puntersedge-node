/**
 * The PuntersEdge client.
 *
 * Endpoints are grouped the way the API groups them, because the split is real and getting it
 * wrong is the single most common first mistake against this API: **racing is not a sport key.**
 * There is no `sport_key` of `"horse-racing"`. Thoroughbred, greyhound and harness live under
 * `pe.racing.*`; AFL, NRL, NBA and the rest live under `pe.sports.*`.
 *
 *   pe.racing.*      thoroughbred, greyhound and harness — AU and NZ
 *   pe.sports.*      Australian sports odds by sport key
 *   pe.arb.*         cross-book price comparison and arbitrage scanning
 *   pe.account.*     usage, key metadata, rotation, billing portal
 *   pe.webhooks.*    push delivery instead of polling
 *   pe.health.*      per-connector freshness and public uptime
 *   pe.demo.*        the sandbox: real prices, truncated, no key, no credits
 *
 * Option names are camelCase and map to the API's snake_case query parameters. Two parameters
 * are camelCase on the wire too (`oddsFormat`, `maxAgeMinutes`); those pass through untouched.
 */

import { request, type Query, type RequestOptions, type Result, type TransportConfig } from "./http.js";
import type { Credits } from "./credits.js";
import type {
  AcceptancesOut, ArchiveCoverageOut, BackfillStatusOut, BackfillSubmitOut,
  BestOddsEventOut, BestPricesOut, ClosingLinesOut, ConnectorHealthOut,
  GreyhoundFormOut, GreyhoundStatsOut, HorseFormOut, LinesArbOut, MoverOut,
  NextRaceOut, PremiershipOut, PriceHistoryOut, PricePathsOut, RaceEventOut,
  RaceResultOut, RacingBestOddsOut, RacingChangesOut, ResultsCoverageOut,
  SportOddsEventOut, SportOut, SportsArbOut, TrackConditionsOut, UsageOut,
  VenueOut, WebhookDeliveryResponse, WebhookResponse,
} from "./types.generated.js";

export const VERSION = "1.0.2";

/** Default base URL. The API is also reachable at `https://puntersedge.online/api`. */
export const DEFAULT_BASE_URL = "https://api.puntersedge.online";

/**
 * These go over the wire camelCase. Every other option key is converted to snake_case, so
 * `numRaces` becomes `num_races` — but `oddsFormat` must NOT become `odds_format`, which the
 * server would ignore, silently returning decimal odds to a caller who asked for American.
 */
const WIRE_CAMEL = new Set(["oddsFormat", "maxAgeMinutes"]);

function toWireKey(key: string): string {
  if (WIRE_CAMEL.has(key)) return key;
  return key.replace(/[A-Z]/g, (c) => "_" + c.toLowerCase());
}

/**
 * camelCase options object -> the query object the transport serialises.
 *
 * Takes `object` rather than `Record<string, unknown>`: a TypeScript interface without an index
 * signature is not assignable to `Record`, and every options type in this file is an interface.
 */
function q(options: object | undefined): Query | undefined {
  if (!options) return undefined;
  const out: Query = {};
  for (const [key, value] of Object.entries(options)) {
    if (value === undefined || value === null) continue;
    out[toWireKey(key)] = value as Query[string];
  }
  return out;
}

/** Split a caller's options object into API parameters and per-request transport options. */
function split(options: object | undefined): {
  params: Query | undefined;
  request: RequestOptions;
} {
  if (!options) return { params: undefined, request: {} };
  const { signal, timeoutMs, headers, ...rest } = options as RequestOptions & object;
  return { params: q(rest), request: { signal, timeoutMs, headers } };
}

// ── shared option shapes ──────────────────────────────────────────────────────────────────

/** Per-call transport controls, accepted by every method. */
export interface CallOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
  headers?: Record<string, string>;
}

/** Filters shared by the live racing endpoints. */
export interface RacingFilterOptions extends CallOptions {
  /** `horse`, `greyhound`, `harness` — one, or several. Omit for all three. */
  categories?: string | string[];
  /** ISO country codes, e.g. `"AU"` or `["AU", "NZ"]`. Omit for every country. */
  country?: string | string[];
  /**
   * Include races whose country has not been resolved yet. Off by default. Late-card races can
   * sit country-unresolved for a while, so a `country` filter can hide races you wanted.
   */
  includeUnresolved?: boolean;
}

/** Bookmaker restriction. An unrecognised key is a free 422 naming the valid keys. */
export interface BookmakerFilter {
  bookmakers?: string | string[];
}

export interface PageOptions {
  limit?: number;
  offset?: number;
}

// ── racing ────────────────────────────────────────────────────────────────────────────────

export interface NextToGoOptions extends RacingFilterOptions, BookmakerFilter {
  /** Up to 200. Pass 200 to pull every currently quoted race in one call instead of paging. */
  numRaces?: number;
  /** Venue names, e.g. `"Randwick"` or `["Randwick", "Flemington"]`. Case-insensitive. */
  venue?: string | string[];
}

export interface RaceEventsOptions extends RacingFilterOptions {
  hoursAhead?: number;
}

export interface RacingBestOddsOptions extends RacingFilterOptions, BookmakerFilter {
  /** Up to 150. Pass 150 to compare every race on the day's card in one call. */
  numRaces?: number;
}

export interface MoversOptions extends RacingFilterOptions, PageOptions {
  /** `"firming"`, `"drifting"`, or omit for both. Anything else is a 422. */
  direction?: "firming" | "drifting";
  /** Minimum consensus move, in percent. */
  minMovePct?: number;
  /** Only report a move confirmed by at least this many books. */
  minBooks?: number;
  maxMinsToJump?: number;
}

export interface RaceResultsOptions extends CallOptions, PageOptions {
  /** How far back to look, in hours. Max 7 days. */
  hoursBack?: number;
  /** `YYYY-MM-DD` — that meeting date (AET) instead of a rolling window. */
  date?: string;
  categories?: string | string[];
  /** Case-insensitive venue match, e.g. `"Rosehill"`. */
  venue?: string;
  country?: string | string[];
  status?: "final" | "interim" | "abandoned";
}

export interface PriceHistoryOptions extends CallOptions, BookmakerFilter {
  /** Race id. If omitted, give `venue` + `raceNumber` + `date`. */
  raceId?: string;
  venue?: string;
  raceNumber?: number;
  /** Race date, `YYYY-MM-DD` (UTC). */
  date?: string;
  /** False returns open/close/high/low only, without the individual ticks. */
  includePoints?: boolean;
  /** Cap on returned points; the response flags truncation. */
  maxPoints?: number;
}

/** Filters shared by the two permanent-archive endpoints. */
export interface ArchiveOptions extends CallOptions, PageOptions, BookmakerFilter {
  /** ISO date/time on the race start. Defaults to the archive floor. */
  from?: string;
  /** ISO date/time. Defaults to now. */
  to?: string;
  /** Single-day alias for `from`+`to`. Mutually exclusive with them. */
  date?: string;
  /** Venue name, case-insensitive, exact match. */
  venue?: string;
  category?: "horse" | "harness" | "greyhound";
  /** Two-letter country code. */
  country?: string;
  raceId?: string;
  /** Include rows flagged `venue_split_suspect` or `name_fragment_suspect`. Off by default. */
  includeFlagged?: boolean;
}

export interface ClosingLinesOptions extends ArchiveOptions {
  /** Only rows whose last observation was within 300s of the jump. True by default. */
  closingOnly?: boolean;
  /** Only rows from races that have a result. */
  resultedOnly?: boolean;
}

export interface RacingChangesOptions extends RacingFilterOptions {
  /**
   * ISO 8601 UTC timestamp — required. On the first call use a recent one; afterwards pass the
   * cursor the previous response handed back, so you never poll the same window twice.
   */
  since: string;
}

export interface AcceptancesOptions extends CallOptions {
  /** Meeting day, Australia/Sydney, `YYYY-MM-DD`. Up to 3 days back and 3 days forward. */
  date?: string;
  /** One meeting, case-insensitive. Omit for every meeting on the day. */
  venue?: string;
}

export interface TrackConditionsOptions extends CallOptions {
  /** Meeting day, Australia/Sydney, `YYYY-MM-DD`. Up to 7 days back. */
  date?: string;
  venue?: string;
}

export interface PremiershipOptions extends CallOptions {
  /** Find one person by (partial) name across every state and scope. */
  name?: string;
  /** `AUS` (national) or a state. Defaults to AUS unless `name` widens the search. */
  state?: string;
  scope?: "all" | "metro" | "provincial" | "country" | "picnic";
  /** `current` or `previous` RA season (1 Aug – 31 Jul). */
  season?: "current" | "previous";
}

/**
 * Thoroughbred and greyhound form, and the paced bulk backfill queue.
 *
 * Form is collected from Racing Australia and Topaz on a deliberate pace — the upstream rate-
 * limits hard, and a burst gets the whole estate flagged. `backfill` is the supported way to ask
 * for many horses: you submit a batch, the queue collects them at a sustainable rate, and you
 * collect the results when they land. Looping `form()` over 400 horses is the unsupported way.
 */
class HorsesAPI {
  constructor(private readonly pe: PuntersEdge) {}

  /** Form, career record and profile for one horse. 3 credits. */
  form(horse: string, options?: CallOptions): Promise<HorseFormOut> {
    return this.pe.get<HorseFormOut>("/v1/racing/horses/form", { horse, ...options });
  }

  /** Queue a batch of horses for paced form collection. 3 credits. */
  submitBackfill(
    body: { horses: string[]; [key: string]: unknown },
    options?: CallOptions,
  ): Promise<BackfillSubmitOut> {
    return this.pe.post<BackfillSubmitOut>("/v1/racing/horses/backfill", body, options);
  }

  /** Progress of a backfill job. 3 credits. */
  backfillStatus(jobId: string, options?: CallOptions): Promise<BackfillStatusOut> {
    return this.pe.get<BackfillStatusOut>(
      `/v1/racing/horses/backfill/${encodeURIComponent(jobId)}`, options);
  }

  /** Collect the form of the horses this job has delivered so far. 3 credits. */
  backfillResults(
    jobId: string,
    options?: CallOptions & PageOptions,
  ): Promise<unknown> {
    return this.pe.get(
      `/v1/racing/horses/backfill/${encodeURIComponent(jobId)}/results`, options);
  }

  /** Cancel the horses a job has not collected yet. Free. */
  cancelBackfill(jobId: string, options?: CallOptions): Promise<unknown> {
    return this.pe.delete(
      `/v1/racing/horses/backfill/${encodeURIComponent(jobId)}`, options);
  }
}

class GreyhoundsAPI {
  constructor(private readonly pe: PuntersEdge) {}

  /**
   * Form history for one dog. 3 credits.
   * `dog` is a name or a Topaz dogId; names match case- and punctuation-insensitively.
   */
  form(dog: string, options?: CallOptions & { limit?: number }): Promise<GreyhoundFormOut> {
    return this.pe.get<GreyhoundFormOut>("/v1/racing/greyhounds/form", { dog, ...options });
  }

  /**
   * Record by track, distance, box or grade. 3 credits.
   * `by` crosses dimensions: `["track", "distance"]` groups by both.
   */
  stats(
    dog: string,
    options?: CallOptions & { by?: string | string[] },
  ): Promise<GreyhoundStatsOut> {
    return this.pe.get<GreyhoundStatsOut>("/v1/racing/greyhounds/stats", { dog, ...options });
  }
}

/** Thoroughbred, greyhound and harness racing across Australia and New Zealand. */
class RacingAPI {
  readonly horses: HorsesAPI;
  readonly greyhounds: GreyhoundsAPI;

  // Assigned in the body rather than as field initializers: under ES2022 class fields, field
  // initializers run BEFORE a constructor parameter property is assigned, so `new
  // HorsesAPI(this.pe)` in an initializer would hand it `undefined`.
  private readonly pe: PuntersEdge;

  constructor(pe: PuntersEdge) {
    this.pe = pe;
    this.horses = new HorsesAPI(pe);
    this.greyhounds = new GreyhoundsAPI(pe);
  }

  /**
   * Races about to jump, with runners and live per-bookmaker prices. 2 credits.
   * The usual starting point. Each quote carries its own `age_seconds` and `stale` flag —
   * read them, because a stalled scraper keeps serving its last value.
   */
  nextToGo(options?: NextToGoOptions): Promise<NextRaceOut[]> {
    return this.pe.get<NextRaceOut[]>("/v1/racing/next-to-go", options);
  }

  /** Scheduled races in a forward window, without prices. 1 credit. */
  events(options?: RaceEventsOptions): Promise<RaceEventOut[]> {
    return this.pe.get<RaceEventOut[]>("/v1/racing/events", options);
  }

  /** Best win, place and tote price per runner across books, with the book offering it. 3 credits. */
  bestOdds(options?: RacingBestOddsOptions): Promise<RacingBestOddsOut[]> {
    return this.pe.get<RacingBestOddsOut[]>("/v1/racing/best-odds", options);
  }

  /** Consensus steamers and drifters in the live window. 3 credits. */
  movers(options?: MoversOptions): Promise<MoverOut[]> {
    return this.pe.get<MoverOut[]>("/v1/racing/movers", options);
  }

  /** Settled results: placings, settled prices, dividends and scratchings. 2 credits. */
  results(options?: RaceResultsOptions): Promise<RaceResultOut[]> {
    return this.pe.get<RaceResultOut[]>("/v1/racing/results", options);
  }

  /** What the results field coverage actually is, measured rather than promised. 1 credit. */
  resultsCoverage(options?: CallOptions & { days?: number }): Promise<ResultsCoverageOut> {
    return this.pe.get<ResultsCoverageOut>("/v1/racing/results/coverage", options);
  }

  /** Per-bookmaker price ticks for one race. 5 credits. */
  priceHistory(options: PriceHistoryOptions): Promise<PriceHistoryOut> {
    return this.pe.get<PriceHistoryOut>("/v1/racing/price-history", options);
  }

  /**
   * Races and prices that changed since a timestamp. 2 credits.
   *
   * This is the endpoint to build a live board on. Polling `nextToGo` in a loop re-downloads
   * every race every time and bills you 2 credits for the privilege; `changes` returns only
   * what moved, and hands back the cursor for the next call.
   */
  changes(options: RacingChangesOptions): Promise<RacingChangesOut> {
    return this.pe.get<RacingChangesOut>("/v1/racing/changes", options);
  }

  /**
   * The permanent closing-line and result archive. **5 credits.** Standard plan and above.
   *
   * See `closingLinesCsv` for the bulk form, which costs 20 — the archive endpoints are the
   * only two on the API whose price depends on the format you ask for.
   */
  closingLines(options?: ClosingLinesOptions): Promise<ClosingLinesOut> {
    return this.pe.get<ClosingLinesOut>("/v1/racing/closing-lines", options);
  }

  /** What the closing-line archive actually holds — its floor date, row count and coverage. 1 credit. */
  closingLinesCoverage(options?: CallOptions): Promise<ArchiveCoverageOut> {
    return this.pe.get<ArchiveCoverageOut>("/v1/racing/closing-lines/coverage", options);
  }

  /**
   * Bulk export of the permanent price-movement archive. **5 credits.** Standard plan and
   * above. The CSV form (`pricePathsCsv`) costs 20.
   */
  pricePaths(options?: ArchiveOptions): Promise<PricePathsOut> {
    return this.pe.get<PricePathsOut>("/v1/racing/price-paths", options);
  }

  /** Canonical venue directory: `venue_id`, display name and physical site. 1 credit. */
  venues(options?: CallOptions): Promise<VenueOut[]> {
    return this.pe.get<VenueOut[]>("/v1/racing/venues", options);
  }

  /**
   * Full-day AU thoroughbred acceptance card. 2 credits.
   *
   * Read `completeness` and each race's `runner_set_status` before treating a count as the
   * field size — the response is explicit about when a figure is a floor rather than exact.
   */
  acceptances(options?: AcceptancesOptions): Promise<AcceptancesOut> {
    return this.pe.get<AcceptancesOut>("/v1/racing/acceptances", options);
  }

  /** Track condition, weather and rail: current state and the day's change log. 1 credit. */
  trackConditions(options?: TrackConditionsOptions): Promise<TrackConditionsOut> {
    return this.pe.get<TrackConditionsOut>("/v1/racing/track-conditions", options);
  }

  /** Jockey premiership leaderboards, or one jockey by name. 2 credits. */
  jockeyStats(options?: PremiershipOptions): Promise<PremiershipOut> {
    return this.pe.get<PremiershipOut>("/v1/racing/jockeys/stats", options);
  }

  /** Trainer premiership leaderboards, or one trainer by name. 2 credits. */
  trainerStats(options?: PremiershipOptions): Promise<PremiershipOut> {
    return this.pe.get<PremiershipOut>("/v1/racing/trainers/stats", options);
  }

  /**
   * The closing-line archive as a CSV string, streamed by the server in a stable column order.
   *
   * **20 credits, not 5.** This is `closingLines` with `format=csv`, and CSV is priced as the
   * bulk export it is: the server caps a CSV pull at 50,000 rows against 5,000 for a JSON
   * page, so one call can return ten times the data. Same filters, four times the price.
   */
  closingLinesCsv(options?: ClosingLinesOptions): Promise<string> {
    return this.pe.get<string>(
      "/v1/racing/closing-lines",
      { ...options, format: "csv" },
      { Accept: "text/csv" },
    );
  }

  /**
   * The price-path archive as a CSV string, in a stable column order.
   *
   * **20 credits, not 5** — same bulk-export pricing as `closingLinesCsv`.
   */
  pricePathsCsv(options?: ArchiveOptions): Promise<string> {
    return this.pe.get<string>(
      "/v1/racing/price-paths",
      { ...options, format: "csv" },
      { Accept: "text/csv" },
    );
  }
}

// ── sports ────────────────────────────────────────────────────────────────────────────────

export interface SportOddsOptions extends CallOptions, BookmakerFilter {
  /** `h2h`, `spreads`, `totals`. **Billed one credit per market requested.** */
  markets?: string | string[];
  /** One competition, case-insensitive exact match (e.g. `"NRLW"`). */
  competition?: string;
  /**
   * When filtering by `competition`, also return events whose competition is null. Not every
   * book labels every fixture, so a strict filter can drop real matches.
   */
  includeUnknownCompetition?: boolean;
  oddsFormat?: "decimal" | "american";
  /** Exclude bookmaker markets older than this many minutes. Default 360. */
  maxAgeMinutes?: number;
}

/** Australian sports odds. Racing is NOT here — see `pe.racing`. */
class SportsAPI {
  constructor(private readonly pe: PuntersEdge) {}

  /** The sport catalogue: every queryable `sport_key` with its display name. 1 credit. */
  list(options?: CallOptions): Promise<SportOut[]> {
    return this.pe.get<SportOut[]>("/v1/sports", options);
  }

  /**
   * Odds for one sport. **1 credit per market requested** — asking for
   * `["h2h", "spreads", "totals"]` costs 3, not 1.
   */
  odds(sportKey: string, options?: SportOddsOptions): Promise<SportOddsEventOut[]> {
    return this.pe.get<SportOddsEventOut[]>(
      `/v1/sports/${encodeURIComponent(sportKey)}/odds`, options);
  }

  /** Best available price per outcome across bookmakers, for one sport. 3 credits. */
  bestOdds(sportKey: string, options?: CallOptions): Promise<BestOddsEventOut[]> {
    return this.pe.get<BestOddsEventOut[]>(
      `/v1/best-odds/${encodeURIComponent(sportKey)}`, options);
  }

  /** Historical odds snapshots. 5 credits. */
  oddsHistory(
    sportKey: string,
    options?: CallOptions & BookmakerFilter & {
      from?: string; to?: string; market?: string; offset?: number;
    },
  ): Promise<unknown> {
    return this.pe.get(`/v1/sports/${encodeURIComponent(sportKey)}/odds/history`, options);
  }

  /** Price movement feed for one sport. 5 credits. */
  oddsMovements(
    sportKey: string,
    options?: CallOptions & BookmakerFilter & {
      since?: string; market?: string; minDelta?: number;
    },
  ): Promise<unknown> {
    return this.pe.get(`/v1/sports/${encodeURIComponent(sportKey)}/odds/movements`, options);
  }
}

// ── arb ───────────────────────────────────────────────────────────────────────────────────

export interface ArbOptions extends CallOptions {
  /** Filter by sport, e.g. `"afl"`. */
  sportKey?: string;
  /** Exclude bookmaker markets older than this many minutes. */
  maxAgeMinutes?: number;
  /** Minimum guaranteed profit, in percent. 0 also shows the best comparison when it is not an arb. */
  minProfitPct?: number;
}

/**
 * Cross-book comparison and arbitrage scanning.
 *
 * A word of warning that costs nothing to read: a two-outcome market that only one book is
 * quoting will look like a large arb and is not one. Check how many books are behind each leg
 * before acting on a number from here.
 */
class ArbAPI {
  constructor(private readonly pe: PuntersEdge) {}

  /** Head-to-head arb scanner. 3 credits. */
  sports(options?: ArbOptions): Promise<SportsArbOut[]> {
    return this.pe.get<SportsArbOut[]>("/v1/arb/sports", options);
  }

  /** Spreads and totals line arb. 3 credits. */
  lines(options?: ArbOptions): Promise<LinesArbOut[]> {
    return this.pe.get<LinesArbOut[]>("/v1/arb/lines", options);
  }

  /** Best price per selection with every book's quote alongside. 2 credits. */
  bestPrices(
    options?: CallOptions & { sportKey?: string; maxAgeMinutes?: number },
  ): Promise<BestPricesOut[]> {
    return this.pe.get<BestPricesOut[]>("/v1/arb/best-prices", options);
  }
}

// ── account ───────────────────────────────────────────────────────────────────────────────

/** Usage, key metadata and billing. Every method here is free — it costs no credits to ask. */
class AccountAPI {
  constructor(private readonly pe: PuntersEdge) {}

  /**
   * Plan, allowance, credits used and reset date. Free.
   *
   * You rarely need this: every billed response already carries the balance in its headers,
   * which the client exposes as `pe.credits`.
   */
  usage(options?: CallOptions): Promise<UsageOut> {
    return this.pe.get<UsageOut>("/v1/usage", options);
  }

  /** Usage broken down by endpoint. Free. */
  usageAnalytics(
    options?: CallOptions & { days?: number; period?: "rolling" | "billing" },
  ): Promise<unknown> {
    return this.pe.get("/v1/usage/analytics", options);
  }

  /** Plan, limits and status for the key in use. Free. */
  keyInfo(options?: CallOptions): Promise<unknown> {
    return this.pe.get("/v1/keys/info", options);
  }

  /** A Stripe self-service billing portal link. Free. */
  billingPortal(options?: CallOptions): Promise<unknown> {
    return this.pe.get("/v1/billing/portal", options);
  }

  /**
   * Rotate the key. Free.
   *
   * The old key keeps working through a grace window so a deploy can roll. Pass
   * `{ immediate: true }` only when rotating because the key leaked — that revokes it now and
   * will break anything still holding it.
   */
  rotateKey(options?: CallOptions & { immediate?: boolean }): Promise<unknown> {
    const { params, request } = split(options);
    return this.pe.raw<unknown>("POST", "/v1/keys/rotate", params, undefined, request)
      .then((r) => r.data);
  }

  /** Restrict this key to a set of source IPs. Free. Pass `[]` to clear the whitelist. */
  setIpWhitelist(ips: string[], options?: CallOptions): Promise<unknown> {
    const { request } = split(options);
    return this.pe.raw<unknown>("POST", "/v1/keys/ip-whitelist", undefined, ips, request)
      .then((r) => r.data);
  }
}

// ── webhooks ──────────────────────────────────────────────────────────────────────────────

export interface WebhookCreateInput {
  /** Your HTTPS endpoint. */
  url: string;
  /** Event names to subscribe to, e.g. `["race.odds_open"]`. */
  events: string[];
  [key: string]: unknown;
}

/**
 * Push delivery instead of polling. Creating a webhook needs the Standard plan or above.
 *
 * Every delivery is signed: `X-Webhook-Signature` is an HMAC-SHA256 over the **raw request
 * body**, keyed with the secret returned when you create the subscription. Verify it against
 * the bytes you received, before parsing — re-serialising the JSON first changes the bytes and
 * the signature will never match.
 */
class WebhooksAPI {
  constructor(private readonly pe: PuntersEdge) {}

  /** Create a subscription. The response carries the signing secret — it is shown once. */
  create(input: WebhookCreateInput, options?: CallOptions): Promise<WebhookResponse> {
    return this.pe.post<WebhookResponse>("/v1/webhooks", input, options);
  }

  list(options?: CallOptions): Promise<WebhookResponse[]> {
    return this.pe.get<WebhookResponse[]>("/v1/webhooks", options);
  }

  delete(webhookId: string, options?: CallOptions): Promise<unknown> {
    return this.pe.delete(`/v1/webhooks/${encodeURIComponent(webhookId)}`, options);
  }

  /** Recent delivery attempts, with response codes — the first place to look when nothing arrives. */
  deliveries(webhookId: string, options?: CallOptions): Promise<WebhookDeliveryResponse[]> {
    return this.pe.get<WebhookDeliveryResponse[]>(
      `/v1/webhooks/${encodeURIComponent(webhookId)}/deliveries`, options);
  }

  /** Fire a test delivery at the endpoint, so you can verify your signature check end to end. */
  test(webhookId: string, options?: CallOptions): Promise<unknown> {
    return this.pe.post(
      `/v1/webhooks/${encodeURIComponent(webhookId)}/test`, undefined, options);
  }
}

// ── health ────────────────────────────────────────────────────────────────────────────────

/**
 * Is the data current?
 *
 * `connectors()` is the one to watch. A stalled scraper does not return an error — it keeps
 * serving its last value, which is exactly what a live price looks like. `last_ok` per
 * connector is how you tell the difference.
 */
class HealthAPI {
  constructor(private readonly pe: PuntersEdge) {}

  /** Per-connector freshness: `last_ok`, status, records written. Requires a key. */
  connectors(options?: CallOptions): Promise<ConnectorHealthOut[]> {
    return this.pe.get<ConnectorHealthOut[]>("/v1/health", options);
  }

  /** Per-connector freshness with tunable staleness thresholds and optional per-sport coverage. 1 credit. */
  connectorDetail(
    options?: CallOptions & {
      staleAfterS?: number; coverageStaleAfterS?: number; includeSports?: boolean;
    },
  ): Promise<Record<string, unknown>> {
    return this.pe.get<Record<string, unknown>>("/v1/health/connectors", options);
  }

  /** Public uptime stats. No key, no credits. */
  uptime(options?: CallOptions): Promise<Record<string, unknown>> {
    return this.pe.get<Record<string, unknown>>("/v1/uptime", options);
  }
}

// ── sandbox ───────────────────────────────────────────────────────────────────────────────

/**
 * The sandbox: real prices, truncated to 3 races, 5 runners and 3 bookmakers. No key, no
 * credits. Use it to learn the response shape before you spend anything, and to keep an
 * example in your README runnable by someone who has not signed up yet.
 */
class DemoAPI {
  constructor(private readonly pe: PuntersEdge) {}

  nextToGo(options?: CallOptions): Promise<Record<string, unknown>> {
    return this.pe.get<Record<string, unknown>>("/v1/demo/racing/next-to-go", options);
  }

  /** Sample best-odds with arb detection. `sport` is optional; a live sport is picked if omitted. */
  bestOdds(options?: CallOptions & { sport?: string }): Promise<Record<string, unknown>> {
    return this.pe.get<Record<string, unknown>>("/v1/demo/best-odds", options);
  }
}

// ── the client ────────────────────────────────────────────────────────────────────────────

export interface PuntersEdgeOptions {
  /** Your key. Get a free one at https://puntersedge.online/api. Optional: the sandbox needs none. */
  apiKey?: string;
  /** Override for a proxy or a self-hosted deployment. */
  baseUrl?: string;
  /** Per-request timeout in milliseconds. Default 30000. */
  timeoutMs?: number;
  /** Fired after every response that carried credit headers, including errors. */
  onCredits?: (credits: Credits) => void;
  /** Supply your own `fetch` — for tests, or a runtime where it is not global. */
  fetch?: typeof globalThis.fetch;
  /** Appended to the SDK's own User-Agent, so your traffic is identifiable in support. */
  userAgent?: string;
}

/**
 * ```ts
 * import { PuntersEdge } from "puntersedge";
 *
 * const pe = new PuntersEdge({ apiKey: process.env.PUNTERSEDGE_API_KEY });
 *
 * for (const race of await pe.racing.nextToGo({ numRaces: 5, categories: "horse" })) {
 *   console.log(race.venue, race.race_number, race.start_time);
 * }
 *
 * console.log(pe.credits?.remaining, "credits left");
 * ```
 */
export class PuntersEdge {
  readonly racing = new RacingAPI(this);
  readonly sports = new SportsAPI(this);
  readonly arb = new ArbAPI(this);
  readonly account = new AccountAPI(this);
  readonly webhooks = new WebhooksAPI(this);
  readonly health = new HealthAPI(this);
  readonly demo = new DemoAPI(this);

  /**
   * Credit accounting from the most recent billed response — balance, cost, and the upgrade
   * recommendation once you cross the warning threshold. Undefined until the first billed call.
   */
  credits?: Credits;

  // A true #private field, not TypeScript's compile-time `private`. TS `private` is erased,
  // leaving an ordinary enumerable property — so `console.log(pe)` would print the API key,
  // and so would any error reporter that serialises the object. `#config` is unreachable from
  // outside the class and invisible to enumeration.
  readonly #config: TransportConfig;

  constructor(options: PuntersEdgeOptions | string = {}) {
    const opts: PuntersEdgeOptions =
      typeof options === "string" ? { apiKey: options } : options;

    const base = (opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    const ua = opts.userAgent
      ? `puntersedge-node/${VERSION} ${opts.userAgent}`
      : `puntersedge-node/${VERSION}`;

    const fetchImpl = opts.fetch ?? globalThis.fetch;
    if (typeof fetchImpl !== "function") {
      throw new Error(
        "No global fetch. Use Node 18 or later, or pass one: new PuntersEdge({ fetch }).",
      );
    }

    this.#config = {
      baseUrl: base,
      apiKey: opts.apiKey,
      timeoutMs: opts.timeoutMs ?? 30_000,
      userAgent: ua,
      // Bound: some runtimes throw "Illegal invocation" on a detached global fetch.
      fetch: fetchImpl.bind(globalThis),
      onCredits: (credits) => {
        this.credits = credits;
        opts.onCredits?.(credits);
      },
    };
  }

  /**
   * The full response for one call: data, credits and headers together.
   *
   * ```ts
   * const { data, credits } = await pe.withCredits((p) => p.racing.nextToGo());
   * ```
   */
  async withCredits<T>(call: (pe: this) => Promise<T>): Promise<{ data: T; credits?: Credits }> {
    const data = await call(this);
    return { data, credits: this.credits };
  }

  /** Escape hatch: any endpoint, including ones added after this SDK was published. */
  async raw<T>(
    method: "GET" | "POST" | "DELETE",
    path: string,
    params?: Query,
    body?: unknown,
    options: RequestOptions = {},
  ): Promise<Result<T>> {
    return request<T>(this.#config, method, path, params, body, options);
  }

  /** @internal */
  get<T>(
    path: string,
    options?: object,
    extraHeaders?: Record<string, string>,
  ): Promise<T> {
    const { params, request: req } = split(options);
    if (extraHeaders) req.headers = { ...extraHeaders, ...req.headers };
    return this.raw<T>("GET", path, params, undefined, req).then((r) => r.data);
  }

  /** @internal */
  post<T>(path: string, body?: unknown, options?: CallOptions): Promise<T> {
    const { request: req } = split(options);
    return this.raw<T>("POST", path, undefined, body, req).then((r) => r.data);
  }

  /** @internal */
  delete<T>(path: string, options?: CallOptions): Promise<T> {
    const { request: req } = split(options);
    return this.raw<T>("DELETE", path, undefined, undefined, req).then((r) => r.data);
  }
}
