// smoke-test.mjs — real MCP client smoke test for the tgp-guard server.
//
// Spawns server.mjs over stdio (the same way Claude Desktop would), lists
// tools, then calls each tool once LIVE against the Telegraph devnode with
// the burner wallet. Prints each tool's full JSON result to stdout.
// Usage: node --env-file=<path to .env> smoke-test.mjs
// (or EVM_PRIVATE_KEY=0x... node smoke-test.mjs)
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const transport = new StdioClientTransport({
  command: process.execPath,
  args: ["server.mjs"],
  env: { ...process.env },
  stderr: "pipe",
});
const client = new Client({ name: "tgp-guard-smoke", version: "1.0.0" }, { capabilities: {} });
await client.connect(transport);

const tools = await client.listTools();
console.log("TOOLS:", tools.tools.map((t) => t.name).join(", "));

async function call(name, args) {
  console.log(`\n===== ${name} ${JSON.stringify(args)} =====`);
  const res = await client.callTool({ name, arguments: args });
  const text = res.content.map((c) => c.text).join("\n");
  console.log(text);
  return JSON.parse(text);
}

// Live calls. Each tool costs 3 x $0.01 test USDC; full_preflight here runs
// the price leg only (3 more), so the whole smoke test is 12 paid answers.
const price = await call("price_check", { asset: "bitcoin" });
const sanctions = await call("sanctions_screen", { entity: "Acme Bakery" });
const link = await call("link_scan", { url: "https://github.com" });
const full = await call("full_preflight", { asset: "bitcoin" });

const all = [price, sanctions, link, full];
const paid = all.reduce((s, r) => s + (r.paid_answers ?? 0), 0);
console.log(`\n===== SUMMARY =====`);
console.log(`verdicts: price=${price.verdict} sanctions=${sanctions.verdict} link=${link.verdict} full_preflight=${full.verdict}`);
console.log(`total paid answers: ${paid} (~$${(paid * 0.01).toFixed(2)} test USDC)`);
await client.close();
