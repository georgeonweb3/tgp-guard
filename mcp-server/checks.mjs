// checks.mjs — shared tgp-guard check logic for the MCP server.
//
// Same miners, endpoints, parse rules and verdict rules as the CLI scripts
// (guard.mjs = price, screen.mjs = sanctions, urlcheck.mjs = link). The CLI
// scripts stay as-is; this module is the importable form of the same logic
// so the MCP tools and the CLIs cannot drift apart silently — if a miner id
// or rule changes, change it here AND in the matching CLI script.
//
// Every paid answer costs $0.01 test USDC on Ethereum Sepolia
// (eip155:11155111), capped at 10000 atomic units per payment via
// setSpendControls. Failed calls are not charged.

import { x402Client, wrapFetchWithPayment } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";

export const DEVNODE = "https://devnode.telegraphprotocol.com";
export const PAYMENT_ASSET = "0xcc194e1a843B658526D0D5C431f670028582Ae17";
export const NETWORK = "eip155:11155111";
export const PRICE_PER_ANSWER_USD = 0.01;

// Build the payment-wrapped fetch from the burner key in EVM_PRIVATE_KEY.
// Throws if the key is missing — the server must fail loudly, never run
// without a signer (a payment would fail mid-flight instead).
export function createPay() {
  const key = process.env.EVM_PRIVATE_KEY;
  if (!key) throw new Error("EVM_PRIVATE_KEY is not set (burner Sepolia key — see README.md)");
  const client = new x402Client();
  client.setSpendControls({
    allowedAssets: [{ network: NETWORK, asset: PAYMENT_ASSET, maxAmountPerPayment: "10000" }],
  });
  registerExactEvmScheme(client, { signer: privateKeyToAccount(key) });
  return wrapFetchWithPayment(fetch, client);
}

async function ask(pay, id, method, endpoint, payload) {
  const res = await pay(`${DEVNODE}/engine/v1/ask/${id}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ method, endpoint, payload }),
  });
  const rc = res.headers.get("x-telegraph-receipt");
  const receipt = rc ? JSON.parse(Buffer.from(rc, "base64").toString()).receipt_hash : null;
  const body = await res.json().catch(() => null);
  return { status: res.status, receipt, signal: body?.signal_hash ?? null, body };
}

const paidCount = (results) => results.filter((r) => r.receipt).length;

// ---------------------------------------------------------------- price ---
const KRAKEN = { bitcoin: "XBTUSD", ethereum: "ETHUSD", solana: "SOLUSD" };
const ALLOW_PCT = 0.5, BLOCK_PCT = 2, OFFMARKET_PCT = 1;

export async function priceCheck(pay, { asset, quote = null, quorum = 3 } = {}) {
  if (!KRAKEN[asset]) throw new Error(`asset must be one of: ${Object.keys(KRAKEN).join(", ")}`);
  const voters = [
    { name: "TxLens", id: "9002", endpoint: "/crypto-price", payload: { coin_id: asset }, parse: (r) => r.price_usd },
    { name: "CoinGecko", id: "32001", endpoint: "/query", payload: { ids: asset, vs_currencies: "usd" }, parse: (r) => r[asset]?.usd },
    { name: "Kraken", id: "190076", endpoint: "/query", payload: { pair: KRAKEN[asset] },
      parse: (r) => { const p = Object.values(r.result || {})[0]; return p && parseFloat(p.c[0]); } },
  ];
  const results = await Promise.all(voters.map(async (v) => {
    try {
      const { status, receipt, signal, body } = await ask(pay, v.id, "GET", v.endpoint, v.payload);
      if (status !== 200 || !body) return { name: v.name, ok: false, error: `HTTP ${status}` };
      const price = Number(v.parse(body.result));
      if (!Number.isFinite(price) || price <= 0) return { name: v.name, ok: false, error: "unparseable answer" };
      return { name: v.name, ok: true, price, cost_usd: body.cost_usd ?? PRICE_PER_ANSWER_USD, receipt, signal };
    } catch (e) { return { name: v.name, ok: false, error: String(e.message).slice(0, 120) }; }
  }));
  const good = results.filter((r) => r.ok);
  const ps = good.map((r) => r.price).sort((a, b) => a - b);
  const median = ps.length ? (ps.length % 2 ? ps[(ps.length - 1) / 2] : (ps[ps.length / 2 - 1] + ps[ps.length / 2]) / 2) : null;
  const spread = ps.length >= 2 ? ((ps.at(-1) - ps[0]) / median) * 100 : null;
  let verdict, reason;
  if (good.length < quorum) { verdict = "HOLD"; reason = `only ${good.length}/3 sources answered - no quorum`; }
  else if (spread > BLOCK_PCT) { verdict = "BLOCK"; reason = `sources disagree by ${spread.toFixed(2)}%`; }
  else if (spread > ALLOW_PCT) { verdict = "HOLD"; reason = `sources disagree by ${spread.toFixed(2)}%`; }
  else { verdict = "ALLOW"; reason = `${good.length}/3 sources agree within ${spread.toFixed(2)}%`; }
  let quoteDeviationPct = null;
  if (quote != null && median) {
    quoteDeviationPct = (Math.abs(quote - median) / median) * 100;
    if (quoteDeviationPct > OFFMARKET_PCT) { verdict = "BLOCK"; reason = `quoted ${quote} is ${quoteDeviationPct.toFixed(2)}% off the median ${median.toFixed(2)}`; }
  }
  const paid = paidCount(results);
  return { check: "price", asset, quote, verdict, reason, median, spread_pct: spread, quote_deviation_pct: quoteDeviationPct,
    paid_answers: paid, cost_usd: paid * PRICE_PER_ANSWER_USD, results };
}

// ------------------------------------------------------------ sanctions ---
export async function sanctionsScreen(pay, { entity } = {}) {
  if (!entity || !entity.trim()) throw new Error("entity (name) is required");
  const lists = [
    { name: "OFAC SDN", id: "78021", method: "GET", endpoint: "/query", payload: { entity },
      parse: (b) => { const h = b.result?.on_list; return h === 1 ? "HIT" : h === 0 ? "CLEAR" : "BAD"; } },
    { name: "UN Consolidated", id: "78022", method: "GET", endpoint: "/query", payload: { entity },
      parse: (b) => { const h = b.result?.on_list; return h === 1 ? "HIT" : h === 0 ? "CLEAR" : "BAD"; } },
    { name: "Counterproof (US/UN/EU/UK)", id: "731002", method: "GET", endpoint: "/screen", payload: { q: entity },
      parse: (b) => { const l = b.result?.label; return l === "BLOCK" ? "HIT" : l === "REVIEW" ? "REVIEW" : l === "CLEAR" ? "CLEAR" : "BAD"; } },
  ];
  const results = await Promise.all(lists.map(async (l) => {
    try {
      const { status, receipt, signal, body } = await ask(pay, l.id, l.method, l.endpoint, l.payload);
      if (status !== 200 || !body) return { name: l.name, ok: false, error: `HTTP ${status}` };
      const verdict = l.parse(body);
      if (verdict === "BAD") return { name: l.name, ok: false, error: "unparseable answer" };
      return { name: l.name, ok: true, verdict, receipt, signal };
    } catch (e) { return { name: l.name, ok: false, error: String(e.message).slice(0, 120) }; }
  }));
  const answered = results.filter((r) => r.ok);
  const listHits = answered.filter((r) => r.verdict === "HIT" && !r.name.startsWith("Counterproof"));
  const cp = answered.find((r) => r.name.startsWith("Counterproof"));
  const failed = results.filter((r) => !r.ok);
  let verdict, reason;
  if (listHits.length) { verdict = "BLOCK"; reason = `listed on: ${listHits.map((h) => h.name).join(", ")}` + (cp && cp.verdict !== "HIT" ? ` (Counterproof second opinion: ${cp.verdict})` : ""); }
  else if (cp && cp.verdict === "HIT") { verdict = "HOLD"; reason = "Counterproof flags a possible match (US/UN/EU/UK fuzzy screen); OFAC/UN lists clear — human review before acting"; }
  else if (cp && cp.verdict === "REVIEW") { verdict = "HOLD"; reason = "Counterproof REVIEW (possible near-match); OFAC/UN lists clear — human review before acting"; }
  else if (failed.length) { verdict = "HOLD"; reason = `${failed.length} list(s) unavailable, cannot clear`; }
  else { verdict = "ALLOW"; reason = "no match on any list for this exact name (name-only screening, not full KYC)"; }
  const paid = paidCount(results);
  return { check: "sanctions", entity, verdict, reason, paid_answers: paid, cost_usd: paid * PRICE_PER_ANSWER_USD, results };
}

// ----------------------------------------------------------------- link ---
const BAD = /(suspicious|malicious|phish|malware|unsafe|threat_detected|high)/i;

export async function linkScan(pay, { url } = {}) {
  if (!url || !/^https?:\/\//i.test(url)) throw new Error("url must start with http:// or https://");
  const voters = [
    { name: "Preflight", id: "20260828", method: "GET", endpoint: "/url-safe",
      cls: (r) => ((r.sources || []).some((s) => s.listed) || (r.verdict && !/^(not_listed|safe|clean)$/i.test(r.verdict) && /listed/i.test(r.verdict))) ? "FLAG" : /^(not_listed|safe|clean)$/i.test(r.verdict || "") ? "CLEAN" : "UNKNOWN",
      show: (r) => `verdict=${r.verdict}` },
    { name: "URLSentinel", id: "5001", method: "POST", endpoint: "/scan",
      cls: (r) => /^safe$/i.test(r.verdict) ? "CLEAN" : BAD.test(r.verdict || "") ? "FLAG" : "UNKNOWN", show: (r) => r.verdict },
    { name: "NetWire", id: "7334", method: "GET", endpoint: "/url-scan",
      cls: (r) => r.safe === true ? "CLEAN" : r.safe === false ? "FLAG" : "UNKNOWN", show: (r) => `safe=${r.safe} risk=${r.risk}` },
  ];
  const results = await Promise.all(voters.map(async (v) => {
    try {
      const { status, receipt, signal, body } = await ask(pay, v.id, v.method, v.endpoint, { url });
      if (status !== 200 || !body?.result) return { name: v.name, cls: "FAILED", detail: `HTTP ${status}` };
      return { name: v.name, cls: v.cls(body.result), detail: v.show(body.result), receipt, signal };
    } catch (e) { return { name: v.name, cls: "FAILED", detail: String(e.message).slice(0, 90) }; }
  }));
  const n = (c) => results.filter((r) => r.cls === c).length;
  let verdict, reason;
  if (n("FLAG") >= 2) { verdict = "BLOCK"; reason = `${n("FLAG")}/3 sources flag this URL`; }
  else if (n("FLAG") === 1) { verdict = "HOLD"; reason = "1 source flags this URL, no corroboration: review before proceeding"; }
  else if (n("UNKNOWN") + n("FAILED") > 0) { verdict = "HOLD"; reason = `${n("UNKNOWN") + n("FAILED")} source(s) could not assess, cannot clear`; }
  else { verdict = "ALLOW"; reason = "no flags from 3/3 sources (not on these checks; new phishing sites may not be detectable yet)"; }
  const paid = paidCount(results);
  return { check: "link", url, verdict, reason, paid_answers: paid, cost_usd: paid * PRICE_PER_ANSWER_USD, results };
}

// --------------------------------------------------------- full preflight ---
const RANK = { ALLOW: 0, HOLD: 1, BLOCK: 2 };

export async function fullPreflight(pay, { asset = null, quote = null, counterparty = null, url = null } = {}) {
  if (!asset && !counterparty && !url) {
    throw new Error("at least one of asset, counterparty, url is required");
  }
  const jobs = [];
  if (asset) jobs.push(priceCheck(pay, { asset, quote }));
  if (counterparty) jobs.push(sanctionsScreen(pay, { entity: counterparty }));
  if (url) jobs.push(linkScan(pay, { url }));
  const checks = await Promise.all(jobs);
  const verdict = checks.reduce((m, c) => (RANK[c.verdict] > RANK[m] ? c.verdict : m), "ALLOW");
  const blockers = checks.filter((c) => c.verdict !== "ALLOW");
  const paid = checks.reduce((s, c) => s + c.paid_answers, 0);
  return { check: "full_preflight", verdict,
    reason: blockers.length ? blockers.map((c) => `${c.check} -> ${c.verdict}: ${c.reason}`).join("; ") : "all checks ALLOW",
    paid_answers: paid, cost_usd: paid * PRICE_PER_ANSWER_USD, checks };
}
