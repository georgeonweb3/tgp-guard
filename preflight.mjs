import { execFile } from "node:child_process";
import { appendFileSync } from "node:fs";
const a = process.argv.slice(2);
const opt = k => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : null; };
const down = a.includes("--down");
const asset = opt("--asset"), quote = opt("--quote"), who = opt("--counterparty"), url = opt("--url");
if (!asset && !who && !url) {
  console.error('usage: preflight.mjs [--asset bitcoin [--quote 79000]] [--counterparty "NAME"] [--url https://...] [--down]');
  process.exit(1);
}
const run = (label, script, args) => new Promise(res => {
  execFile(process.execPath, ["--env-file=.env", script, ...args, ...(down ? ["--down"] : [])], { timeout: 90000 }, (err, out, errout) => {
    const verdict = (out.match(/=>\s+(ALLOW|HOLD|BLOCK)/) || [])[1] || "HOLD";
    const reason = (out.split("\n").find(l => /=>/.test(l)) ? out.split("\n")[out.split("\n").findIndex(l => /=>/.test(l)) + 1] : "") || (errout || "").slice(0, 100);
    const receipts = [...out.matchAll(/receipt (0x[0-9a-f]{64})/g)].map(m => m[1]);
    res({ label, verdict: err && !(out.match(/=>/)) ? "HOLD" : verdict, reason: reason.trim(), receipts });
  });
});
const jobs = [];
if (asset) jobs.push(run(`price check (${asset}${quote ? " @ " + quote : ""})`, "guard.mjs", [asset, ...(quote ? [quote] : [])]));
if (who) jobs.push(run(`sanctions screen ("${who}")`, "screen.mjs", [who]));
if (url) jobs.push(run(`link check`, "urlcheck.mjs", [url]));
const results = await Promise.all(jobs);
const rank = { ALLOW: 0, HOLD: 1, BLOCK: 2 };
const final = results.reduce((m, r) => rank[r.verdict] > rank[m] ? r.verdict : m, "ALLOW");
const blockers = results.filter(r => r.verdict !== "ALLOW");
console.log(`\n=== PREFLIGHT: ${final} ===`);
if (blockers.length) console.log("because: " + blockers.map(r => `${r.label} -> ${r.verdict}`).join("; "));
console.log("");
for (const r of results) {
  console.log(`${r.verdict.padEnd(6)} ${r.label}\n       ${r.reason}`);
  for (const h of r.receipts) console.log(`       receipt ${h}`);
}
const n = results.reduce((s, r) => s + r.receipts.length, 0);
console.log(`\ntotal paid answers: ${n}  (~$${(n * 0.01).toFixed(2)})`);
appendFileSync("evidence/preflight-log.jsonl", JSON.stringify({ ts: new Date().toISOString(), args: a, final, results }) + "\n");
