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

import {
  request, type HttpMethod, type Query, type RequestOptions, type Result, type TransportConfig,
} from "./http.js";
import { PuntersEdgeError } from "./errors.js";
import type { Credits } from "./credits.js";
import type {
  AcceptancesOut, ArchiveCoverageOut, BackfillStatusOut, BackfillSubmitOut,
  BestOddsEventOut, BestPricesOut, BulkCatalogueOut, ClosingLinesOut, ClvIn, ClvOut,
  ConnectorHealthOut, GreyhoundFormOut, GreyhoundStatsOut, HorseFormOut, HorseRunsOut,
  LinesArbOut, MoverOut, NextRaceOut, OverageOut, PremiershipOut, PriceHistoryOut,
  PricePathsOut, RaceEventOut, RaceResultOut, RacingBestOddsOut, RacingChangesOut,
  ResultsCoverageOut, RewardIn, SportOddsEventOut, SportOut, SportsArbOut, TeamKeyIn,
  TeamKeyListOut, TeamKeyMintOut, TeamKeyOut, TeamKeyPatchIn, TrackConditionsOut, UsageOut,
  VenueOut, WebhookDeliveryResponse, WebhookResponse,
} from "./types.generated.js";

export const VERSION = "1.2.0";

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
 * Thoroughbred form and runs, and the paced bulk backfill queue.
 *
 * `form()` is Racing Australia's own form page for one horse, read on a deliberate pace — the
 * upstream rate-limits hard, and a burst gets the whole estate flagged. `backfill` is the
 * supported way to ask for many horses: you submit a batch, the queue collects them at a
 * sustainable rate, and you collect the results when they land. Looping `form()` over 400
 * horses is the unsupported way. `runs()` is our own record of the horse out of the results we
 * settle ourselves, and does not depend on that page being served.
 *
 * Identity: every thoroughbred runner, placing, archive row and form response carries
 * `horse_ref` (`pe:<name>`), the same value everywhere — join a horse across meetings on it.
 * `runner_ref` (`ra:<code>`) is Racing Australia's code for that meeting's entry and changes
 * from meeting to meeting, so it joins a row to its own meeting only.
 */
class HorsesAPI {
  constructor(private readonly pe: PuntersEdge) {}

  /**
   * Racing Australia's form page for one horse: career record, profile and recent runs. 3 credits.
   * `horse` is a name, its `pe:` horse_ref (the same thing, folded) or an `ra:` runner_ref, which
   * pins one meeting's entry. A 503 means the upstream is refusing fresh reads; `runs()` still answers.
   */
  form(horse: string, options?: CallOptions): Promise<HorseFormOut> {
    return this.pe.get<HorseFormOut>("/v1/racing/horses/form", { horse, ...options });
  }

  /**
   * Every run we hold for one horse out of our own settled results, newest first, with a
   * starts/wins/places summary. 3 credits. Not a career: the record starts at the first complete
   * card we settled (1 September 2026) and only grows. Takes a name or a `pe:` horse_ref.
   */
  runs(horse: string, options?: CallOptions & { limit?: number }): Promise<HorseRunsOut> {
    return this.pe.get<HorseRunsOut>("/v1/racing/horses/runs", { horse, ...options });
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
   * Form history for one dog, out of our own results since 13 September 2026. 3 credits.
   * `dog` is a name or a registry ref from results (`grv:<id>` on Victorian tracks, `grsa:<id>`
   * elsewhere); names match case- and punctuation-insensitively and join a dog across both.
   */
  form(dog: string, options?: CallOptions & { limit?: number }): Promise<GreyhoundFormOut> {
    return this.pe.get<GreyhoundFormOut>("/v1/racing/greyhounds/form", { dog, ...options });
  }

  /**
   * Record by track, distance or box, out of our own results. 3 credits.
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

  /**
   * Settled results: placings, the full finishing order, settled prices, dividends and
   * scratchings. 2 credits. Every thoroughbred runner and placing carries `horse_ref`, the key
   * that joins a horse across meetings; `runner_ref` is that meeting's Racing Australia entry code.
   */
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
   *
   * Thoroughbred rows carry `horse_ref` (the last column), so one horse's closing lines across
   * meetings are a single group; `runner_ref` joins a row to its own meeting's result and form.
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
   * above. The CSV form (`pricePathsCsv`) costs 20. Thoroughbred rows carry `horse_ref` (the
   * last column), the key that groups one horse's price paths across meetings.
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

  /**
   * Score bets you struck against the closing line each race actually closed at: per bet the
   * closing price, the closing-line value in percent, whether it beat the close, the result and
   * the flat-stake P&L; across the list the average and median CLV, the beat-the-close rate,
   * the win rate and the ROI. 5 credits per request, up to 200 bets. Plus plan and above.
   *
   * Name a race by `race_id`, or by `venue` + `meeting_date` + `race_number`; name a runner by
   * `runner_ref` (exact), `runner_number` or `runner_name`. A bet the archive cannot resolve
   * comes back with a `reason` and is left out of the averages rather than guessed.
   */
  clv(input: ClvIn, options?: CallOptions): Promise<ClvOut> {
    return this.pe.post<ClvOut>("/v1/racing/clv", input, options);
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

  /**
   * Overage: whether this account may run past its monthly allowance, the rate, the ceiling
   * the API enforces, and what this period would be invoiced if it ended now. Free, no credits.
   */
  overage(options?: CallOptions): Promise<OverageOut> {
    return this.pe.get<OverageOut>("/v1/billing/overage", options);
  }

  /**
   * Switch overage on or off. Free, no credits. Primary key only, commercial tiers only.
   * On: calls continue past the allowance up to `ceiling` and the excess is invoiced at
   * `rate_per_1000_cents` per thousand credits. Off: the hard 402 at the allowance returns at
   * once, and any overage already served this period is still invoiced.
   */
  setOverage(enabled: boolean, options?: CallOptions): Promise<OverageOut> {
    return this.pe.post<OverageOut>("/v1/billing/overage", { enabled }, options);
  }

  /**
   * The primary key and every active team key on this account, with each one's calls and
   * credits this period, its cap if it has one, and the shared pool's balance. Free, no credits.
   */
  teamKeys(options?: CallOptions): Promise<TeamKeyListOut> {
    return this.pe.get<TeamKeyListOut>("/v1/keys/team", options);
  }

  /**
   * Mint another key on this account. Free, no credits. Business, Platform and Scale plans
   * hold three, five and ten keys in total, the primary included. The key shares the pool and
   * plan, has its own rate-limit bucket, IP whitelist and usage line, and can be capped with
   * `monthly_cap`. The key string is returned once and stored hashed: if it is lost, revoke it
   * and mint again.
   */
  mintTeamKey(input: TeamKeyIn, options?: CallOptions): Promise<TeamKeyMintOut> {
    return this.pe.post<TeamKeyMintOut>("/v1/keys/team", input, options);
  }

  /**
   * Change a team key's monthly cap or label. Free, no credits. Only the fields present in
   * `input` are written: `{ monthly_cap: null }` removes the cap; `{ label }` alone renames it.
   */
  updateTeamKey(keyId: string, input: TeamKeyPatchIn, options?: CallOptions): Promise<TeamKeyOut> {
    return this.pe.patch<TeamKeyOut>(`/v1/keys/team/${encodeURIComponent(keyId)}`, input, options);
  }

  /**
   * Revoke a team key. Free, no credits. It stops authenticating on the next request; its
   * usage history stays in the account's breakdown.
   */
  revokeTeamKey(keyId: string, options?: CallOptions): Promise<Record<string, unknown>> {
    return this.pe.delete<Record<string, unknown>>(
      `/v1/keys/team/${encodeURIComponent(keyId)}`, options);
  }

  /**
   * Your referral code, the link to share, and what it has earned. Free. The code is minted on
   * the first call and never changes; `terms` in the response carries the live commission terms.
   */
  referral(options?: CallOptions): Promise<Record<string, unknown>> {
    return this.pe.get<Record<string, unknown>>("/v1/referral", options);
  }

  /**
   * Choose `cash` or `credits` for referral commission accrued from here on, and where a cash
   * remittance should go. Free. Commission already in the ledger keeps the form it was earned in.
   */
  setReferralPayout(input: RewardIn, options?: CallOptions): Promise<Record<string, unknown>> {
    return this.pe.post<Record<string, unknown>>("/v1/referral", input, options);
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

// ── bulk dataset files ────────────────────────────────────────────────────────────────────

export interface BulkDownloadOptions extends CallOptions {
  /** `parquet` (typed columns, snappy) or `csv` (gzip). The server's default applies when omitted. */
  format?: "parquet" | "csv";
  /**
   * The file's digest from a previous download (`etag`) or from the catalogue (`sha256`). A match
   * is a 304: `unchanged: true`, no bytes, nothing charged.
   */
  ifNoneMatch?: string;
}

export interface BulkDownload {
  /** True when `ifNoneMatch` matched: the file has not changed and nothing was charged. */
  unchanged: boolean;
  /** The file as served: a Parquet file, or a gzip-compressed CSV. Undefined when `unchanged`. */
  bytes?: Uint8Array;
  /** The file's sha256, quoted as the server sends it. Pass it back as `ifNoneMatch` next time. */
  etag?: string;
  rows?: number;
  generatedAt?: string;
  contentType?: string;
}

/**
 * Pre-built dataset files: one request returns a whole Sydney meeting day or a calendar month as
 * one Parquet or gzip-CSV file, with exactly the rows the paged endpoints would give you. Daily
 * files need the Business plan or above; monthly bundles need Platform or above.
 *
 * Read the catalogue before pulling, and re-read it nightly: a day's file is regenerated for
 * three nights after the day (late results, late closing lines) and its digest changes when its
 * rows do. Send the digest back as `ifNoneMatch` and an unchanged file costs nothing.
 */
class BulkAPI {
  constructor(private readonly pe: PuntersEdge) {}

  /**
   * Every dataset published as files, with the daily files and monthly bundles that exist right
   * now: rows, bytes per format, digest, generation time and URL. Free, no credits.
   */
  datasets(options?: CallOptions & { dataset?: string }): Promise<BulkCatalogueOut> {
    return this.pe.get<BulkCatalogueOut>("/v1/bulk/datasets", options);
  }

  /**
   * One dataset file. 20 credits for a daily file, 100 for a monthly bundle, charged when the
   * file is served; a 304 on a matching `ifNoneMatch` costs nothing. `period` is `YYYY-MM-DD`
   * for a Sydney meeting day or `YYYY-MM` for a calendar month.
   */
  async download(
    dataset: string,
    period: string,
    options: BulkDownloadOptions = {},
  ): Promise<BulkDownload> {
    const { format, ifNoneMatch, ...rest } = options;
    const { request: req } = split(rest);
    const headers: Record<string, string> = { Accept: "*/*", ...req.headers };
    if (ifNoneMatch) headers["If-None-Match"] = ifNoneMatch;
    const path = `/v1/bulk/${encodeURIComponent(dataset)}/${encodeURIComponent(period)}`;
    try {
      const r = await this.pe.raw<Uint8Array>(
        "GET", path, format ? { format } : undefined, undefined,
        { ...req, headers, responseType: "binary" },
      );
      const rowsHeader = r.headers.get("X-Dataset-Rows");
      const rows = rowsHeader === null ? NaN : Number(rowsHeader);
      return {
        unchanged: false,
        bytes: r.data,
        etag: r.headers.get("ETag") ?? undefined,
        rows: Number.isFinite(rows) ? rows : undefined,
        generatedAt: r.headers.get("X-Dataset-Generated-At") ?? undefined,
        contentType: r.headers.get("Content-Type") ?? undefined,
      };
    } catch (err) {
      if (err instanceof PuntersEdgeError && err.status === 304) {
        return { unchanged: true, etag: err.headers?.get("ETag") ?? undefined };
      }
      throw err;
    }
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
  readonly bulk = new BulkAPI(this);

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
    method: HttpMethod,
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
  patch<T>(path: string, body?: unknown, options?: CallOptions): Promise<T> {
    const { request: req } = split(options);
    return this.raw<T>("PATCH", path, undefined, body, req).then((r) => r.data);
  }

  /** @internal */
  delete<T>(path: string, options?: CallOptions): Promise<T> {
    const { request: req } = split(options);
    return this.raw<T>("DELETE", path, undefined, undefined, req).then((r) => r.data);
  }
}
