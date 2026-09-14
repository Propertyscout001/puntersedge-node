/**
 * The best available price per runner in the next few races, as a table.
 *
 *   npx tsx examples/best-price-board.ts
 *   npx tsx examples/best-price-board.ts --categories greyhound --races 3
 *
 * Runs with no key at all against the sandbox — it just shows fewer races and fewer books.
 *
 * Endpoint: GET /v1/racing/best-odds (3 credits), or the free sandbox when no key is set.
 */
import { PuntersEdge } from "puntersedge";

const args = process.argv.slice(2);
const flag = (name: string, fallback?: string) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
};

const apiKey = process.env.PUNTERSEDGE_API_KEY;
const pe = new PuntersEdge({ apiKey });
const categories = flag("categories");
const numRaces = Number(flag("races", "3"));

if (!apiKey) {
  console.log("No PUNTERSEDGE_API_KEY set — using the free sandbox.\n");
}

const races = apiKey
  ? await pe.racing.bestOdds({ numRaces, categories })
  : (await pe.demo.nextToGo()).races as any[];

for (const race of races.slice(0, numRaces)) {
  const when = new Date(race.start_time).toLocaleTimeString("en-AU", {
    timeZone: "Australia/Sydney", hour: "2-digit", minute: "2-digit",
  });
  console.log(`\n${race.venue} R${race.race_number}  ${when} AEST  (${race.category})`);
  console.log("─".repeat(58));

  for (const runner of race.runners ?? []) {
    // The keyed endpoint pre-computes best_win; the sandbox returns raw quotes, so derive it.
    const best = runner.best_win ?? bestOf(runner.bookmakers ?? []);
    if (!best?.price) continue;
    const books = runner.books_quoting_win ?? (runner.bookmakers ?? []).filter((b: any) => b.win_price).length;
    console.log(
      `${String(runner.number ?? "").padStart(3)}  ${String(runner.name).padEnd(26)}` +
      `${String(best.price.toFixed(2)).padStart(7)}  ${String(best.bookmaker).padEnd(14)} ${books} books`,
    );
  }

  // Under 100 means the best prices across books beat the field — a cross-book arb.
  if (race.market_percentage != null) {
    console.log(`overround: ${race.market_percentage.toFixed(1)}%`);
  }
}

if (pe.credits) {
  console.log(`\n${pe.credits.cost} credits used, ${pe.credits.remaining} remaining`);
}

function bestOf(quotes: any[]) {
  const priced = quotes.filter((q) => q.win_price);
  if (!priced.length) return null;
  const top = priced.reduce((a, b) => (b.win_price > a.win_price ? b : a));
  return { price: top.win_price, bookmaker: top.key };
}
