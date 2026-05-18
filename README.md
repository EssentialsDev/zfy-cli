# zfy

Open-source, third-party CLI, TypeScript SDK, and **MCP server** for the [Zeffy API](https://www.zeffy.com/integration/api) — built so nonprofits can automate donation reporting and AI agents can answer questions like *"draft tax receipts for everyone who gave over $250 in 2025."*

> Not affiliated with Zeffy. Uses the official free public read-only API (Payments, Contacts, Campaigns) introduced in 2025.

## Install

```bash
npm i -g zfy-cli
# or run without installing:
npx zfy-cli --help
```

The package is `zfy-cli` on npm; the binary is `zfy`.

Node.js 20+ required.

## Authenticate

1. In your Zeffy dashboard, go to **Settings → Integrations** and generate an API key.
2. Save it locally:

```bash
zfy auth set            # prompts for the key, stores it in ~/.config/zfy/config.json (mode 0600)
zfy auth status         # verifies the key by calling the Zeffy API
```

Or pass it inline for CI / one-offs:

```bash
ZEFFY_API_KEY=sk_xxx zfy payments list --from 2025-01-01
```

The `ZEFFY_API_KEY` env var always takes precedence over the stored key.

## CLI usage

Every command outputs JSON to stdout (pipeable into `jq`, `claude`, etc.) unless you ask for another format.

```bash
# Donations
zfy payments list --from 2025-01-01 --to 2025-12-31
zfy payments list --campaign cmp_abc --status succeeded | jq '[.[].amount] | add'

# Donors
zfy contacts list --email donor@example.com

# Campaigns
zfy campaigns list

# End-of-year report — JSON, CSV, Markdown, or one PDF receipt per donor
zfy report eoy --year 2025                                          # JSON to stdout
zfy report eoy --year 2025 --format csv --out eoy-2025.csv
zfy report eoy --year 2025 --format md   --out eoy-2025.md --top 50
zfy report eoy --year 2025 --format pdf  --out ./receipts/ \
               --org "Friends of the Library" --timezone America/Los_Angeles
```

The EOY report aggregates payments per donor for a single calendar year. By default it excludes refunded payments and uses your system timezone for year boundaries — override with `--timezone`.

## MCP server (use from Claude / agents)

`zfy-mcp` exposes the same operations as MCP tools over stdio. Add to `~/.claude.json` (or Claude Desktop's `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "zeffy": {
      "command": "zfy-mcp",
      "env": { "ZEFFY_API_KEY": "sk_xxx" }
    }
  }
}
```

Tools exposed:

| Tool | Description |
| --- | --- |
| `zeffy_list_payments` | List donations with date/status/campaign filters |
| `zeffy_list_contacts` | List donors (lookup by email or date range) |
| `zeffy_list_campaigns` | List campaigns |
| `zeffy_eoy_report` | Per-donor annual summary (JSON or Markdown) |

After installing and configuring, ask your agent things like:

- "How much did we raise in Q4 2025?"
- "Who were our top 10 donors last year, and what did each give?"
- "Generate an EOY summary I can paste into our board report."

## SDK usage

```ts
import { Zeffy } from "zfy-cli";

const zeffy = new Zeffy(process.env.ZEFFY_API_KEY!);

// Single page (cursor-paginated)
const page = await zeffy.payments.list({ created_gte: 1735689600 });

// Auto-paginate everything in a range
for await (const p of zeffy.payments.iterate({ created_gte: 1735689600 })) {
  console.log(p.id, p.amount, p.contact?.email);
}

// Build EOY report from your own code
import { buildEoyReport, formatMarkdown } from "zfy-cli";
const report = await buildEoyReport(zeffy, { year: 2025, timezone: "America/Los_Angeles" });
console.log(formatMarkdown(report, 25));
```

The client handles 429 rate-limit responses (token bucket capped at 90/min, with `Retry-After` respected on backoff) and validates responses with [zod](https://zod.dev).

## Development

```bash
pnpm install
pnpm build         # tsup → dist/
pnpm test          # vitest
pnpm typecheck
```

## License

MIT. Not affiliated with Zeffy or Simplyk.
