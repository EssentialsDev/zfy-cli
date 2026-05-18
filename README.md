# zfy

[![CI](https://github.com/EssentialsDev/zfy-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/EssentialsDev/zfy-cli/actions/workflows/ci.yml)
[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

A third-party CLI, TypeScript SDK, and **MCP server** for the [Zeffy API](https://www.zeffy.com/integration/api) — built so nonprofits can automate donation reporting and AI agents can answer questions like *"draft tax receipts for everyone who gave over $250 in 2025."*

> **Not affiliated with Zeffy or Simplyk.** Wraps the official free public read-only API (Payments, Contacts, Campaigns) released in 2025.

## What you can do with it

- Pull donations, donors, and campaigns out of Zeffy as JSON — pipe into `jq`, spreadsheets, or your own code.
- Generate **end-of-year donation reports** in JSON, CSV, Markdown, or one PDF receipt per donor.
- Plug Zeffy into Claude, Claude Desktop, or any MCP-aware agent so it can answer questions about your donation data conversationally.
- Build custom workflows in TypeScript using the same SDK that powers the CLI.

Read-only by design — `zfy` cannot modify your Zeffy data, because the official API is read-only.

## Contents

- [Install](#install)
- [Authenticate](#authenticate)
- [CLI usage](#cli-usage)
  - [Quickstart](#quickstart)
  - [End-of-year report](#end-of-year-report)
  - [Logo spec for `--logo`](#logo-spec-for---logo)
- [MCP server](#mcp-server-use-from-claude--agents)
- [SDK usage](#sdk-usage)
- [Development](#development)
- [License](#license)

## Install

```bash
npm i -g zfy-cli
# or run without installing:
npx zfy-cli --help
```

The package is `zfy-cli` on npm; the binary is `zfy` and the MCP entry point is `zfy-mcp`. Node.js 20+ required.

## Authenticate

1. In your Zeffy dashboard, go to **Settings → Integrations** and generate an API key.
2. Save it locally:

```bash
zfy auth set            # prompts for the key, stores it in ~/.config/zfy/config.json (mode 0600)
zfy auth status         # verifies the key by calling the Zeffy API
zfy auth clear          # removes the stored key
```

Or pass it inline for CI / one-offs:

```bash
ZEFFY_API_KEY=sk_xxx zfy payments list --from 2025-01-01
```

The `ZEFFY_API_KEY` env var always takes precedence over the stored key.

## CLI usage

Every command outputs JSON to stdout — pipe it into `jq`, an LLM, a spreadsheet, or further commands.

### Quickstart

```bash
# Donations in a date range
zfy payments list --from 2025-01-01 --to 2025-12-31

# Total raised in Q4 2025
zfy payments list --from 2025-10-01 --to 2025-12-31 | jq '[.[].amount] | add'

# All gifts to a specific campaign
zfy payments list --campaign cmp_abc --status succeeded

# Donor lookup by email
zfy contacts list --email donor@example.com

# Campaigns
zfy campaigns list
```

### End-of-year report

Generate a per-donor annual report in any format. Defaults: excludes refunded payments, uses your system timezone for year boundaries.

```bash
# JSON to stdout (default — best for piping to agents)
zfy report eoy --year 2025

# Spreadsheet-friendly CSV
zfy report eoy --year 2025 --format csv --out eoy-2025.csv

# Top-50 donor markdown summary (fits in an LLM context)
zfy report eoy --year 2025 --format md --out eoy-2025.md --top 50

# One PDF receipt per donor
zfy report eoy --year 2025 --format pdf --out ./receipts/ \
               --org "Friends of the Library" \
               --logo ./logo.png --logo-size 64 \
               --timezone America/Los_Angeles
```

Useful flags (`zfy report eoy --help` for the full list):

| Flag | Notes |
| --- | --- |
| `--year <year>` | Required. Calendar year. |
| `--format <fmt>` | `json` \| `csv` \| `md` \| `pdf`. Default `json`. |
| `--out <path>` | Output file (or directory for PDF). Defaults to stdout. |
| `--timezone <tz>` | IANA timezone (e.g. `America/Los_Angeles`). Boundaries respect DST. |
| `--currency <code>` | Filter to a single currency. |
| `--include-refunded` | Include refunded payments (excluded by default). |
| `--top <n>` | Markdown: limit donor table. |
| `--org <name>` | PDF: organization name in the header. |
| `--logo <path>` | PDF: square PNG/JPEG mark — see spec below. |
| `--logo-size <pt>` | PDF: edge length of the logo slot (default 64 pt). |
| `--receipt-text <txt>` | PDF: override the default tax-receipt boilerplate. |

### Logo spec for `--logo`

The PDF renderer reserves a small square slot for an org mark. To keep batches consistent and prevent multi-gigabyte receipt runs, logos must meet:

| Constraint | Limit |
| --- | --- |
| Format | PNG or JPEG (sniffed from file bytes — extension is ignored) |
| File size | ≤ 2 MB |
| Minimum dimensions | 64 × 64 px |
| Shape | Square within ±10% (e.g. 512×512, or 500×510 — but not 800×200) |

Recommended: a 512×512 PNG with a transparent or white background. If the file fails any check, `zfy` prints a single warning to stderr and continues without the logo — a bad asset never blocks a 500-donor receipt run.

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
| `zeffy_list_payments` | List donations with date / status / campaign / contact filters |
| `zeffy_list_contacts` | List donors (lookup by email or date range) |
| `zeffy_list_campaigns` | List campaigns |
| `zeffy_eoy_report` | Per-donor annual summary (JSON or Markdown) |

After installing and configuring, ask your agent things like:

- "How much did we raise in Q4 2025?"
- "Who were our top 10 donors last year, and what did each give?"
- "Generate an EOY summary I can paste into our board report."

PDF and CSV output aren't exposed via MCP (binary data is awkward over stdio) — use the CLI for those.

## SDK usage

Everything the CLI does is available as a typed library, including the EOY aggregation and the format renderers.

```ts
import { Zeffy } from "zfy-cli";

const zeffy = new Zeffy(process.env.ZEFFY_API_KEY!);

// Single page (cursor-paginated under the hood)
const page = await zeffy.payments.list({ created_gte: 1735689600 });

// Auto-paginate across the whole range
for await (const p of zeffy.payments.iterate({ created_gte: 1735689600 })) {
  console.log(p.id, p.amount, p.contact?.email);
}

// Build and render an EOY report yourself
import { buildEoyReport, formatMarkdown, writePdfReceipts } from "zfy-cli";

const report = await buildEoyReport(zeffy, {
  year: 2025,
  timezone: "America/Los_Angeles",
});

console.log(formatMarkdown(report, 25));
await writePdfReceipts(report, "./receipts", { orgName: "Friends of the Library" });
```

The client handles 429 rate-limit responses (token-bucket capped at 90 req/min, with `Retry-After` honored on backoff) and validates every response against [zod](https://zod.dev) schemas — bad shapes throw with the raw response attached for debugging.

## Development

```bash
pnpm install
pnpm build         # tsup → dist/
pnpm test          # vitest
pnpm typecheck     # tsc --noEmit
```

CI runs `typecheck`, `test`, and `build` on every push and PR against Node 20 and 22.

## License

MIT — see [LICENSE](./LICENSE). Not affiliated with Zeffy or Simplyk.

Found a bug or want to contribute? [Open an issue or PR](https://github.com/EssentialsDev/zfy-cli/issues).
