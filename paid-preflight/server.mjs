// paid-preflight/server.mjs — paid preflights for third parties via x402.
//
// A buyer POSTs a preflight request. The server answers 402 (pay $0.15 test
// USDC on Ethereum Sepolia), verifies + settles the payment through a
// SELF-HOSTED x402 facilitator (the public x402.org facilitator does NOT
// support eip155:11155111 — see README), runs the guard with the operator
// burner wallet, and returns verdict + miner receipts.
//
// Pricing: $0.15 flat per core preflight (price + sanctions + link = 9 paid
// miner answers x $0.01 = $0.09 cost, $0.06 margin). Settle-after-verdict:
// the buyer is only charged if a verdict is actually produced. If the guard
// crashes before producing a verdict, the payment is never settled and the
// buyer keeps their money (the signed authorization simply expires unused).
//
//   node --env-file=.env server.mjs            # from paid-preflight/
//   Env: EVM_PRIVATE_KEY (burner, operator + facilitator signer — NEVER commit)
//        PAYTO_ADDRESS   (revenue wallet; default: burner address)
//        PORT            (default 3000)
//        SEPOLIA_RPC_URL (default https://ethereum-sepolia-rpc.publicnode.com)
//
// TESTNET ONLY. NOT LIVE until hosted somewhere with the key in env only.

import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { appendFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createPublicClient, createWalletClient, http, publicActions } from "viem";
import { sepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { x402ResourceServer } from "@x402/core/server";
import { x402HTTPResourceServer } from "@x402/core/http";
import { x402Facilitator } from "@x402/core/facilitator";
import { registerExactEvmScheme as registerServerScheme } from "@x402/evm/exact/server";
import { registerExactEvmScheme as registerFacilitatorScheme } from "@x402/evm/exact/facilitator";
import { toFacilitatorEvmSigner } from "@x402/evm";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const NETWORK = "eip155:11155111"; // Ethereum Sepolia
const USDC = "0xcc194e1a843B658526D0D5C431f670028582Ae17"; // Telegraph test USDC (6 decimals)
const PRICE_ATOMIC = "150000"; // $0.15
const PRICE_USD = 0.15;
const MINER_COST_USD = 0.09; // 9 paid answers x $0.01 (price 3 + sanctions 3 + link 3)
const PORT = Number(process.env.PORT || 3000);
const RPC_URL = process.env.SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com";

if (!process.env.EVM_PRIVATE_KEY) {
  console.error("EVM_PRIVATE_KEY is required (burner wallet key, env only — never commit it).");
  process.exit(1);
}
const operator = privateKeyToAccount(process.env.EVM_PRIVATE_KEY);
const payTo = process.env.PAYTO_ADDRESS || operator.address;
if (!/^0x[0-9a-fA-F]{40}$/.test(payTo)) {
  console.error("PAYTO_ADDRESS is not a valid address:", payTo);
  process.exit(1);
}

// --- Self-hosted facilitator (in-process) ---------------------------------
// The public facilitator at x402.org does not list eip155:11155111 in its
// supported kinds, so verify/settle for Sepolia must run locally. The
// facilitator signer submits the buyer's EIP-3009 authorization on-chain and
// pays its gas (Sepolia gas is ~0 gwei at time of writing — effectively free
// on testnet; on mainnet this would be a real per-settlement cost).
const publicClient = createPublicClient({ chain: sepolia, transport: http(RPC_URL) });
const walletClient = createWalletClient({ account: operator, chain: sepolia, transport: http(RPC_URL) }).extend(publicActions);
const facilitator = new x402Facilitator();
registerFacilitatorScheme(facilitator, {
  signer: toFacilitatorEvmSigner(walletClient),
  networks: NETWORK,
});

// --- Resource server -------------------------------------------------------
const resourceServer = new x402ResourceServer(facilitator);
registerServerScheme(resourceServer, { networks: [NETWORK] });
const httpServer = new x402HTTPResourceServer(resourceServer, {
  "POST /v1/preflight": {
    accepts: {
      scheme: "exact",
      network: NETWORK,
      payTo,
      price: { amount: PRICE_ATOMIC, asset: USDC },
      maxTimeoutSeconds: 300,
      // EIP-712 domain of the test USDC, verified against the token's on-chain
      // DOMAIN_SEPARATOR (name "USD Coin", version "2" reproduces it exactly
      // on chain 11155111). The buyer client needs these to sign the EIP-3009
      // authorization; without them it refuses to create a payment payload.
      extra: { name: "USD Coin", version: "2" },
    },
    description: "tgp-guard core preflight: price + sanctions + link, one ALLOW/HOLD/BLOCK verdict with miner receipts",
    mimeType: "application/json",
  },
});
await httpServer.initialize();
console.log(`facilitator kinds: ${JSON.stringify(facilitator.getSupported().kinds)}`);
console.log(`paid-preflight listening on :${PORT} — price $${PRICE_USD.toFixed(2)} test USDC, payTo ${payTo}`);

// --- Guard runner (reuses the existing CLI, same as a local run) -----------
function runGuard({ asset, quote, counterparty, url }) {
  return new Promise((resolve) => {
    const args = ["--asset", asset, "--counterparty", counterparty, "--url", url];
    if (quote !== undefined && quote !== null) args.push("--quote", String(quote));
    execFile(
      process.execPath,
      ["--env-file=.env", "preflight.mjs", ...args],
      { cwd: ROOT, timeout: 120000, env: { ...process.env } },
      (err, out) => {
        const verdict = (out.match(/=== PREFLIGHT: (ALLOW|HOLD|BLOCK) ===/) || [])[1] || null;
        const receipts = [...out.matchAll(/receipt (0x[0-9a-f]{64})/g)].map((m) => m[1]);
        const checks = out
          .split("\n")
          .filter((l) => /^(ALLOW|HOLD|BLOCK) /.test(l))
          .map((l) => l.trim());
        resolve({
          ok: Boolean(verdict),
          verdict,
          checks,
          receipts,
          minerAnswers: receipts.length,
          minerCostUsd: +(receipts.length * 0.01).toFixed(2),
          raw: out,
          error: err && !verdict ? String(err.message).slice(0, 200) : null,
        });
      },
    );
  });
}

function validate(body) {
  if (!body || typeof body !== "object") return "body must be a JSON object";
  if (!["bitcoin", "ethereum", "solana"].includes(body.asset)) return "asset must be bitcoin, ethereum or solana";
  if (typeof body.counterparty !== "string" || !body.counterparty.trim() || body.counterparty.length > 200)
    return "counterparty must be a non-empty string (max 200 chars)";
  try {
    const u = new URL(body.url);
    if (!["http:", "https:"].includes(u.protocol)) throw new Error("bad protocol");
  } catch {
    return "url must be a valid http(s) URL";
  }
  if (body.quote !== undefined && !(typeof body.quote === "number" && body.quote > 0)) return "quote, if given, must be a positive number";
  return null;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString();
      if (!raw) return resolve(null);
      try { resolve(JSON.parse(raw)); } catch { reject(new Error("invalid JSON")); }
    });
    req.on("error", reject);
  });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "127.0.0.1"}`);
  try {
    if (req.method === "GET" && url.pathname === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ ok: true, network: NETWORK, priceUsd: PRICE_USD, payTo, testnetOnly: true, live: false }));
    }
    if (req.method === "GET" && url.pathname === "/pricing") {
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({
        endpoint: "POST /v1/preflight",
        priceUsd: PRICE_USD,
        asset: USDC,
        network: NETWORK,
        minerCostUsd: MINER_COST_USD,
        marginUsd: +(PRICE_USD - MINER_COST_USD).toFixed(2),
        breakdown: "price check 3 answers + sanctions screen 3 + link check 3 = 9 x $0.01",
        note: "Buyer pays only when a verdict is produced. Guard crash before verdict = no settlement, no charge.",
      }));
    }
    if (req.method !== "POST" || url.pathname !== "/v1/preflight") {
      res.writeHead(404, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "not found — POST /v1/preflight, GET /health, GET /pricing" }));
    }

    let body;
    try { body = await readBody(req); } catch {
      res.writeHead(400, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "invalid JSON body" }));
    }
    // Validate BEFORE any payment flow, so nobody pays for a bad request.
    const bad = validate(body);
    if (bad) {
      res.writeHead(400, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: bad }));
    }

    const adapter = {
      getHeader: (n) => req.headers[n.toLowerCase()],
      getMethod: () => req.method,
      getPath: () => url.pathname,
      getUrl: () => url.pathname,
      getAcceptHeader: () => req.headers.accept || "",
      getUserAgent: () => req.headers["user-agent"] || "",
      getBody: () => body,
    };
    const result = await httpServer.processHTTPRequest({ adapter, path: url.pathname, method: req.method });
    if (result.type === "payment-error") {
      const r = result.response;
      res.writeHead(r.status || 402, { "Content-Type": "application/json", ...(r.headers || {}) });
      return res.end(typeof r.body === "string" ? r.body : JSON.stringify(r.body ?? {}));
    }
    if (result.type !== "payment-verified") {
      res.writeHead(500, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "unexpected payment state" }));
    }

    // Payment verified — run the guard, THEN settle. No verdict = no settle.
    const guard = await runGuard(body);
    if (!guard.ok) {
      console.error("guard failed before verdict; payment NOT settled:", guard.error);
      res.writeHead(502, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "guard failed before producing a verdict — you were NOT charged (payment was verified but never settled)", detail: guard.error }));
    }
    const settled = await httpServer.processSettlement(result.paymentPayload, result.paymentRequirements);
    // processSettlement returns the SettleResponse FLAT (ProcessSettleSuccessResponse
    // = SettleResponse & { success: true, headers, requirements }): transaction,
    // success and headers live on the top level, NOT under .settleResponse/.response.
    // (First live run read the nested shape and reported paymentTx null even though
    // the settlement had landed on-chain — fixed 2026-11-12, see README.)
    const settleTx = settled?.transaction || null;
    const settleOk = settled?.success === true;
    if (!settleOk) {
      console.error("settlement failed after verdict; buyer NOT charged:", JSON.stringify(settled)?.slice(0, 300));
      res.writeHead(502, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "verdict was produced but payment settlement failed — you were NOT charged", verdict: guard.verdict, checks: guard.checks, receipts: guard.receipts }));
    }
    const payload = {
      verdict: guard.verdict,
      checks: guard.checks,
      receipts: guard.receipts,
      minerAnswers: guard.minerAnswers,
      minerCostUsd: guard.minerCostUsd,
      priceUsd: PRICE_USD,
      marginUsd: +(PRICE_USD - guard.minerCostUsd).toFixed(2),
      paymentTx: settleTx,
      settled: settleOk,
      network: NETWORK,
      testnetOnly: true,
    };
    appendFileSync(join(ROOT, "paid-preflight", "paid-log.jsonl"),
      JSON.stringify({ ts: new Date().toISOString(), request: body, ...payload }) + "\n");
    res.writeHead(200, {
      "Content-Type": "application/json",
      ...(settled?.headers || {}),
    });
    return res.end(JSON.stringify(payload));
  } catch (e) {
    console.error("server error:", e);
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: String(e?.message || e).slice(0, 300) }));
    }
  }
});

server.listen(PORT, "127.0.0.1");
