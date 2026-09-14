/**
 * A live board, polled the cheap way.
 *
 *   PUNTERSEDGE_API_KEY=... npx tsx examples/live-board-polling.ts
 *
 * The point of this example is what it does NOT do: it does not loop `racing.nextToGo`.
 *
 * `nextToGo` re-downloads every race on every poll and bills 2 credits each time. At a 15-second
 * cadence that is 5,760 calls and 11,520 credits a day — nearly eight times the free monthly
 * allowance, spent in 24 hours, to learn mostly that nothing changed.
 *
 * `racing.changes` returns only what moved since a timestamp and hands back the cursor for the
 * next call. Same 2 credits, but the payload collapses to the actual movement.
 *
 * Endpoint: GET /v1/racing/changes (2 credits per poll)
 */
import { PuntersEdge, RateLimitError, ServerError } from "puntersedge";

const pe = new PuntersEdge({ apiKey: process.env.PUNTERSEDGE_API_KEY });

const POLL_MS = 15_000;

/** Latest price per runner, keyed race_id -> runner -> {price, book}. */
const board = new Map<string, Map<string, { price: number; book: string }>>();

// Start one minute back so the first poll has something to show.
let since = new Date(Date.now() - 60_000).toISOString();

async function poll() {
  let batch;
  try {
    batch = await pe.racing.changes({ since, categories: ["horse", "greyhound"] });
  } catch (err) {
    if (err instanceof RateLimitError) {
      console.warn(`rate limited; waiting ${err.retryAfter ?? 60}s`);
      return;                                  // keep `since` where it is and try again
    }
    if (err instanceof ServerError) {
      console.warn(`server error ${err.status}; will retry on the next tick`);
      return;
    }
    throw err;                                 // an auth or credit problem should stop the loop
  }

  for (const race of batch.races ?? []) {
    // At-least-once: `server_time` is set 30s back so no in-flight write is skipped, which means
    // you WILL see the same race twice. Everything here is an idempotent overwrite.
    const runners = board.get(race.race_id) ?? new Map();
    board.set(race.race_id, runners);

    // NOTE the shape. `changed_runners` is FLAT — one row per runner PER BOOKMAKER, carrying
    // `bookmaker_key` on the row. It is not the nested `runners[].bookmakers[]` that
    // `nextToGo` returns, because a change feed only sends the quotes that actually moved.
    // Regroup by runner to find the new best price.
    const byRunner = new Map<string, { price: number; book: string }>();
    for (const row of race.changed_runners ?? []) {
      if (!row.win_price) continue;
      const current = byRunner.get(row.name);
      if (!current || row.win_price > current.price) {
        byRunner.set(row.name, { price: row.win_price, book: row.bookmaker_key });
      }
    }

    for (const [name, top] of byRunner) {
      const previous = runners.get(name);
      runners.set(name, top);

      if (previous && previous.price !== top.price) {
        const move = ((top.price / previous.price - 1) * 100).toFixed(1);
        const label = top.price > previous.price ? "drift" : "firm ";
        console.log(
          `${label} ${race.venue} R${race.race_number} ${name}: ` +
          `${previous.price.toFixed(2)} → ${top.price.toFixed(2)} (${move}%) @ ${top.book}`,
        );
      }
    }
  }

  since = batch.server_time;

  if (pe.credits?.warning) {
    console.warn(`${pe.credits.remaining} credits left — ${pe.credits.upgrade?.url ?? ""}`);
  }
}

console.log("polling /v1/racing/changes every 15s — ctrl-c to stop\n");
await poll();
setInterval(() => void poll().catch((err) => { console.error(err); process.exit(1); }), POLL_MS);
