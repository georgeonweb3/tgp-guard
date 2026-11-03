import { x402Client, wrapFetchWithPayment } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";
import { appendFileSync } from "node:fs";
const N = "https://devnode.telegraphprotocol.com";
const args = process.argv.slice(2);
const down = args.includes("--down");
const ci = args.indexOf("--chain");
const chainName = (ci >= 0 ? args[ci + 1] : "ethereum").toLowerCase();
const CHAINS = { ethereum: "1", bsc: "56", base: "8453", arbitrum: "42161", polygon: "137", optimism: "10", sepolia: "11155111" };
const chainId = CHAINS[chainName] || (/^\d+$/.test(chainName) ? chainName : null);
const address = args.find(a => /^0x[0-9a-fA-F]{40}$/.test(a));
if (!address || !chainId) { console.error('usage: audit.mjs 0xADDRESS [--chain ethereum|bsc|base|arbitrum|polygon|optimism|sepolia] [--down]'); process.exit(1); }
const client = new x402Client();
client.setSpendControls({ allowedAssets: [{ network: "eip155:11155111", asset: "0xcc194e1a843B658526D0D5C431f670028582Ae17", maxAmountPerPayment: "10000" }] });
registerExactEvmScheme(client, { signer: privateKeyToAccount(process.env.EVM_PRIVATE_KEY) });
const pay = wrapFetchWithPayment(fetch, client);
// Flags that mean "do not touch this contract" on their own (GoPlus values are "0"/"1" strings).
const CRITICAL = [
  ["is_honeypot", "honeypot"],
  ["cannot_buy", "cannot be bought (honeypot pattern)"],
  ["selfdestruct", "selfdestruct present"],
  ["hidden_owner", "hidden owner"],
  ["can_take_back_ownership", "ownership can be taken back"],
  ["honeypot_with_same_creator", "same creator deployed a honeypot"],
];
// Owner controls that are common on legitimate tokens (USDT has several): reported, never blocking alone.
const NOTES = [
  ["is_mintable", "mintable"], ["is_proxy", "proxy"], ["transfer_pausable", "transfer pausable"],
  ["is_blacklisted", "blacklist function"], ["slippage_modifiable", "slippage modifiable by owner"],
  ["is_anti_whale", "anti-whale limits"], ["trading_cooldown", "trading cooldown"],
];
const MAX_TAX = 0.10; // buy/sell tax above 10% is a critical finding
async function askGoPlus() {
  try {
    const res = await pay(`${N}/engine/v1/ask/200001`, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method: "GET", endpoint: "/token-security", payload: { chain_id: chainId, contract_addresses: address } }) });
    const rc = res.headers.get("x-telegraph-receipt");
    const receipt = rc ? JSON.parse(Buffer.from(rc, "base64").toString()).receipt_hash : null;
    const body = await res.json().catch(() => null);
    if (res.status !== 200 || !body?.result) return { name: "GoPlus", ok: false, error: `HTTP ${res.status} ${JSON.stringify(body)?.slice(0, 100)}` };
    const d = body.result.result?.[address.toLowerCase()];
    if (!d) return { name: "GoPlus", ok: false, error: "no risk data for this address on this chain" };
    const critical = [], notes = [];
    for (const [k, label] of CRITICAL) if (String(d[k]) === "1") critical.push(label);
    const bt = parseFloat(d.buy_tax), st = parseFloat(d.sell_tax);
    if (Number.isFinite(bt) && bt > MAX_TAX) critical.push(`buy tax ${(bt * 100).toFixed(0)}%`);
    if (Number.isFinite(st) && st > MAX_TAX) critical.push(`sell tax ${(st * 100).toFixed(0)}%`);
    if (String(d.is_open_source) === "0") critical.push("source code not open/verified (GoPlus)");
    for (const [k, label] of NOTES) if (String(d[k]) === "1") notes.push(label);
    return { name: "GoPlus", ok: true, critical, notes, receipt, signal: body.signal_hash,
      detail: `${d.token_name || "unknown token"} (${d.token_symbol || "?"}) holders=${d.holder_count ?? "?"} open_source=${d.is_open_source} honeypot=${d.is_honeypot} buy_tax=${d.buy_tax} sell_tax=${d.sell_tax}` };
  } catch (e) { return { name: "GoPlus", ok: false, error: String(e.message).slice(0, 100) }; }
}
async function askSourcify() {
  const id = down ? "999999999" : "200002";
  try {
    const res = await pay(`${N}/engine/v1/ask/${id}`, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method: "GET", endpoint: "/contract", payload: { chain_id: chainId, address } }) });
    const rc = res.headers.get("x-telegraph-receipt");
    const receipt = rc ? JSON.parse(Buffer.from(rc, "base64").toString()).receipt_hash : null;
    const text = await res.text();
    let body = null; try { body = JSON.parse(text); } catch {}
    if (res.status === 200 && body?.result) {
      return { name: "Sourcify", ok: true, verified: body.result.match === "match", receipt, signal: body.signal_hash,
        detail: `match=${body.result.match} runtime=${body.result.runtimeMatch} creation=${body.result.creationMatch}` };
    }
    // Sourcify has no record of this contract: the miner surfaces it as an upstream 404. That is an
    // answer (not verified), not a failure, and it is not billed.
    if (/404/.test(text) && /match/.test(text)) return { name: "Sourcify", ok: true, verified: false, receipt, detail: "no verified source on file (upstream 404)" };
    return { name: "Sourcify", ok: false, error: `HTTP ${res.status} ${text.slice(0, 100)}` };
  } catch (e) { return { name: "Sourcify", ok: false, error: String(e.message).slice(0, 100) }; }
}
const [g, s] = await Promise.all([askGoPlus(), askSourcify()]);
let verdict, reason;
if (g.ok && g.critical.length) { verdict = "BLOCK"; reason = `critical risk flags from GoPlus: ${g.critical.join("; ")}`; }
else if (g.ok && s.ok && s.verified) {
  verdict = "ALLOW";
  reason = `no critical risk flags from GoPlus and source verified on Sourcify${g.notes.length ? ` (owner controls present: ${g.notes.join(", ")} — common on established tokens, not blocking)` : ""}`;
} else {
  verdict = "HOLD";
  const gaps = [];
  if (!g.ok) gaps.push(`GoPlus could not assess (${g.error})`);
  if (!s.ok) gaps.push(`Sourcify unavailable (${s.error})`);
  if (s.ok && !s.verified) gaps.push("source not verified on Sourcify");
  reason = gaps.join("; ") + ", cannot clear";
}
console.log(`\n${address} on ${chainName} (chain ${chainId})  =>  ${verdict}\n${reason}\n`);
for (const r of [g, s]) console.log(r.ok ? `${r.name.padEnd(16)} ${r.detail}${r.receipt ? "  receipt " + r.receipt : ""}` : `${r.name.padEnd(16)} FAILED  ${r.error}`);
appendFileSync("evidence/audit-log.jsonl", JSON.stringify({ ts: new Date().toISOString(), address, chain: chainName, chainId, verdict, reason, results: [g, s] }) + "\n");
