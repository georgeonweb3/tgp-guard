import { x402Client, wrapFetchWithPayment } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";
import { appendFileSync } from "node:fs";
const N = "https://devnode.telegraphprotocol.com";
const args = process.argv.slice(2);
const down = args.includes("--down");
const entity = args.filter(a => !a.startsWith("--")).join(" ");
if (!entity) { console.error('usage: screen.mjs "NAME" [--down]'); process.exit(1); }
const client = new x402Client();
client.setSpendControls({ allowedAssets: [{ network: "eip155:11155111", asset: "0xcc194e1a843B658526D0D5C431f670028582Ae17", maxAmountPerPayment: "10000" }] });
registerExactEvmScheme(client, { signer: privateKeyToAccount(process.env.EVM_PRIVATE_KEY) });
const pay = wrapFetchWithPayment(fetch, client);
// Voters: OFAC SDN + UN Consolidated are exact-name list miners (a hit BLOCKs).
// Counterproof (directory id 731002; receipt miner 5138) is the second-opinion voter
// added 2026-11-11: one ask screens US OFAC + UN + EU + UK lists with fuzzy matching
// (GET /screen, payload {q}). Its labels are CLEAR / REVIEW / BLOCK. A Counterproof-only
// signal never BLOCKs on its own — it escalates to HOLD for human review — because its
// fuzzy matcher can clear a bare name the exact-name lists hit (verified live 2026-11-11:
// "Laden" is BLOCK on OFAC+UN yet CLEAR on Counterproof, confidence 0.207). That
// disagreement is information, not a contradiction: it adds EU/UK coverage the list
// miners do not have, and its REVIEW/BLOCK on a name the lists clear is exactly the
// case a human should see before money moves.
const lists = [
  { name: "OFAC SDN", id: "78021", method: "GET", endpoint: "/query", payload: e => ({ entity: e }),
    parse: b => { const h = b.result?.on_list; return h === 1 ? "HIT" : h === 0 ? "CLEAR" : "BAD"; } },
  { name: "UN Consolidated", id: down ? "999999999" : "78022", method: "GET", endpoint: "/query", payload: e => ({ entity: e }),
    parse: b => { const h = b.result?.on_list; return h === 1 ? "HIT" : h === 0 ? "CLEAR" : "BAD"; } },
  { name: "Counterproof (US/UN/EU/UK)", id: "731002", method: "GET", endpoint: "/screen", payload: e => ({ q: e }),
    parse: b => { const l = b.result?.label; return l === "BLOCK" ? "HIT" : l === "REVIEW" ? "REVIEW" : l === "CLEAR" ? "CLEAR" : "BAD"; } },
];
async function ask(l) {
  try {
    const res = await pay(`${N}/engine/v1/ask/${l.id}`, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method: l.method, endpoint: l.endpoint, payload: l.payload(entity) }) });
    const rc = res.headers.get("x-telegraph-receipt");
    const receipt = rc ? JSON.parse(Buffer.from(rc, "base64").toString()).receipt_hash : null;
    const body = await res.json().catch(() => null);
    if (res.status !== 200 || !body) return { name: l.name, ok: false, error: `HTTP ${res.status} ${JSON.stringify(body)?.slice(0, 100)}` };
    const verdict = l.parse(body);
    if (verdict === "BAD") return { name: l.name, ok: false, error: "unparseable answer" };
    return { name: l.name, ok: true, verdict, receipt, signal: body.signal_hash };
  } catch (e) { return { name: l.name, ok: false, error: String(e.message).slice(0, 100) }; }
}
const results = await Promise.all(lists.map(ask));
const answered = results.filter(r => r.ok);
const listHits = answered.filter(r => r.verdict === "HIT" && !r.name.startsWith("Counterproof"));
const cp = answered.find(r => r.name.startsWith("Counterproof"));
const failed = results.filter(r => !r.ok);
let verdict, reason;
if (listHits.length) { verdict = "BLOCK"; reason = `listed on: ${listHits.map(h => h.name).join(", ")}` + (cp && cp.verdict !== "HIT" ? ` (Counterproof second opinion: ${cp.verdict})` : ""); }
else if (cp && cp.verdict === "HIT") { verdict = "HOLD"; reason = "Counterproof flags a possible match (US/UN/EU/UK fuzzy screen); OFAC/UN lists clear — human review before acting"; }
else if (cp && cp.verdict === "REVIEW") { verdict = "HOLD"; reason = "Counterproof REVIEW (possible near-match); OFAC/UN lists clear — human review before acting"; }
else if (failed.length) { verdict = "HOLD"; reason = `${failed.length} list(s) unavailable, cannot clear`; }
else { verdict = "ALLOW"; reason = "no match on any list for this exact name (name-only screening, not full KYC)"; }
console.log(`\n"${entity}"  =>  ${verdict}\n${reason}\n`);
for (const r of results) console.log(r.ok ? `${r.name.padEnd(28)} ${r.verdict === "HIT" ? "LISTED" : r.verdict === "REVIEW" ? "REVIEW" : "no match"}  receipt ${r.receipt}` : `${r.name.padEnd(28)} FAILED  ${r.error}`);
appendFileSync("evidence/screen-log.jsonl", JSON.stringify({ ts: new Date().toISOString(), entity, verdict, reason, results }) + "\n");
