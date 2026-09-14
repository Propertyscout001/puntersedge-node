/**
 * puntersedge — the official TypeScript/JavaScript client for the PuntersEdge Odds API.
 *
 * Australian and New Zealand racing (thoroughbred, greyhound, harness) and Australian sports
 * odds from 14 Australian bookmakers. One REST/JSON API, an `X-API-Key` header, a free tier.
 *
 *     npm install puntersedge
 *
 *     import { PuntersEdge } from "puntersedge";
 *     const pe = new PuntersEdge({ apiKey: process.env.PUNTERSEDGE_API_KEY });
 *     const races = await pe.racing.nextToGo({ numRaces: 5 });
 *
 * Get a free key at https://puntersedge.online/api.
 */

export {
  PuntersEdge,
  DEFAULT_BASE_URL,
  VERSION,
  type PuntersEdgeOptions,
  type CallOptions,
  type RacingFilterOptions,
  type BookmakerFilter,
  type PageOptions,
  type NextToGoOptions,
  type RaceEventsOptions,
  type RacingBestOddsOptions,
  type MoversOptions,
  type RaceResultsOptions,
  type PriceHistoryOptions,
  type ArchiveOptions,
  type ClosingLinesOptions,
  type RacingChangesOptions,
  type AcceptancesOptions,
  type TrackConditionsOptions,
  type PremiershipOptions,
  type SportOddsOptions,
  type ArbOptions,
  type WebhookCreateInput,
} from "./client.js";

export {
  PuntersEdgeError,
  AuthError,
  CreditsExhaustedError,
  RateLimitError,
  ValidationError,
  NotFoundError,
  ServerError,
  NetworkError,
  APIError,
  isProblem,
  type Problem,
  type FieldError,
} from "./errors.js";

export {
  parseCredits,
  parseUpgrade,
  type Credits,
  type UpgradeHint,
} from "./credits.js";

export { buildQuery, type Query, type QueryValue, type Result, type RequestOptions } from "./http.js";

export { verifyWebhookSignature, type VerifyOptions } from "./webhook.js";

// Every response shape, generated from the live OpenAPI document.
export * from "./types.generated.js";

export { PuntersEdge as default } from "./client.js";
