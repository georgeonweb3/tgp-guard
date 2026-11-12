// paid-preflight/test-client.mjs — test buyer for the paid-preflight server.
//
// Simulates a third-party buyer: pays $0.15 test USDC via x402 and prints the
// verdict + receipts. Uses its own throwaway key (BUYER_PRIVATE_KEY) — never
// the operator key. Fund it first with fund-buyer.mjs (1 test USDC is plenty).
//
//   node --env-file=.env test-client.mjs [server-url]
//   Env: BUYER_PRIVATE_KEY (throwaway test key only)

import { x402Client, wrapFetchWithPayment } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";

const SERVER = process.argv[2] || process.env.PAID_PREFLIGHT_URL || "http://127.0.0.1:3000";
const USDC = "0xcc194e1a843B658526D0D5C431f670028582Ae17";

if (!process.env.BUYER_PRIVATE_KEY) {
  console.error("BUYER_PRIVATE_KEY is required (throwaway test key, env only).");
  process.exit(1);
}
const buyer = privateKeyToAccount(process.env.BUYER_PRIVATE_KEY);
console.log("buyer:", buyer.address);

const client = new x402Client();
client.setSpendControls({
  allowedAssets: [{ network: "eip155:11155111", asset: USDC, maxAmountPerPayment: "150000" }],
});
registerExactEvmScheme(client, { signer: buyer });
const pay = wrapFetchWithPayment(fetch, client);

const body = { asset: "bitcoin", counterparty: "Acme Bakery", url: "https://github.com" };
console.log("POST", `${SERVER}/v1/preflight`, JSON.stringify(body));
const res = await pay(`${SERVER}/v1/preflight`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
console.log("STATUS", res.status);
console.log("X-PAYMENT-RESPONSE:", res.headers.get("x-payment-response") || "(none)");
console.log("PAYMENT-RESPONSE:", res.headers.get("payment-response") || "(none)");
const text = await res.text();
console.log("BODY", text);
