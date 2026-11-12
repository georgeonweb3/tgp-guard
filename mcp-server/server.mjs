// server.mjs — tgp-guard MCP server (stdio transport).
//
// Run:  node --env-file=<path to .env> server.mjs
// or:   EVM_PRIVATE_KEY=0x... node server.mjs
// Stdio only: MCP clients (Claude Desktop, etc.) spawn this process and
// speak JSON-RPC over stdin/stdout. Never log to stdout — stdout is the
// protocol channel; diagnostics go to stderr.
//
// Every tool call spends real test USDC ($0.01 per paid miner answer) from
// the burner wallet in EVM_PRIVATE_KEY. The per-payment cap ($0.01) is
// enforced by setSpendControls before payment; failed calls are not charged.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { createPay, priceCheck, sanctionsScreen, linkScan, fullPreflight } from "./checks.mjs";

const server = new McpServer({ name: "tgp-guard", version: "1.0.0" });

function toolResult(data) {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

function toolError(message) {
  return { content: [{ type: "text", text: JSON.stringify({ error: message }, null, 2) }], isError: true };
}

server.tool("price_check",
  "Check a crypto price against 3 independent Telegraph miners (TxLens, CoinGecko, Kraken). Returns ALLOW/HOLD/BLOCK: spread >0.5% HOLD, >2% BLOCK; a quote >1% off the median BLOCKs. Costs 3 x $0.01 test USDC on Sepolia.",
  { asset: z.enum(["bitcoin", "ethereum", "solana"]).describe("Asset id: bitcoin, ethereum or solana"),
    quote: z.number().optional().describe("Optional quoted price to check against the median") },
  async ({ asset, quote }) => {
    try { return toolResult(await priceCheck(createPay(), { asset, quote: quote ?? null })); }
    catch (e) { return toolError(e.message); }
  });

server.tool("sanctions_screen",
  "Screen a name against sanctions lists via 3 Telegraph miners (OFAC SDN, UN Consolidated, Counterproof US/UN/EU/UK second opinion). Any OFAC/UN hit BLOCKs; a Counterproof-only hit/REVIEW HOLDs for human review. Costs 3 x $0.01 test USDC on Sepolia. Exact-name screening, not full KYC.",
  { entity: z.string().min(1).describe("Name to screen, e.g. \"Acme Bakery\"") },
  async ({ entity }) => {
    try { return toolResult(await sanctionsScreen(createPay(), { entity })); }
    catch (e) { return toolError(e.message); }
  });

server.tool("link_scan",
  "Scan a URL with 3 independent Telegraph miners (URL Sentinel, NetWire, PREFLIGHT Infrastructure Signals). 2+ flags BLOCK, 1 flag or an unassessable source HOLDs. Costs 3 x $0.01 test USDC on Sepolia. Do not scan private URLs — they go to third-party miners.",
  { url: z.string().url().describe("URL to scan, e.g. https://github.com") },
  async ({ url }) => {
    try { return toolResult(await linkScan(createPay(), { url })); }
    catch (e) { return toolError(e.message); }
  });

server.tool("full_preflight",
  "Run price + sanctions + link checks in one call and return the worst verdict (BLOCK > HOLD > ALLOW) with every per-check result and receipt. At least one of asset, counterparty, url is required. Costs $0.01 per paid miner answer (up to 9 x $0.01 = $0.09) on Sepolia.",
  { asset: z.enum(["bitcoin", "ethereum", "solana"]).optional().describe("Asset id for the price leg"),
    quote: z.number().optional().describe("Optional quoted price for the price leg"),
    counterparty: z.string().optional().describe("Counterparty name for the sanctions leg"),
    url: z.string().url().optional().describe("URL for the link leg") },
  async ({ asset, quote, counterparty, url }) => {
    try {
      return toolResult(await fullPreflight(createPay(), { asset: asset ?? null, quote: quote ?? null, counterparty: counterparty ?? null, url: url ?? null }));
    } catch (e) { return toolError(e.message); }
  });

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("tgp-guard MCP server running on stdio");
