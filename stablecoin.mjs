// stablecoin.mjs — Mission 02 (Stablecoin) use case: before accepting a stablecoin
// payment, screen the payer, audit the token contract, and verify the issuer's
// reserves — one verdict, receipts attached.
//   node --env-file=.env stablecoin.mjs --payer "Acme Bakery" --token USDT --contract 0xdAC17F958D2ee523a2206206994597C13D831ec7
// Reserve attestation is bought from por-attest miner 27741 (GET /reserve, {asset}).
// Verdict: BLOCK if the payer is sanctioned, the contract has critical risk flags,
// or the token is not fully backed. HOLD if any leg cannot be assessed.
import { execFile } from "node:child_process";
import { appendFileSync } from "node:fs";
import { x402Client, wrapFetchWithPayment } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";
const N = "https://devnode.telegraphprotocol.com";
const a = process.argv.slice(2);
const opt = k => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : null; };
const payer = opt("--payer"), token = (opt("--token") || "USDT").toUpperCase();
const contract = opt("--contract"), chain = (opt("--chain") || "ethereum").toLowerCase();
if (!payer || !contract || !/^0x[0-9a-fA-F]{40}$/.test(contract)) {
  console.error('usage: stablecoin.mjs --payer "NAME" --token USDT --contract 0xADDRESS [--chain ethereum]');
  process.exit(1);
}
const run = (label, script, args) => new Promise(res => {
  execFile(process.execPath, ["--env-file=.env", script, ...args], { timeout: 90000 }, (err, out, errout) => {
    const verdict = (out.match(/=>\s+(ALLOW|HOLD|BLOCK)/) || [])[1] || "HOLD";
    const reason = (out.split("\n").find(l => /=>/.test(l)) ? out.split("\n")[out.split("\n").findIndex(l => /=>/.test(l)) + 1] : "") || (errout || "").slice(0, 100);
    const receipts = [...out.matchAll(/receipt (0x[0-9a-f]{64})/g)].map(m => m[1]);
    res({ label, verdict: err && !(out.match(/=>/)) ? "HOLD" : verdict, reason: reason.trim(), receipts });
  });
});
async function reserveCheck() {
  try {
    const client = new x402Client();
    client.setSpendControls({ allowedAssets: [{ network: "eip155:11155111", asset: "0xcc194e1a843B658526D0D5C431f670028582Ae17", maxAmountPerPayment: "10000" }] });
    registerExactEvmScheme(client, { signer: privateKeyToAccount(process.env.EVM_PRIVATE_KEY) });
    const pay = wrapFetchWithPayment(fetch, client);
    const res = await pay(`${N}/engine/v1/ask/27741`, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method: "GET", endpoint: "/reserve", payload: { asset: token } }) });
    const rc = res.headers.get("x-telegraph-receipt");
    const receipt = rc ? JSON.parse(Buffer.from(rc, "base64").toString()).receipt_hash : null;
    const body = await res.json().catch(() => null);
    if (res.status !== 200 || !body?.result) return { label: `reserve attestation (${token})`, verdict: "HOLD", reason: `por-attest could not assess (HTTP ${res.status})`, receipts: receipt ? [receipt] : [] };
    const r = body.result;
    const backed = r.verdict === "fully_backed" || r.fully_backed === true;
    const ratio = r.headline?.ratio ?? r.live_comparison?.ratio;
    return { label: `reserve attestation (${token})`, verdict: backed ? "ALLOW" : "BLOCK",
      reason: backed ? `${token} fully backed, ratio ${ratio ?? "?"} as of ${r.headline?.as_of ?? r.as_of ?? "report date"} (${r.report?.attestor ?? "issuer attestation"})` : `${token} NOT fully backed: ${r.summary ?? r.verdict}`,
      receipts: receipt ? [receipt] : [] };
  } catch (e) { return { label: `reserve attestation (${token})`, verdict: "HOLD", reason: String(e.message).slice(0, 100), receipts: [] }; }
}
const results = await Promise.all([
  run(`sanctions screen ("${payer}")`, "screen.mjs", [payer]),
  run(`contract audit (${contract.slice(0, 10)}… on ${chain})`, "audit.mjs", [contract, "--chain", chain]),
  reserveCheck(),
]);
const rank = { ALLOW: 0, HOLD: 1, BLOCK: 2 };
const final = results.reduce((m, r) => rank[r.verdict] > rank[m] ? r.verdict : m, "ALLOW");
console.log(`\n=== STABLECOIN ACCEPTANCE: ${final} ===`);
console.log(`Accept ${token} from "${payer}" (contract ${contract} on ${chain})\n`);
for (const r of results) {
  console.log(`${r.verdict.padEnd(6)} ${r.label}\n       ${r.reason}`);
  for (const h of r.receipts) console.log(`       receipt ${h}`);
}
const n = results.reduce((s, r) => s + r.receipts.length, 0);
console.log(`\ntotal paid answers: ${n}  (~$${(n * 0.01).toFixed(2)})`);
appendFileSync("evidence/stablecoin-log.jsonl", JSON.stringify({ ts: new Date().toISOString(), payer, token, contract, chain, final, results }) + "\n");
