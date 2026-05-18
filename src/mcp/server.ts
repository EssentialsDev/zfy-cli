import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { Zeffy } from "../sdk/index.js";
import { buildEoyReport } from "../report/eoy.js";
import { formatMarkdown } from "../report/formats/md.js";
import { resolveApiKey } from "../cli/config.js";

const DEFAULT_MAX = 1000;

async function getClient(): Promise<Zeffy> {
  const key = await resolveApiKey();
  if (!key) {
    throw new Error(
      "Zeffy API key not configured. Set ZEFFY_API_KEY in the MCP server env, or run `zfy auth set` on this machine.",
    );
  }
  return new Zeffy({ apiKey: key });
}

function dateToUnix(d: string | undefined): number | undefined {
  if (!d) return undefined;
  const ms = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(d) ? `${d}T00:00:00Z` : d);
  if (Number.isNaN(ms)) throw new Error(`Invalid date: ${d}`);
  return Math.floor(ms / 1000);
}

function asText(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] };
}

const server = new McpServer({ name: "zfy", version: "0.1.0" });

server.registerTool(
  "zeffy_list_payments",
  {
    description:
      "List Zeffy donations (payments). Cursor pagination is handled automatically — use `limit` to cap result size.",
    inputSchema: {
      from: z.string().optional().describe("Earliest date (YYYY-MM-DD or ISO datetime)"),
      to: z.string().optional().describe("Latest date (YYYY-MM-DD or ISO datetime)"),
      status: z.string().optional(),
      currency: z.string().optional(),
      type: z.string().optional(),
      campaign_id: z.string().optional(),
      contact_id: z.string().optional(),
      limit: z.number().int().positive().max(5000).default(DEFAULT_MAX),
    },
  },
  async (args) => {
    const zeffy = await getClient();
    const data = await zeffy.payments.collect(
      {
        created_gte: dateToUnix(args.from),
        created_lte: dateToUnix(args.to),
        status: args.status,
        currency: args.currency,
        type: args.type,
        campaign_id: args.campaign_id,
        contact_id: args.contact_id,
      },
      args.limit,
    );
    return asText(data);
  },
);

server.registerTool(
  "zeffy_list_contacts",
  {
    description: "List Zeffy contacts (donors). Use `email` to look up a single donor.",
    inputSchema: {
      email: z.string().optional(),
      created_from: z.string().optional(),
      created_to: z.string().optional(),
      updated_from: z.string().optional(),
      updated_to: z.string().optional(),
      limit: z.number().int().positive().max(5000).default(DEFAULT_MAX),
    },
  },
  async (args) => {
    const zeffy = await getClient();
    const data = await zeffy.contacts.collect(
      {
        email: args.email,
        created_gte: dateToUnix(args.created_from),
        created_lte: dateToUnix(args.created_to),
        updated_gte: dateToUnix(args.updated_from),
        updated_lte: dateToUnix(args.updated_to),
      },
      args.limit,
    );
    return asText(data);
  },
);

server.registerTool(
  "zeffy_list_campaigns",
  {
    description: "List Zeffy campaigns (donation forms, events, etc.).",
    inputSchema: {
      created_from: z.string().optional(),
      created_to: z.string().optional(),
      limit: z.number().int().positive().max(5000).default(DEFAULT_MAX),
    },
  },
  async (args) => {
    const zeffy = await getClient();
    const data = await zeffy.campaigns.collect(
      {
        created_gte: dateToUnix(args.created_from),
        created_lte: dateToUnix(args.created_to),
      },
      args.limit,
    );
    return asText(data);
  },
);

server.registerTool(
  "zeffy_eoy_report",
  {
    description:
      "Generate an end-of-year donation report aggregated per donor. Returns JSON, or a Markdown summary if format='markdown'.",
    inputSchema: {
      year: z.number().int().min(1900).max(9999),
      format: z.enum(["json", "markdown"]).default("json"),
      timezone: z.string().optional().describe("IANA timezone (default: UTC)"),
      currency: z.string().optional(),
      status: z.string().optional(),
      include_refunded: z.boolean().default(false),
      top: z.number().int().positive().max(500).default(25),
    },
  },
  async (args) => {
    const zeffy = await getClient();
    const report = await buildEoyReport(zeffy, {
      year: args.year,
      timezone: args.timezone ?? "UTC",
      currency: args.currency,
      status: args.status,
      excludeRefunded: !args.include_refunded,
    });
    const text =
      args.format === "markdown" ? formatMarkdown(report, args.top) : JSON.stringify(report, null, 2);
    return { content: [{ type: "text" as const, text }] };
  },
);

const transport = new StdioServerTransport();
server.connect(transport).catch((err) => {
  console.error(`zfy-mcp failed to start: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
