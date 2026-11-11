// swap.mjs — Mission 01 (Exchange) use case: before an agent executes a swap,
// check the price, screen the counterparty, and audit the token contract —
// one verdict, receipts attached. This is the pre-listing / pre-trade evidence
// class: the same checks a listings desk buys in parallel, returned as one
// signed-off verdict with a cost line.
//   node --env-file=.env swap.mjs --asset bitcoin --quote 74400 --counterparty "Acme Bakery" --contract 0xdAC17F958D2ee523a2206206994597C13D831ec7
import { execFile } from "node:child_process";
import { appendFileSync } from "node:fs";
const a = process.argv.slice(2);
const opt = k => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : null; };
const asset = opt("--asset"), quote = opt("--quote"), who = opt("--counterparty");
const contract = opt("--contract"), chain = opt("--chain");
if (!asset || !who || !contract || !/^0x[0-9a-fA-F]{40}$/.test(contract)) {
  console.error('usage: swap.mjs --asset bitcoin [--quote 74400] --counterparty "NAME" --contract 0xADDRESS [--chain ethereum]');
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
const jobs = [
  run(`price check (${asset}${quote ? " @ " + quote : ""})`, "guard.mjs", [asset, ...(quote ? [quote] : [])]),
  run(`sanctions screen ("${who}")`, "screen.mjs", [who]),
  run(`contract audit (${contract.slice(0, 10)}…${chain ? " on " + chain : ""})`, "audit.mjs", [contract, ...(chain ? ["--chain", chain] : [])]),
];
const results = await Promise.all(jobs);
const rank = { ALLOW: 0, HOLD: 1, BLOCK: 2 };
const final = results.reduce((m, r) => rank[r.verdict] > rank[m] ? r.verdict : m, "ALLOW");
console.log(`\n=== SWAP CHECK: ${final} ===`);
console.log(`Swap ${asset}${quote ? " @ " + quote : ""} with "${who}", token ${contract}${chain ? " on " + chain : ""}\n`);
for (const r of results) {
  console.log(`${r.verdict.padEnd(6)} ${r.label}\n       ${r.reason}`);
  for (const h of r.receipts) console.log(`       receipt ${h}`);
}
const n = results.reduce((s, r) => s + r.receipts.length, 0);
console.log(`\ntotal paid answers: ${n}  (~$${(n * 0.01).toFixed(2)})`);
appendFileSync("evidence/swap-log.jsonl", JSON.stringify({ ts: new Date().toISOString(), asset, quote, who, contract, chain, final, results }) + "\n");
