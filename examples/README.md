# Examples

Each file is standalone. Run with [tsx](https://tsx.is) (`npx tsx examples/<file>.ts`) or compile
with your own toolchain.

| File | What it does | Endpoint | Credits | Key needed? |
|---|---|---|---|---|
| [best-price-board.ts](best-price-board.ts) | Best price per runner in the next races, as a table | `racing.bestOdds` | 3 | falls back to the sandbox |
| [live-board-polling.ts](live-board-polling.ts) | A live board built on the change feed, not a `nextToGo` loop | `racing.changes` | 2 per poll | yes |
| [webhook-receiver.ts](webhook-receiver.ts) | Verifies `X-Webhook-Signature` against the raw body, acks first | — | 0 to receive | the webhook secret |

More, including Python, n8n workflows and a Google Sheets connector:
<https://github.com/Propertyscout001/puntersedge-examples>
