import { x402Client, wrapFetchWithPayment } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";
import { appendFileSync } from "node:fs";

const N = "https://devnode.telegraphprotocol.com";
const ALLOW_PCT = 0.5, BLOCK_PCT = 2, OFFMARKET_PCT = 1, MAX_SPEND_USD = 0.05;
const args = process.argv.slice(2);
const asset = args[0] || "bitcoin";
const quoted = args[1] && !args[1].startsWith("--") ? parseFloat(args[1]) : null;
const down = args.includes("--down");
const QUORUM = args.includes("--quorum2") ? 2 : 3;
const KRAKEN = { bitcoin: "XBTUSD", ethereum: "ETHUSD", solana: "SOLUSD" };
if (!KRAKEN[asset]) { console.error("asset must be: " + Object.keys(KRAKEN).join(", ")); process.exit(1); }

const client = new x402Client();
registerExactEvmScheme(client, { signer: privateKeyToAccount(process.env.EVM_PRIVATE_KEY) });
const pay = wrapFetchWithPayment(fetch, client);

const voters = [
  { name: "TxLens", id: "9002", endpoint: "/crypto-price", payload: { coin_id: asset }, parse: r => r.price_usd },
  { name: "CoinGecko", id: "21002", endpoint: "/query", payload: { ids: asset, vs_currencies: "usd" }, parse: r => r[asset]?.usd },
  { name: "Kraken", id: down ? "999999999" : "190076", endpoint: "/query", payload: { pair: KRAKEN[asset] },
    parse: r => { const p = Object.values(r.result || {})[0]; return p && parseFloat(p.c[0]); } },
];

async function ask(v) {
  try {
    const res = await pay(`${N}/engine/v1/ask/${v.id}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method: "GET", endpoint: v.endpoint, payload: v.payload }),
    });
    const rc = res.headers.get("x-telegraph-receipt");
    const receipt = rc ? JSON.parse(Buffer.from(rc, "base64").toString()) : null;
    const body = await res.json().catch(() => null);
    if (res.status !== 200 || !body) return { name: v.name, ok: false, error: `HTTP ${res.status} ${JSON.stringify(body)?.slice(0, 120)}` };
    const price = Number(v.parse(body.result));
    if (!Number.isFinite(price) || price <= 0) return { name: v.name, ok: false, error: "unparseable answer" };
    return { name: v.name, ok: true, price, cost: body.cost_usd, receipt: receipt?.receipt_hash, signal: body.signal_hash };
  } catch (e) { return { name: v.name, ok: false, error: String(e.message).slice(0, 120) }; }
}

const results = await Promise.all(voters.map(ask));
const good = results.filter(r => r.ok);
const ps = good.map(r => r.price).sort((a, b) => a - b);
const med = ps.length ? (ps.length % 2 ? ps[(ps.length - 1) / 2] : (ps[ps.length / 2 - 1] + ps[ps.length / 2]) / 2) : null;
const spread = ps.length >= 2 ? ((ps.at(-1) - ps[0]) / med) * 100 : null;
let verdict, reason;
if (good.length < QUORUM) { verdict = "HOLD"; reason = `only ${good.length}/3 sources answered - no quorum`; }
else if (spread > BLOCK_PCT) { verdict = "BLOCK"; reason = `sources disagree by ${spread.toFixed(2)}%`; }
else if (spread > ALLOW_PCT) { verdict = "HOLD"; reason = `sources disagree by ${spread.toFixed(2)}%`; }
else { verdict = "ALLOW"; reason = `${good.length}/3 sources agree within ${spread.toFixed(2)}%`; }
if (med && good.length < 3 && verdict === "ALLOW") reason += " (degraded: a source failed, not charged)";
let dev = null;
if (quoted && med) {
  dev = (Math.abs(quoted - med) / med) * 100;
  if (dev > OFFMARKET_PCT) { verdict = "BLOCK"; reason = `quoted ${quoted} is ${dev.toFixed(2)}% off the median ${med.toFixed(2)}`; }
}
const total = good.reduce((s, r) => s + (r.cost || 0), 0);
console.log(`\n${asset.toUpperCase()}  =>  ${verdict}\n${reason}`);
console.log(`median ${med?.toFixed(2)}  spread ${spread?.toFixed(3)}%  spent $${total.toFixed(2)}${total > MAX_SPEND_USD ? "  !! OVER BUDGET" : ""}\n`);
for (const r of results) console.log(r.ok ? `${r.name.padEnd(10)} ${String(r.price).padEnd(12)} receipt ${r.receipt}` : `${r.name.padEnd(10)} FAILED  ${r.error}`);
appendFileSync("evidence/guard-log.jsonl", JSON.stringify({ ts: new Date().toISOString(), asset, quoted, verdict, reason, median: med, spread, dev, total, results }) + "\n");
