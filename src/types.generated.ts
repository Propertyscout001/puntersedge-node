// GENERATED FILE — do not edit by hand.
//
// Source:  openapi.json (API version 1.0.0)
// Rebuild: python3 scripts/generate-types.py
//
// Every interface below mirrors one `components.schemas` entry of the PuntersEdge
// OpenAPI document. A field marked optional here is one the API declares optional:
// racing data is scraped from bookmakers that each publish a different subset, so
// `barrier?: number` means some books genuinely do not report a barrier, not that
// the schema is sloppy. Check before you read.

/* eslint-disable */

export interface AcceptancesOut {
  /** Meeting day, Australia/Sydney calendar date. */
  date: string;
  /**
   * 'past', 'today' or 'future', relative to the Australia/Sydney date. On 'past' this card is a
   * FROZEN SNAPSHOT: the scraper only fetches today-and-forward, so a meeting still showing
   * acceptances_published false will never fill in and the scratching set can never converge. On
   * 'today'/'future' the next scrape CAN add acceptances and scratchings, every two hours — but
   * that is not a promise that a meeting converges, which is what this field used to make.
   * Racing Australia removes a meeting from home.aspx once it is UNDERWAY and home.aspx is the
   * scraper's only discovery surface, so a meeting's rows stop advancing around 12:15-14:15 AEST
   * while its own races are still running to 17:00-19:30. Log-verified 2026-09-09: the 02:15Z
   * pass discovered all six of that day's meetings, the 04:15Z pass discovered one, the 06:15Z
   * pass discovered none. The in-band signal is per meeting, not per day — watch its own as_of
   * and scratching_sheet_as_of: a stamp that stops moving while later passes land on other
   * meetings is a meeting that has gone underway, not a quiet one. From that point race-day
   * movement is on /v1/racing/changes, not here.
   */
  date_status: string;
  meeting_count: number;
  race_count: number;
  /**
   * Acceptance rows on this card — scratched runners and emergencies INCLUDED. A floor, not a
   * guarantee, wherever a race reports runner_set_status other than 'checks_passed'.
   */
  runner_count: number;
  /**
   * Rows flagged as an emergency acceptance. NULL unless every meeting with rows on this card
   * has emergency_data 'parsed' — see completeness. A FLOOR, not an exact figure, wherever a
   * race reports runner_set_status other than 'checks_passed': it counts only the acceptance
   * rows this card holds.
   */
  emergency_count?: number | null;
  /**
   * runner_count minus emergency_count: the DECLARED field, i.e. the acceptances that are not
   * emergencies. NULL when emergency_count is. A FLOOR wherever a race reports runner_set_status
   * other than 'checks_passed'.
   */
  declared_count?: number | null;
  /**
   * Sheet rows MATCHED to an acceptance row this card holds — NOT every scratching Racing
   * Australia lists. A sheet row with no acceptance row here is not counted; it appears in that
   * race's missing_runners with scratched true. Measured 2026-09-08: Townsville R6 has
   * scratching_data 'parsed' and scratched_count 0 while the sheet holds #4 Five Star King and
   * #9 Kickoff, so the true figure is at least 2. Read it as a FLOOR wherever a race reports
   * runner_set_status other than 'checks_passed'; that race's runner_set_note states the bound.
   * NULL unless every meeting with rows on this card has scratching_data 'parsed' — a meeting
   * with no sheet cannot be said to have nobody scratched.
   */
  scratched_count?: number | null;
  /**
   * runner_count minus scratched_count. A RECONCILIATION number against the sheet, NOT a field
   * size: it still includes emergencies, which run only if promoted. A FLOOR wherever a race
   * reports runner_set_status other than 'checks_passed'. NULL when scratched_count is.
   */
  unscratched_count?: number | null;
  /**
   * Rows that are scratched AND not emergencies. Like scratched_count it counts only sheet rows
   * MATCHED to an acceptance row held here, so it is a FLOOR wherever a race reports
   * runner_set_status other than 'checks_passed'. NULL unless BOTH emergency_data and
   * scratching_data are 'parsed' for every meeting with rows.
   */
  declared_scratched_count?: number | null;
  /**
   * declared_count minus declared_scratched_count: the horses expected to jump barring an
   * emergency promotion, which Racing Australia does not publish. It is the number to render as
   * the field ONLY where every race behind it reports runner_set_status 'checks_passed'.
   * Anywhere else it is a FLOOR — render it as 'at least N', never as an exact field: a runner
   * Racing Australia lists that this card does not hold, and that is not on the scratching
   * sheet, may well be jumping. Measured 2026-09-08: Townsville R5 is 'gap_detected' with
   * saddlecloth #6 unaccounted for and published 11. The race's runner_set_note states the
   * bound. NULL unless BOTH facts are known everywhere.
   */
  declared_remaining_count?: number | null;
  /**
   * Newest RA scrape backing the meetings actually returned, UTC — computed after the venue
   * filter.
   */
  as_of?: string | null;
  /** What could and could not be verified about this card. */
  completeness: Record<string, unknown>;
  meetings: Record<string, unknown>[];
  note: string;
}

export interface ArchiveCoverageOut {
  archive_from: string | null;
  archive_to: string | null;
  rows: number;
  races: number;
  bookmakers: number;
  is_closing_line_pct: number;
  open_is_baseline_pct: number;
  resulted_races_pct: number;
  results_from: string | null;
  settleable_races: number;
  settleable_resulted_pct: number;
  results_scope: string;
  venue_split_suspect_rows: number;
  name_fragment_suspect_rows: number;
  by_category: Record<string, unknown>[];
}

export interface BackfillStatusOut {
  job_id: string;
  submitted_at?: string | null;
  total: number;
  done: number;
  queued: number;
  failed: number;
  /** 3 per horse delivered so far. */
  credits_charged: number;
  /**
   * True when your remaining credits are below the cost of one horse, which pauses collection
   * until they reset or you upgrade.
   */
  credits_blocked: boolean;
  /** Horses ahead of this job's oldest waiting row, across all jobs. */
  queue_position?: number | null;
  estimated_ready?: string | null;
  /** Completed rows you have not yet read. */
  ready_to_collect: number;
}

export interface BackfillSubmitIn {
  /**
   * Horse names or ra: refs. Max 500 per call. A ref is exact; a name is resolved against
   * acceptances and archived results.
   */
  horses: string[];
  /** Your own tag for this batch, echoed back on status. */
  label?: string | null;
}

export interface BackfillSubmitOut {
  job_id: string;
  label?: string | null;
  /** Horses accepted and waiting on the worker. */
  queued: number;
  /**
   * Horses we already hold a fresh copy of. Collectable immediately, still billed at 3 credits
   * each.
   */
  already_stored: number;
  /** Already queued for you; not queued twice. */
  duplicates: number;
  /** Names we have never seen on our own feeds. */
  not_found?: string[];
  /** Names matching several horses. Re-submit with the runner_ref you meant. */
  ambiguous?: Record<string, unknown>[];
  /** UTC estimate for the last horse, from the worker's measured pace. */
  estimated_ready?: string | null;
}

export interface BestOddsEventOut {
  id: string;
  sport_key: string;
  home_team: string | null;
  away_team: string | null;
  commence_time: string;
  selections: Record<string, unknown>[];
  arb_exists: boolean;
  arb_profit_pct: number;
  data_age_seconds?: number | null;
  freshest_age_seconds?: number | null;
  stale?: boolean;
  stale_bookmakers?: string[];
}

export interface BestPricesOut {
  id: string;
  sport_key: string;
  home_team: string | null;
  away_team: string | null;
  commence_time: string;
  selections: Record<string, unknown>[];
}

export interface ChangedRaceOut {
  /**
   * Stable race identifier — the same id /v1/racing/next-to-go, /v1/racing/price-history and
   * /v1/racing/results use.
   */
  race_id: string;
  venue?: string | null;
  race_number?: number | null;
  /** horse, greyhound or harness. */
  category?: string | null;
  /** ISO country code, or null while the meeting is unresolved. */
  country?: string | null;
  /**
   * Advertised start, UTC. It is revised as the meeting firms, and a revision bumps this race
   * into the feed.
   */
  start_time: string;
  /**
   * Set when the race row is created and revised exactly once, if at all: to 'abandoned' when
   * Racing Australia posts an official abandoned, postponed or transferred notice for the
   * meeting — that revision bumps every runner of the race into this feed (2026-09-06).
   * Otherwise it reads 'open' for every race here. It is not a live market-state signal — do not
   * poll this endpoint for it.
   */
  status?: string | null;
  /**
   * Betting-market state (OPEN, SUSPENDED, CLOSED). Reported by PointsBet, which sends CLOSED
   * when it shuts its book at the jump, and by the Betfair Exchange, which is withheld from
   * customer responses pending a data licence — so a value last written by the exchange reads
   * null for customers. Same shape as /v1/racing/events.
   */
  market_status?: string | null;
  /**
   * True once the market is in-play. Exchange-only — bookmakers do not run racing in-play — so
   * it carries the same licence hold as `market_status` and reads null for customers.
   */
  inplay?: boolean | null;
  /**
   * UTC time the market was FIRST seen shut. Poll-observed and set once — see /v1/racing/events
   * for the full semantics. Served when a BOOKMAKER reported the transition; null for customers
   * when the exchange was the only feed that saw it. Null never means the market stayed open.
   */
  market_closed_at?: string | null;
  /**
   * UTC time the race was FIRST seen in-play — the actual off, as opposed to `start_time`, which
   * is advertised and moves. Exchange-only, so null for customer plans.
   */
  inplay_at?: string | null;
  /**
   * Which feed's market state produced `market_closed_at` / `inplay_at` — 'pointsbetau' or
   * 'betfair_ex_au'. Set once, with the first stamp, and null whenever those stamps are
   * withheld.
   */
  market_state_source?: string | null;
  /**
   * The COMPLETE current scratchings for this race, merged across every book that reports one —
   * not a delta, so a runner leaving the list is visible as an absence. Greyhound cards also
   * carry box-vacancy placeholders here (a literal '....' or 'Vacant Box'), which name an empty
   * box rather than a withdrawn runner; match on `number` and treat a name from that set as a
   * vacant box.
   */
  scratchings?: Record<string, unknown>[];
  /**
   * UTC instant of the most recent logged track-condition, weather or rail transition for this
   * race's meeting (2026-09-05). Null when nothing has changed since we began watching it. Read
   * it with `track_condition`: the value says WHAT, this says WHEN.
   */
  track_condition_changed_at?: string | null;
  /**
   * The race's CURRENT track condition, not a change log — a poller diffing against what it
   * holds sees a condition change the same way it sees a scratching. Null where no source
   * reports it.
   */
  track_condition?: string | null;
  /** Current weather for the meeting, same read-as-current rule as track_condition. */
  weather?: string | null;
  /**
   * Runner prices that moved inside the window. An empty list means this race arrived on the
   * race-level arm alone — expected, and explained in the endpoint description.
   */
  changed_runners?: ChangedRunnerOut[];
}

export interface ChangedRunnerOut {
  /** Runner name as the bookmaker publishes it. */
  name: string;
  /** Saddlecloth / rug number, where the book supplies one. */
  number?: number | null;
  /** Bookmaker this price belongs to. */
  bookmaker_key: string;
  /** Current fixed win price at this bookmaker. */
  win_price?: number | null;
  /**
   * Current fixed place price. A place-only move does not advance `updated_at` — see the
   * endpoint description.
   */
  place_price?: number | null;
  /** Current Top 2 (first-two) price at this bookmaker, where quoted. */
  top2_price?: number | null;
  /** Current Top 3 price at this bookmaker, where quoted. */
  top3_price?: number | null;
  /** Current Top 4 price at this bookmaker, where quoted. */
  top4_price?: number | null;
  /**
   * UTC instant this runner's win or lay price last CHANGED at this bookmaker. Not the last
   * poll: ingest carries this timestamp forward while the price is steady.
   */
  updated_at: string;
}

export interface ClosingLinesOut {
  rows_returned: number;
  /** Rows matching the filter before limit/offset */
  total_rows: number;
  limit: number;
  offset: number;
  /**
   * Earliest start_time in the whole archive. The archive only grows; this is its true floor as
   * of right now, not a promise.
   */
  archive_from?: string | null;
  /** Set when the caller's plan clamps the lookback. NULL means the full archive was searched. */
  window_days?: number | null;
  /**
   * Rows in the matching set that have a result_status. Published because result coverage is
   * thin and growing (5.3% of archived races on 2026-08-18) — do not assume a NULL
   * finish_position means the runner lost. It means the runner is not in the published placings.
   */
  resulted_rows: number;
  rows: Record<string, unknown>[];
}

export interface ConnectorHealthOut {
  connector: string;
  last_ok: string | null;
  last_poll?: string | null;
  status: string;
  records_written: number;
  message?: string | null;
}

export interface DogCandidate {
  dog_id: number;
  dog_name?: string | null;
  /** Career starts on this feed, scratchings included. */
  runs: number;
  /** Meeting date of the most recent run. */
  last_start?: string | null;
}

export interface GreyhoundFormOut {
  dog_id?: number | null;
  dog_name?: string | null;
  /** True when the name matched several dogs. `runs` is then empty and `candidates` lists them. */
  ambiguous: boolean;
  candidates?: DogCandidate[];
  runs?: GreyhoundRun[];
  source: SourceBlock;
}

export interface GreyhoundRun {
  /** Meeting date, AEST calendar day, YYYY-MM-DD. */
  date?: string | null;
  /** Official Topaz track name, sponsor included (e.g. 'Bet Deluxe Capalaba'). */
  track?: string | null;
  distance_m?: number | null;
  /** Topaz raceTypeCode, e.g. '5', 'M', 'X45'. */
  grade?: string | null;
  race_number?: number | null;
  box?: number | null;
  rug?: number | null;
  weight_kg?: number | null;
  /** Official starting price, decimal. */
  sp?: number | null;
  /** Finishing place. NULL when the dog did not complete the course or was scratched. */
  position?: number | null;
  scratched: boolean;
  /** Fell, TailedOff, PulledUp, Disqualified or StayedInBox. NULL for a normal run. */
  abnormal?: string | null;
  time_s?: number | null;
  /** Winning time of this race, i.e. the place-1 dog's time. */
  win_time_s?: number | null;
  /** Margin to the winner in lengths, as Topaz publishes it (e.g. '5.50L'). */
  margin?: string | null;
  /**
   * Margin to the winner in seconds. On the winner's own run this is the winning margin over the
   * runner-up.
   */
  margin_s?: number | null;
  first_split_time?: number | null;
  first_split_position?: number | null;
  /**
   * Second sectional split. Only some tracks time two points: 21% of all runs carry one (603,734
   * of 2,861,690, measured 2026-09-02).
   */
  second_split_time?: number | null;
  second_split_position?: number | null;
  /** The dog's grade entering this race, as Topaz graded it. */
  grade_in?: string | null;
  /**
   * The dog's grade after this race's result was applied. A value differing from grade_in is a
   * grade change — a win typically moves the dog down a number (5 -> 4).
   */
  grade_out?: string | null;
  /** Position in running, one digit per section. */
  pir?: string | null;
  trainer: TrainerRef;
  /** Topaz raceId. Every runner in the same race shares it. */
  topaz_race_id?: number | null;
  dog_id: number;
  dog_name?: string | null;
}

export interface GreyhoundStatGroup {
  track?: string | null;
  distance_m?: number | null;
  box?: number | null;
  grade?: string | null;
  starts: number;
  wins: number;
  /** Finishes in the first three. */
  places: number;
  win_pct: number;
  place_pct: number;
  avg_time_s?: number | null;
  best_time_s?: number | null;
  avg_first_split?: number | null;
}

export interface GreyhoundStatsOut {
  dog_id?: number | null;
  dog_name?: string | null;
  ambiguous: boolean;
  candidates?: DogCandidate[];
  group_by?: string[];
  groups?: GreyhoundStatGroup[];
  source: SourceBlock;
}

export interface HorseCandidate {
  /** Stable ra: horsecode — re-query with this. */
  runner_ref: string;
  runner_name?: string | null;
  /** Most recent date this ref appeared on our feeds (acceptance or result). */
  last_seen?: string | null;
  /** Where it was seen: acceptances or results. */
  source: string;
}

export interface HorseCareer {
  starts?: number | null;
  wins?: number | null;
  seconds?: number | null;
  thirds?: number | null;
  /** Career prizemoney, whole AUD. */
  prizemoney?: number | null;
  /** Total bonus (e.g. BOBS), whole AUD. */
  bonus?: number | null;
  min_dist_win_m?: number | null;
  max_dist_win_m?: number | null;
  /**
   * RA's own career splits, keyed first_up, second_up, firm, good, soft, heavy, synthetic — plus
   * track, distance and track_distance when RA renders them. Each value is
   * starts/wins/seconds/thirds.
   */
  splits?: Record<string, SplitRecord>;
}

export interface HorseFormOut {
  horse_name?: string | null;
  /**
   * Stable ra: horsecode — the same identifier on /v1/racing/results runners and
   * acceptance-enriched live runners.
   */
  runner_ref?: string | null;
  /** True when the name matched several horses. `runs` is then empty and `candidates` lists them. */
  ambiguous: boolean;
  candidates?: HorseCandidate[];
  profile?: HorseProfile | null;
  career?: HorseCareer | null;
  runs?: HorseRun[];
  source?: HorseSource | null;
}

export interface HorseProfile {
  /** As published, e.g. '4yo Bay Gelding'. */
  age_sex?: string | null;
  dob?: string | null;
  sire?: string | null;
  dam?: string | null;
  status?: string | null;
  trainer?: string | null;
  trainer_location?: string | null;
  owners?: string | null;
  colours?: string | null;
  /** As published, date and gear, e.g. '20-Aug-2026, Blinkers, First Time, ...'. */
  last_gear_change?: string | null;
}

export interface HorseRun {
  date?: string | null;
  /** RA's compressed track code as published ('W FM' is Warwick Farm, 'RAND' Randwick). */
  track?: string | null;
  /** RA meeting code; every runner in the same meeting shares it. */
  meet_code?: string | null;
  race_number?: number | null;
  /** True for a barrier trial: $0 prize, 0kg weights and no market are how RA publishes them. */
  trial: boolean;
  position?: number | null;
  field_size?: number | null;
  /** The position cell as published, kept for rows that don't parse to a number. */
  result_raw?: string | null;
  distance_m?: number | null;
  /** Condition word: Firm, Good, Soft, Heavy, Synthetic. */
  going?: string | null;
  /** The number after the condition (Soft7 -> 7). Null where RA prints none. */
  going_rating?: number | null;
  /** RA's official class string for that race: 'MDN-SW', 'CTRY MDN', 'BM64', '3Y MDN-TRL'. */
  race_class?: string | null;
  prize_total?: number | null;
  /** This horse's cut, when RA shows it. */
  prize_won?: number | null;
  jockey?: string | null;
  /** RA's stable jockey code, consistent across every page that names the same rider. */
  jockey_code?: string | null;
  /**
   * Trainer of the day for THIS run, filled from our own results archive — RA's form table never
   * names the trainer per run. Populated for runs from 2026-09-01 onward (the archive's
   * full-runner floor) and NULL before that; `profile.trainer` is the horse's current trainer,
   * which is usually but not always the same person.
   */
  trainer?: string | null;
  weight_kg?: number | null;
  barrier?: number | null;
  /** Official race time in seconds. */
  time_s?: number | null;
  /** The published closing sectional's distance, usually 600. */
  sectional_distance_m?: number | null;
  sectional_time_s?: number | null;
  /** Margin in lengths. On this horse's own win it is the winning margin over the runner-up. */
  margin_l?: number | null;
  /** Position in running at the published marks (800m/400m). */
  pir?: RunPIR[];
  /** The published price path, opening quote through SP, oldest first. */
  prices?: number[];
  /** Starting price — the last entry of `prices`. */
  sp?: number | null;
  /**
   * The two nearest finishers RA lists (2nd and 3rd on this horse's win; the winner and
   * runner-up otherwise), each with its own ra: code.
   */
  placegetters?: RunPlacegetter[];
}

export interface HorseSource {
  feed?: string;
  region?: string;
  sport?: string;
  /** UTC time this horse's page was last read from RA. */
  fetched_at?: string | null;
  /**
   * True when RA could not be reached just now and this is the stored copy served past its
   * six-hour refresh window.
   */
  stale?: boolean;
}

export interface KeyResendIn {
  email: string;
}

export interface LinesArbOut {
  event_id: string;
  sport_key: string;
  home_team: string | null;
  away_team: string | null;
  commence_time: string;
  market_type: string;
  opportunities: Record<string, unknown>[];
}

export interface MoverOut {
  venue: string | null;
  race_number: number | null;
  category: string | null;
  country: string | null;
  start_time: string;
  mins_to_jump?: number | null;
  runner: string;
  number?: number | null;
  direction: string;
  open_price: number;
  current_price: number;
  move_pct: number;
  /** Books with a price for this runner, including ones we have never observed move. */
  books_quoting: number;
  /**
   * Books with two or more captured prices — the only ones that can evidence a move. The
   * consensus and the `min_books` gate use THIS count, not `books_quoting`.
   */
  books_with_history: number;
  books_firming: number;
  books_drifting: number;
  /**
   * Books whose captured price has not moved, including books seen only once. books_firming +
   * books_drifting + books_unchanged == books_quoting.
   */
  books_unchanged: number;
  bookmakers: Record<string, unknown>[];
}

export interface NextRaceOut {
  race_id: string;
  source_id: string | null;
  venue: string | null;
  /**
   * Stable slug for this venue spelling ('sandown-hillside'). Spelling variants of one venue
   * share one id.
   */
  venue_id?: string | null;
  /** Canonical display name for venue_id ('Sandown Hillside'). */
  venue_canonical?: string | null;
  /**
   * Physical-complex key: tracks sharing one venue complex share one site ('sandown' covers
   * Sandown, Sandown Hillside, Sandown Lakeside and the Sandown Park greyhound track).
   */
  venue_site?: string | null;
  race_number: number | null;
  category: string | null;
  start_time: string;
  country: string | null;
  race_name?: string | null;
  distance_m?: number | null;
  track_condition?: string | null;
  weather?: string | null;
  places_paid?: number | null;
  /**
   * UTC instant of the most recent logged track-condition, weather or rail transition for this
   * race's meeting — Racing Australia's re-published rating or a bookmaker's race page moving
   * between two of our polls. Null when nothing has changed since we began watching the meeting.
   * /v1/racing/track-conditions serves the sequence.
   */
  track_condition_changed_at?: string | null;
  /**
   * The first term of RA's official conditions line for this race ('BenchMark 64', 'Maiden',
   * 'Group 1'). AU thoroughbred only; null elsewhere.
   */
  race_class?: string | null;
  /**
   * RA's official conditions line, verbatim — class, race type, minimum weight, age/sex
   * restrictions, claiming allowances.
   */
  conditions?: string | null;
  /** Total advertised prize for the race, whole AUD. */
  prize_total?: number | null;
  /** Rail position for the meeting, as RA publishes it ('+3m Entire'). AU thoroughbred only. */
  rail?: string | null;
  /**
   * Racing Australia's own name for the course this race runs on, verbatim: 'Hillside' at
   * Sandown, 'Randwick' vs the Kensington inner course, 'Main' elsewhere. Combine with
   * venue_site to tell dual-course meetings apart. AU thoroughbred only; null elsewhere.
   */
  track_name?: string | null;
  /**
   * UTC time at which the market was FIRST seen shut — the book stopped taking bets on this
   * race. Poll-observed: racing polls every 8s inside 120s of a jump, 15s inside 10 minutes and
   * 20s otherwise, so this is the first poll that saw the state, not the exact instant; it lands
   * within about one poll interval after it. Set once: a market that flickers SUSPENDED -> OPEN
   * -> SUSPENDED keeps the FIRST suspension. TWO SOURCES report market state. PointsBet closes
   * its book at the real jump — measured 2026-09-03 over 9 live races followed across their
   * jump, 0.2 to 1.4 minutes AFTER the advertised start on AU/NZ cards — and the Betfair
   * Exchange reports it while it quotes the market, which is until about two minutes before the
   * jump. `market_state_source` names the one that produced this value. Exchange-sourced stamps
   * are withheld from customer plans (operator ruling 2026-09-01): they republish licence-held
   * market state, so a race seen shut only by the exchange reads null for customers and carries
   * the value for internal callers. Bookmaker-sourced stamps are served to everybody. Null also
   * means no feed observed a transition — it never means the market stayed open.
   */
  market_closed_at?: string | null;
  /**
   * UTC time at which the race was FIRST seen in-play — the actual off, as opposed to
   * `start_time`, which is the ADVERTISED off and moves. Same poll-observed, set-once semantics
   * as `market_closed_at`, and withheld on the same source rule. Reported by the Betfair
   * Exchange only: bookmakers do not run racing in-play, so a bookmaker feed says when it CLOSED
   * its book, not when the race went. For a race the exchange has stopped quoting,
   * `market_closed_at` from a bookmaker is the closest measured instant to the off.
   */
  inplay_at?: string | null;
  /**
   * Which feed's market state produced `market_closed_at` / `inplay_at` on this race —
   * 'pointsbetau' for the bookmaker, 'betfair_ex_au' for the exchange. Set once, alongside the
   * first stamp. Null when no transition has been observed, and null for customer plans whenever
   * the stamps themselves are withheld, so a non-null value here is always the provenance of
   * values you can see.
   */
  market_state_source?: string | null;
  scratchings?: Record<string, unknown>[];
  runners: Record<string, unknown>[];
  /**
   * Age in seconds of the OLDEST bookmaker quote in this race — the staleness you are exposed to
   * if you act on any price here. Since 2026-08-15 this is the worst leg, not the freshest;
   * `freshest_age_seconds` carries the best-case figure.
   */
  data_age_seconds?: number | null;
  /** Age in seconds of the freshest bookmaker quote in this race. */
  freshest_age_seconds?: number | null;
  /**
   * Which refresh rule this race is on, and therefore what the race-level `stale` means. `live`
   * = inside 3 hours of the jump: books re-price it on every 8-20s poll, and `stale` fires past
   * 120 seconds. `card` = further out: books re-price it about every 15 minutes so a full day
   * fits inside their rate limits, and `stale` fires past 1800 seconds. Every published quote
   * carries ITS OWN `refresh_tier`, and it can be `card` on a `live` race: Betr's upstream
   * rate-limits us, so that book stops re-pricing every poll 30 minutes before the jump rather
   * than 3 hours (PlayUp, on a 6-requests-a-minute budget, at 6 minutes), and its quotes between
   * there and 3 hours are refreshed every 5-15 minutes, published as `card`, and judged against
   * 1800 seconds (since 2026-09-07; before that they were marked stale). A book's tier is never
   * tighter than its race's. `age_seconds` is the TRUE age in every case — only the threshold
   * changes.
   */
  refresh_tier?: string;
  /**
   * True when the oldest contributing bookmaker is older than this race's `refresh_tier`
   * threshold — 120s on `live`, 1800s on `card`. It does NOT mean the whole race is dead — read
   * `stale_bookmakers` and each bookmaker's own `stale`/`age_seconds`.
   */
  stale?: boolean;
  /**
   * Bookmaker keys in this race whose quote is older than the `refresh_tier` threshold (120s
   * live, 1800s card).
   */
  stale_bookmakers?: string[];
  cached?: boolean | null;
  cache_age_seconds?: number | null;
}

export interface PremiershipOut {
  role: string;
  season_start_year?: number | null;
  /** Echo of the filter; null when a name search crossed all states. */
  state?: string | null;
  scope?: string | null;
  name?: string | null;
  rows?: PremiershipRow[];
  source: PremiershipSource;
}

export interface PremiershipRow {
  /** AUS is the national table — RA's own combined leaderboard, not a sum of the state rows. */
  state: string;
  /** RA's split: all, metro, provincial, country or picnic. */
  scope: string;
  /** Position in RA's table, 1-20. */
  rank: number;
  name: string;
  /**
   * RA's stable code from the row's engagement link — the same namespace as trainer_code on
   * acceptance data and jockey_code on /v1/racing/horses/form runs, so rows join on identity,
   * not name spelling.
   */
  ra_code?: string | null;
  /** Wins. REAL, not int: dead heats appear as halves in some tables (RA prints 23½). */
  firsts?: number | null;
  seconds?: number | null;
  thirds?: number | null;
  fourths?: number | null;
  fifths?: number | null;
  /** Season prize money, AUD. */
  prize_money?: number | null;
  /** RA's own figure, percent. */
  strike_rate?: number | null;
  starts?: number | null;
  /** Start of the window this row measures (RA seasons run 1 Aug to 31 Jul). */
  period_from?: string | null;
  /**
   * End of the measured window. On the running season this is the day RA rendered the table,
   * which makes it the per-row freshness stamp: rows from a table scraped two nights ago carry
   * that day, not today.
   */
  period_to?: string | null;
}

export interface PremiershipSource {
  feed?: string;
  region?: string;
  sport?: string;
  /**
   * UTC time of the newest row served in this response. For the usual single-table lookup (a
   * `state` + `scope`) every row comes from one scrape, so this IS that table's age. A `name`
   * search spans tables scraped on different nights, so there read it as the freshest of them
   * and use `period_to` for the age of each individual row.
   */
  scraped_at?: string | null;
  /**
   * RA publishes each premiership as a top-20 table. Absence from `rows` means outside the top
   * 20, never inactivity.
   */
  top_n?: number;
}

export interface PriceHistoryOut {
  race_id: string;
  venue: string | null;
  venue_id?: string | null;
  venue_canonical?: string | null;
  venue_site?: string | null;
  race_number: number | null;
  category: string | null;
  country: string | null;
  start_time: string;
  points_returned: number;
  truncated: boolean;
  /**
   * Start time of the earliest race this endpoint can answer for. Since 2026-09-01 races older
   * than the ~45-day live window are served from the permanent archive, so this floor is fixed
   * at capture start (2026-08-04) and history only deepens.
   */
  history_from?: string | null;
  runners: Record<string, unknown>[];
}

export interface PricePathsOut {
  rows_returned: number;
  /** Points matching the filter before limit/offset */
  total_points: number;
  limit: number;
  offset: number;
  archive_from?: string | null;
  rows: Record<string, unknown>[];
}

export interface RaceEventOut {
  race_id: string;
  venue: string | null;
  venue_id?: string | null;
  venue_canonical?: string | null;
  venue_site?: string | null;
  race_number: number | null;
  category: string | null;
  start_time: string;
  country: string | null;
  race_name?: string | null;
  distance_m?: number | null;
  track_condition?: string | null;
  weather?: string | null;
  /**
   * The first term of RA's official conditions line ('BenchMark 64', 'Maiden', 'Group 1'). AU
   * thoroughbred only.
   */
  race_class?: string | null;
  /** RA's official conditions line, verbatim. */
  conditions?: string | null;
  /** Total advertised prize, whole AUD. */
  prize_total?: number | null;
  /** Rail position for the meeting, as RA publishes it. */
  rail?: string | null;
  /**
   * RA's own name for the course this race runs on ('Hillside', 'Randwick', 'Main'). AU
   * thoroughbred only; null elsewhere.
   */
  track_name?: string | null;
  /**
   * UTC instant of the most recent logged track-condition, weather or rail transition for this
   * race's meeting; null when nothing has changed since we began watching it. The sequence is on
   * /v1/racing/track-conditions.
   */
  track_condition_changed_at?: string | null;
  /**
   * Set when the race row is created and revised exactly once, if at all: to 'abandoned' when
   * Racing Australia posts an official abandoned, postponed or transferred notice for the
   * meeting (2026-09-06). Otherwise it reads 'open' for every race in this window. It is not a
   * live market-state signal - /v1/racing/results carries the settled status (interim, final,
   * abandoned).
   */
  status?: string | null;
  /**
   * Scratched runners for this race: {name, number, barrier, scratched_at, late, emergency}.
   * `scratched_at` (UTC) is the book's own stamp where it sends one (Ladbrokes, Neds, BetRight)
   * and Racing Australia's official scratching sheet otherwise (AU thoroughbreds, read
   * two-hourly); absent when neither knows. `late` marks a late scratching, `emergency` an
   * emergency that did not gain a start. Merged across every book that reports one. Greyhound
   * cards also carry box-vacancy placeholders here (a literal '....' or 'Vacant Box'), which are
   * the reporting book naming an empty box rather than a withdrawn runner; match on `number` and
   * treat a name from that set as a vacant box.
   */
  scratchings?: Record<string, unknown>[];
  /**
   * Betting-market state (OPEN, SUSPENDED, CLOSED). Reported by PointsBet, which sends CLOSED
   * when it shuts its book at the jump, and by the Betfair Exchange, which is withheld from
   * customer responses pending a data licence — so a value last written by the exchange reads
   * null for customers and carries through for internal callers. Most races are quoted by both:
   * the exchange holds the state until about two minutes before the jump, PointsBet reports the
   * close.
   */
  market_status?: string | null;
  /**
   * True once the market is in-play. Exchange-only — bookmakers do not run racing in-play — so
   * it carries the same licence hold as `market_status` and reads null for customers.
   */
  inplay?: boolean | null;
  /**
   * UTC time at which the market was FIRST seen shut — the book stopped taking bets on this
   * race. Poll-observed: racing polls every 8s inside 120s of a jump, 15s inside 10 minutes and
   * 20s otherwise, so this is the first poll that saw the state, not the exact instant; it lands
   * within about one poll interval after it. Set once: a market that flickers SUSPENDED -> OPEN
   * -> SUSPENDED keeps the FIRST suspension. TWO SOURCES report market state. PointsBet closes
   * its book at the real jump — measured 2026-09-03 over 9 live races followed across their
   * jump, 0.2 to 1.4 minutes AFTER the advertised start on AU/NZ cards — and the Betfair
   * Exchange reports it while it quotes the market, which is until about two minutes before the
   * jump. `market_state_source` names the one that produced this value. Exchange-sourced stamps
   * are withheld from customer plans (operator ruling 2026-09-01): they republish licence-held
   * market state, so a race seen shut only by the exchange reads null for customers and carries
   * the value for internal callers. Bookmaker-sourced stamps are served to everybody. Null also
   * means no feed observed a transition — it never means the market stayed open.
   */
  market_closed_at?: string | null;
  /**
   * UTC time at which the race was FIRST seen in-play — the actual off, as opposed to
   * `start_time`, which is the ADVERTISED off and moves. Same poll-observed, set-once semantics
   * as `market_closed_at`, and withheld on the same source rule. Reported by the Betfair
   * Exchange only: bookmakers do not run racing in-play, so a bookmaker feed says when it CLOSED
   * its book, not when the race went. For a race the exchange has stopped quoting,
   * `market_closed_at` from a bookmaker is the closest measured instant to the off.
   */
  inplay_at?: string | null;
  /**
   * Which feed's market state produced `market_closed_at` / `inplay_at` on this race —
   * 'pointsbetau' for the bookmaker, 'betfair_ex_au' for the exchange. Set once, alongside the
   * first stamp. Null when no transition has been observed, and null for customer plans whenever
   * the stamps themselves are withheld, so a non-null value here is always the provenance of
   * values you can see.
   */
  market_state_source?: string | null;
}

export interface RaceResultOut {
  /**
   * Race id, joinable to /v1/racing/price-history and (while the race is still open)
   * /v1/racing/next-to-go. Null if the race cannot be resolved in the price-history store.
   */
  race_id?: string | null;
  /** Start time of the earliest result currently retained. */
  coverage_from?: string | null;
  venue: string | null;
  venue_id?: string | null;
  venue_canonical?: string | null;
  venue_site?: string | null;
  race_number: number | null;
  category: string | null;
  country: string | null;
  start_time: string;
  race_name?: string | null;
  distance_m?: number | null;
  track_condition?: string | null;
  /**
   * Track condition word, normalised: Good, Soft, Heavy, Firm, Fast, Synthetic. Parsed from
   * `track_condition` with the same helper /v1/racing/horses/form uses, so the two surfaces
   * agree. Null when `track_condition` is null or unparseable; `track_condition` remains the raw
   * string exactly as the source published it.
   */
  going?: string | null;
  /**
   * Numeric going rating 1-12 (the 4 in 'Good (4)'), or null. NULL IS THE MAJORITY CASE, not an
   * exception for two rare words: most stored conditions are a bare word carrying no number at
   * all. Measured 2026-09-10 across all 5,579 stored results, a bare 'Good' is 3,954 rows (71%)
   * and yields null, so a rating is present on roughly 29% of rows — greyhound and other
   * non-thoroughbred meetings publish an unrated word as a rule. A rating is never guessed from
   * the word ('Synthetic', 67 rows, and 'Firm', 0 rows, never carry one). Separately, 205 rows
   * store the four-character STRING 'None' in `track_condition`: `going` and `going_rating` are
   * both null on those, while `track_condition` still serves that literal string, because
   * `track_condition` is the raw source value passed through untouched.
   */
  going_rating?: number | null;
  weather?: string | null;
  /**
   * interim | final | abandoned. `interim` until the placings have been stable for 30 minutes,
   * then `final`. `abandoned` (2026-09-06) is a race that did NOT run: Racing Australia's
   * official Abandoned & Transferred Meetings notice for that venue and date, applied to every
   * race of the meeting — placings are empty and runners null. Settle only against `final`;
   * treat `abandoned` as a void for settlement purposes.
   */
  status: string;
  /**
   * Only on `abandoned` rows: RA's own word for the non-run — "abandoned", "postponed", or
   * "transferred to <venue>". A postponed or transferred meeting did not run at THIS venue on
   * THIS date; if it ran elsewhere or later it appears as its own result.
   */
  status_note?: string | null;
  /**
   * The placegetters: {position, number, name, win_price, place_price, sp, sp_note}. `win_price`
   * and `place_price` are the SETTLING BOOKMAKER'S FIXED prices. `sp` is the OFFICIAL STARTING
   * PRICE as a decimal return on a $1 stake (4.6 means $4.60), null where it is unknown — never
   * 0. It is the settling market's own price, not our consensus and not a bookmaker's fixed
   * price: greyhound SP comes from the official Topaz feed, thoroughbred SP from the Racing
   * Australia results table, and HARNESS SP IS ALWAYS NULL — no source we hold publishes it.
   * `sp_note` carries Racing Australia's favouritism marker on thoroughbred runners ('F'
   * favourite, 'EF' equal favourite) and is null everywhere else. Coverage RE-MEASURED
   * 2026-09-08 over the whole retained store, counting only rows whose `status` is `ran` (a
   * barrier scratching is not a starter and its price is not in this denominator): 99.8% of
   * greyhound starters carry `sp` (14,540 of 14,568) and 88.6% of thoroughbred starters do
   * (2,105 of 2,375). The Racing Australia block that held thoroughbred SP at 0% when this was
   * last measured on 2026-09-03 has lifted and the collector has been landing meetings since. A
   * null `sp` is unknown, never zero — RA prints no SP at all on some rows. On placings, `sp` is
   * copied from the matching `runners` entry when the response is built, so the two can never
   * disagree. On a race with no `runners` payload the `sp` and `sp_note` KEYS ARE ABSENT from
   * each placing — not present and null. The copy step is what creates them and it is skipped
   * when there is nothing to copy from, so a schema-validating consumer sees a different object
   * shape, not a null: read them with `.get()`. The keys are deliberately NOT normalised in,
   * because adding them here would change the shipped payload of every COMPLETE race too, and
   * nothing may move under a customer mid-integration. `field_status` tells you which case you
   * are in before you look.
   */
  placings?: Record<string, unknown>[];
  /**
   * One entry per runner: {number, box, name, position, status, abnormal, margin, time_s,
   * dead_heat}. Presence in this list is NOT proof the runner started. `status` is what says so,
   * and `status` is what you settle on. ⚠️ COVERAGE. Read `field_status` on the row FIRST — it
   * is the per-race answer, and it is what separates a field that has not been filled yet from
   * one that never will be. Two different facts live here and they used to be told as one. (1)
   * WHETHER THERE IS A FIELD AT ALL, and mostly there is not. Measured 2026-09-10 across the
   * whole retained store — 5,577 results, 2,902 of them serving `runners: null`: AU greyhound
   * carries a field on 2,360 of 3,219 races, AU thoroughbred on 315 of 1,104, and AU HARNESS, NZ
   * THOROUGHBRED AND NZ HARNESS CARRY NONE AT ALL — 1,254 races in codes no collector has ever
   * existed for, every one of them `field_status: unsupported`. Inside the two supported codes
   * it is not a clean ramp either: each is filled by a scheduled pass, and where that pass
   * cannot match a race with certainty it writes nothing rather than another race's field, so
   * past the fill window 104 of 2,201 AU greyhound races (4.7%) and 44 of 288 AU thoroughbred
   * races (15.3%) keep `runners: null` for good — `field_status: unavailable`, and polling them
   * will not help. `runners` is JSON null in every one of these cases and has never once been an
   * empty array (0 empty arrays in the whole store, measured the same day), so `runners is None`
   * is a safe test and an empty field is not a shape you have to handle. (2) THE SHAPE OF A
   * FIELD THAT IS PRESENT, which is where the 2026-09-08 date belongs. An AU thoroughbred field
   * WRITTEN from 2026-09-08 carries every starter plus every runner Racing Australia printed as
   * scratched; one written before that date carries STARTERS ONLY, because the collector dropped
   * RA's scratched rows and a stored field is never rewritten. Measured 2026-09-08, all 244
   * thoroughbred fields stored at that point were the old shape and 198 of them publish a
   * `deductions` row for a horse absent from `runners`. So on an older race `deductions` is the
   * list of scratchings and `runners` is the starters; do not read a short `runners` array as a
   * small field. Greyhound fields have carried the whole field since greyhound collection began
   * on the 2026-08-21 Sydney card — but 859 AU greyhound races carry no field at all, which is
   * question (1) and not this one. `position` is the finishing position for every runner that
   * completed the race — not just the placegetters — and is null whenever there is none: the
   * runner did not start, or it started and did not finish. `status` is ran | scratched |
   * late_scratching | reserve (an emergency that never got a start). `abnormal` is the official
   * reason cell, and it carries TWO families that settle in OPPOSITE directions, so read it with
   * `status` and never alone. (1) A DID-NOT-FINISH reason on a row whose `status` is `ran` —
   * Fell, PulledUp, Disqualified, TailedOff, StayedInBox: the runner started and simply has no
   * finishing position, and a bet on it lost. (2) A DID-NOT-START reason on a row whose `status`
   * is `scratched` — 'SB', Racing Australia's code for scratched at the barrier: the runner was
   * taken out of the market before the jump, so `position` is null, it is in no `placings`
   * entry, and bets on it were refunded while the rest of the race was deducted. An 'SB' row may
   * still carry `sp` — the last price Racing Australia printed for it, kept rather than blanked
   * because it is a real market fact about the withdrawn runner. It is NOT the basis of the
   * deduction, and you must never derive one from the other: `sp` comes from RA's results table
   * while a deduction is struck by the settling bookmaker, and they do not agree. Measured
   * 2026-09-08 across all five stored 'SB' rows that carry a price, 1/`sp` equals the published
   * win deduction on NONE of them — Varejao, Sunshine Coast R4 2026-09-06, saddlecloth 5,
   * withdrawn about 2 minutes 20 before the jump: `sp` 3.70, so 1/3.70 is 0.27 in the dollar,
   * against a published `deductions` row of 0.18 win and 0.15 place; Dubai Dancer, Warrnambool
   * R5: 1/5.50 is 0.18 against a published 0.10. Settle from `deductions`, which is
   * authoritative. None of the five carries a `position` or a `margin`. Telling a barrier
   * scratching from one made days earlier is CODE-SPECIFIC, and the two collectors do not spell
   * it the same way — do not write one rule across categories. On AU thoroughbred (Racing
   * Australia) both are `status: scratched`, and `abnormal` is the discriminator ONLY in one
   * direction: a barrier scratching carries 'SB'; every other scratching carries `abnormal`
   * null. Both carry their saddlecloth `number`, both carry `box` null (the runner has no
   * barrier it jumped from — RA prints 0 there and we do not pass that sentinel on), and an
   * ordinary scratching carries `sp` null while an 'SB' may carry one. So `abnormal == 'SB'`
   * identifies a barrier scratching; `abnormal` null tells you only that it was not one, not how
   * early it happened — use `deductions[].scratched_at` for that. On greyhound (Topaz)
   * `abnormal` is null on every scratching and `status` is the discriminator: the LATE one is
   * `late_scratching`, an earlier one is `scratched`. So today `late_scratching` is a
   * greyhound-only value — a thoroughbred barrier scratching does NOT use it — and `scratched`
   * does not carry identical meaning in the two codes. `deductions` carries `scratched_at` for
   * either, and is the one cross-code way to see how close to the jump a runner came out.
   * `dead_heat` is true on each runner sharing a position. `runner_ref` is a STABLE runner
   * identifier from the official registry (namespaced: ra:<code> thoroughbred, grv:<id>
   * greyhound) — it persists across meetings, so it is the join key for longitudinal work; null
   * while a code's registry source is not yet wired. `trainer` and `jockey` come from the same
   * official results source and may be null where that source is not yet live for the code. `sp`
   * is the OFFICIAL STARTING PRICE as a decimal return on a $1 stake (4.6 means $4.60), null
   * where it is unknown — never 0. It is the settling market's own price, not our consensus and
   * not a bookmaker's fixed price: greyhound SP comes from the official Topaz feed, thoroughbred
   * SP from the Racing Australia results table, and HARNESS SP IS ALWAYS NULL — no source we
   * hold publishes it. `sp_note` carries Racing Australia's favouritism marker on thoroughbred
   * runners ('F' favourite, 'EF' equal favourite) and is null everywhere else. Coverage
   * RE-MEASURED 2026-09-08 over the whole retained store, counting only rows whose `status` is
   * `ran` (a barrier scratching is not a starter and its price is not in this denominator):
   * 99.8% of greyhound starters carry `sp` (14,540 of 14,568) and 88.6% of thoroughbred starters
   * do (2,105 of 2,375). The Racing Australia block that held thoroughbred SP at 0% when this
   * was last measured on 2026-09-03 has lifted and the collector has been landing meetings
   * since. A null `sp` is unknown, never zero — RA prints no SP at all on some rows. Null
   * `runners` means the full field is not available for this race — never an empty field;
   * population is rolling out per racing code as our own results collection comes online.
   * `placings` remains the source for the settling bookmaker's own fixed prices, and now also
   * carries `sp` copied from here.
   */
  runners?: Record<string, unknown>[] | null;
  /**
   * Why `runners` is or is not there, per race — the field a caller was missing when `runners:
   * null` was the only signal and it collapsed several different futures into one. SIX values.
   * `complete`: `runners` is present. It is set whenever a field is stored, including on an
   * abandoned race that unexpectedly carries one, so `field_status == 'complete'` is a safe gate
   * before parsing. `pending`: a collector exists for this code and the pass that NORMALLY fills
   * this race has not been yet; `field_note` names the UTC instant by which it will have run.
   * `overdue`: that pass has been and gone without writing a field, but the collector still
   * selects this row as a candidate and keeps re-attempting it — this state is NOT terminal. For
   * AU greyhound the Topaz enricher re-reads every field-less row on each daily run for ten days
   * after the race (its own LOOKBACK_DAYS); for AU thoroughbred a bounded re-fetch reaches six
   * days but is run by hand rather than on a schedule. Most rows that reach `overdue` stay null,
   * so do not build on a field arriving — but do not write the race off either, and `field_note`
   * gives the horizon. `unavailable`: no scheduled pass still selects this row. Its collector's
   * own candidate window closed at the instant in `field_note` and no field was written — the
   * pass either never matched the race or refused an ambiguous match, which it does rather than
   * write another race's field. `unsupported`: no collector has ever existed for this
   * category/country — AU harness, NZ thoroughbred and NZ harness, 1,254 of the 5,577 stored
   * results on 2026-09-10, plus any other country that appears because an AU book listed the
   * meeting — and no amount of waiting will produce one. `not_applicable`: the race did not run
   * (abandoned, postponed or transferred) and carries no field, so there is nothing to collect.
   * TRANSITIONS, stated explicitly because acting on the wrong one costs you data. The scheduled
   * progression is pending -> overdue -> unavailable, one direction only. It is bounded at every
   * step by a collector's own window rather than by hope: a race can sit
   * matched-and-never-resulted forever (The Gardens, 2026-09-05, 12 races), and an open-ended
   * `pending` would have you polling it forever. Any of those three becomes `complete` the
   * moment a field is written, AND THAT INCLUDES `unavailable` — nothing un-writes a `runners`
   * array, so a collector re-run by hand, a widened window or a late upstream publication can
   * still fill a row we have stopped scheduling passes for. So `unavailable` means 'nothing
   * further is scheduled', never 'this can never arrive'; if you reconcile, re-read rather than
   * caching it as final. `unsupported` and `not_applicable` are properties of the racing code
   * and of the race itself, not of a schedule, and do not change on their own.
   */
  field_status?: string;
  /**
   * Which collector owns `runners` for this race: `racing_australia` (AU thoroughbred), `topaz`
   * (AU greyhound), or null where no collector exists. Set on `pending`, `overdue`,
   * `unavailable` and `complete` rows alike — it names who WOULD fill the field, not who did.
   */
  field_source?: string | null;
  /**
   * Prose for the non-`complete` states: which pass fills this code, when its normal pass for
   * this race has been and gone, how long the collector keeps re-attempting the row, or that the
   * code has no source at all. Null on `complete`. Written for a human reading a response —
   * branch on `field_status`, never on this text.
   */
  field_note?: string | null;
  /**
   * Scratched runners and the deduction applied to bets already struck. `win` and `place` are
   * fractions of the dollar in the range 0-1 (0.34 = 34 cents in the dollar), as published by
   * the settling bookmaker.
   */
  deductions?: Record<string, unknown>[];
  /**
   * Dividends declared for the race. `straight` holds one row per placegetter per product:
   * {position, number, name, market ('WIN' or 'PLC'), product, amount}. `exotics` holds one row
   * per exotic product: {type, code ('QN', 'EX', 'TF', 'FF'), selection, product, amount}, where
   * `selection` is the winning saddlecloth numbers in finishing order, e.g. '5,1'. Every
   * `amount` is the return on a $1 stake, the same convention as the odds fields — a 'FIXED'
   * straight dividend equals that runner's own settled fixed price. `product` names the settling
   * pool: 'FIXED' is the bookmaker's own price, the rest are tote products (SP, MIDDIV, VIC,
   * RD+, BT+SP). A product that declared no dividend is omitted rather than returned as 0.
   * Exotic dividends are only declared once the race fully settles, a few minutes after the
   * placings, so a just-resulted race can carry `straight` while `exotics` is still empty — it
   * fills in on a later poll. Quaddie and daily-double dividends span several races and are NOT
   * reported here. `straight_types` is the book's raw list of product codes, retained for
   * backwards compatibility.
   */
  dividends?: Record<string, unknown> | null;
  resulted_at?: string | null;
  /**
   * UTC time at which the market was FIRST seen shut — the book stopped taking bets on this
   * race. Poll-observed: racing polls every 8s inside 120s of a jump, 15s inside 10 minutes and
   * 20s otherwise, so this is the first poll that saw the state, not the exact instant; it lands
   * within about one poll interval after it. Set once: a market that flickers SUSPENDED -> OPEN
   * -> SUSPENDED keeps the FIRST suspension. TWO SOURCES report market state. PointsBet closes
   * its book at the real jump — measured 2026-09-03 over 9 live races followed across their
   * jump, 0.2 to 1.4 minutes AFTER the advertised start on AU/NZ cards — and the Betfair
   * Exchange reports it while it quotes the market, which is until about two minutes before the
   * jump. `market_state_source` names the one that produced this value. Exchange-sourced stamps
   * are withheld from customer plans (operator ruling 2026-09-01): they republish licence-held
   * market state, so a race seen shut only by the exchange reads null for customers and carries
   * the value for internal callers. Bookmaker-sourced stamps are served to everybody. Null also
   * means no feed observed a transition — it never means the market stayed open. Copied from the
   * live race row when the result is written; that row is deleted 10 minutes after the jump and
   * results land a median 4.9 minutes after the start, so a late result keeps null.
   */
  market_closed_at?: string | null;
  /**
   * UTC time at which the race was FIRST seen in-play — the actual off, as opposed to
   * `start_time`, which is the ADVERTISED off and moves. Same poll-observed, set-once semantics
   * as `market_closed_at`, and withheld on the same source rule. Reported by the Betfair
   * Exchange only: bookmakers do not run racing in-play, so a bookmaker feed says when it CLOSED
   * its book, not when the race went. For a race the exchange has stopped quoting,
   * `market_closed_at` from a bookmaker is the closest measured instant to the off. Copied from
   * the live race row when the result is written; that row is deleted 10 minutes after the jump
   * and results land a median 4.9 minutes after the start, so a late result keeps null.
   */
  inplay_at?: string | null;
  /**
   * Which feed's market state produced `market_closed_at` / `inplay_at` on this race —
   * 'pointsbetau' for the bookmaker, 'betfair_ex_au' for the exchange. Set once, alongside the
   * first stamp. Null when no transition has been observed, and null for customer plans whenever
   * the stamps themselves are withheld, so a non-null value here is always the provenance of
   * values you can see.
   */
  market_state_source?: string | null;
}

export interface RacingBestOddsOut {
  race_id: string;
  venue: string | null;
  race_number: number | null;
  category: string | null;
  country: string | null;
  start_time: string;
  race_name?: string | null;
  track_condition?: string | null;
  market_percentage?: number | null;
  books_compared: number;
  scratchings?: Record<string, unknown>[];
  /** Age in seconds of the OLDEST bookmaker quote behind this race. */
  data_age_seconds?: number | null;
  freshest_age_seconds?: number | null;
  /**
   * Which refresh rule this race is on, and therefore what the race-level `stale` means. `live`
   * = inside 3 hours of the jump: books re-price it on every 8-20s poll, and `stale` fires past
   * 120 seconds. `card` = further out: books re-price it about every 15 minutes so a full day
   * fits inside their rate limits, and `stale` fires past 1800 seconds. Every published quote
   * carries ITS OWN `refresh_tier`, and it can be `card` on a `live` race: Betr's upstream
   * rate-limits us, so that book stops re-pricing every poll 30 minutes before the jump rather
   * than 3 hours (PlayUp, on a 6-requests-a-minute budget, at 6 minutes), and its quotes between
   * there and 3 hours are refreshed every 5-15 minutes, published as `card`, and judged against
   * 1800 seconds (since 2026-09-07; before that they were marked stale). A book's tier is never
   * tighter than its race's. `age_seconds` is the TRUE age in every case — only the threshold
   * changes.
   */
  refresh_tier?: string;
  stale?: boolean;
  stale_bookmakers?: string[];
  cached?: boolean | null;
  cache_age_seconds?: number | null;
  runners: Record<string, unknown>[];
}

export interface RacingChangesOut {
  /**
   * Send this back as `since` on your next poll. Deliberately set back 30 seconds from the
   * server clock so no in-flight write is skipped — the feed is at-least-once, not exactly-once.
   */
  server_time: string;
  races?: ChangedRaceOut[];
}

export interface ResultsCoverageOut {
  /** When these counts were computed (UTC). */
  as_of: string;
  /** How many Sydney days the window spans, ending today. */
  days: number;
  /** First Sydney date counted (inclusive). */
  from_day: string;
  /**
   * Last Sydney date counted — today in Sydney, so it is a PART day and its races are mostly
   * `pending`.
   */
  to_day: string;
  /**
   * Start time of the earliest result retained anywhere in the store, the same value
   * /v1/racing/results puts on every row.
   */
  coverage_from?: string | null;
  /**
   * Every stored result in the window, all codes and all states. races == complete + pending +
   * overdue + unavailable + unsupported + not_applicable, always.
   */
  races: number;
  /** Races carrying a `runners` field. */
  complete: number;
  /** A collector exists and the pass that normally fills the race has not been yet. */
  pending: number;
  /**
   * That pass has been and gone with no field written, but the collector still re-attempts the
   * row. NOT a terminal state — see `field_status` on /v1/racing/results for the horizons.
   */
  overdue: number;
  /** Past the collector's own retry horizon: no scheduled pass still selects the row. */
  unavailable: number;
  /** No collector has ever existed for the code. */
  unsupported: number;
  /**
   * The race did not run (abandoned, postponed or transferred) and has no field — nothing to
   * collect, not a gap.
   */
  not_applicable: number;
  /**
   * races - unsupported - not_applicable: the races in this window that could carry a field at
   * all. It is the denominator of `supported_complete_pct`, published so that a null percentage
   * is readable as 0-of-0 rather than guessed at.
   */
  collectable: number;
  /**
   * complete / races as a percentage, across the whole window including codes that can never
   * carry a field. NULL — not 0.0 — when `races` is 0. An empty window has no coverage figure,
   * and 0.0 there is a fabricated number that reads as total failure: a `days=1` window called
   * between Sydney midnight and the day's first result is empty on most days (the median first
   * result of a Sydney day lands at 10:50 local), so this is an ordinary case and not a corner.
   */
  complete_pct?: number | null;
  /**
   * complete / collectable: the figure to read if you only care about the codes we collect
   * fields for. The raw `complete_pct` is dragged down by 1,254 stored races in codes that can
   * never have one. NULL — not 0.0 — when `collectable` is 0, which happens both on an empty
   * window and on a window holding only AU harness / NZ rows. If you alert on this figure, treat
   * null as 'no data' and never as 'zero coverage'.
   */
  supported_complete_pct?: number | null;
  /**
   * One row per country + category over the window: {country, category, field_source, races,
   * complete, pending, unavailable, unsupported, not_applicable}.
   */
  by_category: Record<string, unknown>[];
  /**
   * One row per Sydney day + country + category, newest first, with the same counts. This is the
   * day-by-day answer to 'is yesterday finished yet'.
   */
  by_day: Record<string, unknown>[];
  /**
   * Venue-days still missing a field in a code we DO collect: {day, venue, venue_id, category,
   * country, settled} plus every counter above (races, complete, pending, overdue, unavailable,
   * unsupported, not_applicable), which sum to `races` exactly. Ordered worst first: most
   * `unavailable`, then the biggest outstanding shortfall, then oldest day. `settled` is true
   * when nothing on that venue-day can still fill (no `pending`, no `overdue`) — that is the
   * difference between a genuine terminal gap and a card simply still in progress, and without
   * it a day mid-fill outranks a real one. A venue-day is listed when complete + not_applicable
   * < races: an abandoned card has nothing to collect and is NOT a shortfall. A venue-day whose
   * only gap is `unsupported` is deliberately absent — it would be most of the list and it is
   * already counted above. Capped at 200 entries; `venues_incomplete_truncated` says when the
   * cap bit.
   */
  venues_incomplete: Record<string, unknown>[];
  venues_incomplete_truncated?: boolean;
  /** Prose: which codes are collected, from when, and what the never-collected codes are. */
  field_scope: string;
}

export interface RunPIR {
  /** Metres from the finish, e.g. 800. */
  at_m: number;
  position: number;
}

export interface RunPlacegetter {
  position: number;
  name: string;
  /** That horse's own stable ra: code — walkable straight back into this endpoint. */
  runner_ref?: string | null;
  weight_kg?: number | null;
}

export interface SourceBlock {
  feed?: string;
  region?: string;
  sport?: string;
  coverage_from: string;
  /** Meeting date of the latest run held, i.e. how far the last sync got. */
  coverage_to?: string | null;
  /** UTC timestamp of the last Topaz sync into this store. */
  synced_at?: string | null;
}

export interface SplitRecord {
  starts: number;
  wins: number;
  seconds: number;
  thirds: number;
}

export interface SportOddsEventOut {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string | null;
  away_team: string | null;
  competition?: string | null;
  bookmakers: Record<string, unknown>[];
  odds_format?: string | null;
  fetched_at?: string | null;
  data_age_seconds?: number | null;
  freshest_age_seconds?: number | null;
  stale?: boolean;
  stale_bookmakers?: string[];
  cached?: boolean | null;
  cache_age_seconds?: number | null;
  canonical_event_id?: string | null;
  data_quality?: Record<string, unknown> | null;
}

export interface SportOut {
  key: string;
  title: string;
  group: string | null;
  active: boolean;
  cached?: boolean | null;
  cache_age_seconds?: number | null;
  canonical_event_id?: string | null;
  data_quality?: Record<string, unknown> | null;
}

export interface SportsArbOut {
  event_id: string;
  sport_key: string;
  home_team: string | null;
  away_team: string | null;
  commence_time: string;
  is_arb: boolean;
  arb_pct: number;
  optimal_stakes: Record<string, unknown>[];
  max_overlay_pct: number;
  selections: Record<string, unknown>[];
}

export interface TrackConditionsOut {
  /** Meeting day, Australia/Sydney calendar date. */
  date: string;
  meetings: Record<string, unknown>[];
  note: string;
}

export interface TrainerRef {
  /** Topaz trainerId. Stable across meetings. */
  id?: number | null;
  name?: string | null;
}

export interface UsageOut {
  plan: string;
  account_email_masked?: string | null;
  credits_used: number;
  credits_limit: number;
  credits_remaining: number;
  reset_at: string | null;
  period_start?: string | null;
  next_reset_at?: string | null;
  burn_rate_per_day?: number;
  projected_month_end_credits?: number;
  projected_exhaustion_date?: string | null;
  warning?: string | null;
  upgrade?: Record<string, unknown> | null;
  all_time?: Record<string, unknown>;
  all_time_by_endpoint?: Record<string, unknown>[];
  usage_by_endpoint?: Record<string, unknown>[];
  recent_activity?: Record<string, unknown>[];
  usage_by_endpoint_period?: Record<string, unknown>[];
  recent_activity_period?: Record<string, unknown>[];
  plans?: Record<string, Record<string, unknown>>;
}

export interface VenueOut {
  venue_id: string;
  venue_canonical: string | null;
  venue_site: string | null;
  country: string | null;
  categories: string[];
  spellings: string[];
}

export interface WebhookCreate {
  /** HTTPS endpoint that receives the POST. Plain http:// is rejected with 422. */
  url: string;
  /**
   * Events to subscribe to. Two events have live producers: `arb.opportunity` (a cross-book arb
   * opened) and `race.odds_open` (the first bookmaker prices for a race just landed — fires once
   * per race, so you can fetch the card on push instead of schedule-polling). Since the
   * early-market lanes of 2026-09-01 it fires HOURS ahead, not minutes: measured over the 48h to
   * 2026-09-03 11:00 UTC, the first price landed a median 10.1h before the jump on AU
   * thoroughbreds, 5.3h on greyhounds, 6.8h on harness - typically overnight or early morning
   * for the day's card, from one or two early books; the full board fills inside about an hour
   * of the jump. `odds.change` is delivered solely by POST /v1/webhooks/{id}/test; `race.result`
   * and `market.suspend` are accepted but never fire.
   */
  events?: string[];
  /**
   * Only deliver arb.opportunity when the theoretical edge is at least this percentage. Omit for
   * every opportunity.
   */
  min_edge_pct?: number | null;
  /**
   * Only deliver events for these sports. Sport keys as returned by GET /v1/sports; racing
   * events (arbs and race.odds_open) arrive as racing_horse, racing_greyhound or racing_harness.
   * Omit for all sports.
   */
  sports?: string[] | null;
}

export interface WebhookDeliveryResponse {
  id: string;
  webhook_id: string;
  event_type: string;
  payload: unknown | null;
  /**
   * delivered (receiver answered 2xx) or failed (both attempts refused, see `error`). Rows
   * written before 2026-09-03 read `pending`.
   */
  status?: string;
  /** POST attempts made for this row, at most 2. */
  attempt_count?: number;
  status_code: number | null;
  error: string | null;
  delivered_at: string | null;
}

export interface WebhookResponse {
  id: string;
  url: string;
  events: string[];
  min_edge_pct?: number | null;
  sports?: string[] | null;
  is_active: boolean;
  created_at: string | null;
  last_delivery_at: string | null;
  failure_count: number;
  secret?: string | null;
  delivery_entitled?: boolean;
  delivery_paused_reason?: string | null;
}
