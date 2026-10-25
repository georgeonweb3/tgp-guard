import { x402Client, wrapFetchWithPayment } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";
import { appendFileSync } from "node:fs";
const N = "https://devnode.telegraphprotocol.com";
const args = process.argv.slice(2);
const down = args.includes("--down");
const url = args.find(a => !a.startsWith("--"));
if (!url || !/^https?:\/\//i.test(url)) { console.error('usage: urlcheck.mjs "https://..." [--down]'); process.exit(1); }
const client = new x402Client();
registerExactEvmScheme(client, { signer: privateKeyToAccount(process.env.EVM_PRIVATE_KEY) });
const pay = wrapFetchWithPayment(fetch, client);
const BAD = /(suspicious|malicious|phish|malware|unsafe|threat_detected|high)/i;
const voters = [
  { name: "ProofGate", id: "7402", method: "POST", endpoint: "/scan",
    cls: r => /no_threat/i.test(r.verdict) ? "CLEAN" : BAD.test(r.verdict || "") ? "FLAG" : "UNKNOWN", show: r => r.verdict },
  { name: "URLSentinel", id: down ? "999999999" : "5001", method: "POST", endpoint: "/scan",
    cls: r => /^safe$/i.test(r.verdict) ? "CLEAN" : BAD.test(r.verdict || "") ? "FLAG" : "UNKNOWN", show: r => r.verdict },
  { name: "NetWire", id: "7334", method: "GET", endpoint: "/url-scan",
    cls: r => r.safe === true ? "CLEAN" : r.safe === false ? "FLAG" : "UNKNOWN", show: r => `safe=${r.safe} risk=${r.risk}` },
];
async function ask(v) {
  try {
    const res = await pay(`${N}/engine/v1/ask/${v.id}`, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method: v.method, endpoint: v.endpoint, payload: { url } }) });
    const rc = res.headers.get("x-telegraph-receipt");
    const receipt = rc ? JSON.parse(Buffer.from(rc, "base64").toString()).receipt_hash : null;
    const body = await res.json().catch(() => null);
    if (res.status !== 200 || !body?.result) return { name: v.name, cls: "FAILED", detail: `HTTP ${res.status} ${JSON.stringify(body)?.slice(0, 90)}` };
    return { name: v.name, cls: v.cls(body.result), detail: v.show(body.result), receipt, signal: body.signal_hash };
  } catch (e) { return { name: v.name, cls: "FAILED", detail: String(e.message).slice(0, 90) }; }
}
const results = await Promise.all(voters.map(ask));
const n = c => results.filter(r => r.cls === c).length;
let verdict, reason;
if (n("FLAG") >= 2) { verdict = "BLOCK"; reason = `${n("FLAG")}/3 sources flag this URL`; }
else if (n("FLAG") === 1) { verdict = "HOLD"; reason = "1 source flags this URL, no corroboration: review before proceeding"; }
else if (n("UNKNOWN") + n("FAILED") > 0) { verdict = "HOLD"; reason = `${n("UNKNOWN") + n("FAILED")} source(s) could not assess, cannot clear`; }
else { verdict = "ALLOW"; reason = "no flags from 3/3 sources (not on these checks; new phishing sites may not be detectable yet)"; }
const spent = results.filter(r => r.receipt).length * 0.01;
console.log(`\n${url}\n=> ${verdict}\n${reason}  spent $${spent.toFixed(2)}\n`);
for (const r of results) console.log(`${r.name.padEnd(12)} ${r.cls.padEnd(8)} ${r.detail}${r.receipt ? "  receipt " + r.receipt : ""}`);
appendFileSync("evidence/url-log.jsonl", JSON.stringify({ ts: new Date().toISOString(), url, verdict, reason, results }) + "\n");
