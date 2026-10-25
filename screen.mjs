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
registerExactEvmScheme(client, { signer: privateKeyToAccount(process.env.EVM_PRIVATE_KEY) });
const pay = wrapFetchWithPayment(fetch, client);
const lists = [{ name: "OFAC SDN", id: "78021" }, { name: "UN Consolidated", id: down ? "999999999" : "78022" }];
async function ask(l) {
  try {
    const res = await pay(`${N}/engine/v1/ask/${l.id}`, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method: "GET", endpoint: "/query", payload: { entity } }) });
    const rc = res.headers.get("x-telegraph-receipt");
    const receipt = rc ? JSON.parse(Buffer.from(rc, "base64").toString()).receipt_hash : null;
    const body = await res.json().catch(() => null);
    if (res.status !== 200 || !body) return { name: l.name, ok: false, error: `HTTP ${res.status} ${JSON.stringify(body)?.slice(0, 100)}` };
    const hit = body.result?.on_list;
    if (hit !== 0 && hit !== 1) return { name: l.name, ok: false, error: "unparseable answer" };
    return { name: l.name, ok: true, hit: hit === 1, receipt, signal: body.signal_hash };
  } catch (e) { return { name: l.name, ok: false, error: String(e.message).slice(0, 100) }; }
}
const results = await Promise.all(lists.map(ask));
const answered = results.filter(r => r.ok), hits = answered.filter(r => r.hit), failed = results.filter(r => !r.ok);
let verdict, reason;
if (hits.length) { verdict = "BLOCK"; reason = `listed on: ${hits.map(h => h.name).join(", ")}` + (hits.length < answered.length ? " (other lists did not match: coverage gap)" : ""); }
else if (failed.length) { verdict = "HOLD"; reason = `${failed.length} list(s) unavailable, cannot clear`; }
else { verdict = "ALLOW"; reason = "no match on any list for this exact name (name-only screening, not full KYC)"; }
console.log(`\n"${entity}"  =>  ${verdict}\n${reason}\n`);
for (const r of results) console.log(r.ok ? `${r.name.padEnd(16)} ${r.hit ? "LISTED" : "no match"}  receipt ${r.receipt}` : `${r.name.padEnd(16)} FAILED  ${r.error}`);
appendFileSync("evidence/screen-log.jsonl", JSON.stringify({ ts: new Date().toISOString(), entity, verdict, reason, results }) + "\n");
