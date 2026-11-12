# paid-preflight — paid preflights for third parties via x402

> **Status: BUILT and verified end-to-end once on Sepolia testnet (2026-11-12).
> NOT LIVE. There is no hosted instance, no real buyer, and no revenue.
> It earns nothing until someone hosts it (see "To go live").**

A buyer pays **$0.15 test USDC** per core preflight over HTTP. The server
verifies + settles the payment with x402, runs the tgp-guard core preflight
(price + sanctions + link) with the operator burner wallet, and returns one
`ALLOW / HOLD / BLOCK` verdict with the Telegraph miner receipts.

## Pricing (real costs, not made up)

| Item | Amount |
|---|---|
| Buyer price, flat per preflight | **$0.15** (150000 atomic test USDC, 6 decimals) |
| Miner cost: 9 paid answers x $0.01 (price 3 + sanctions 3 + link 3) | $0.09 |
| Facilitator settle gas (1 EIP-3009 `transferWithAuthorization`, Sepolia gas ~0 gwei at time of writing) | ~$0.00 on testnet |
| **Margin per preflight** | **$0.06 (40% gross)** |

Why flat $0.15 instead of cost-plus per leg: x402 routes carry a fixed
price, so one route = one price. The core preflight always buys exactly 9
answers when every miner answers (a failed miner answer is not charged, so
miner cost can only come in *under* $0.09 and margin only grows). The
contract-audit leg is NOT in v1 — a 4-leg bundle would cost $0.11 and needs
its own price; see "Future work".

On mainnet this math changes completely (real USDC, real gas for the
facilitator settle, real Telegraph mainnet pricing if it ever exists) — the
$0.15 is a **testnet** price for a **testnet** service.

## What a buyer sends / gets

```
POST /v1/preflight
{ "asset": "bitcoin", "counterparty": "Acme Bakery", "url": "https://github.com" }
# optional: "quote": 74400
```

- No payment header -> `402 Payment Required` with `PAYMENT-REQUIRED`
  (exact scheme, `eip155:11155111`, 150000 test USDC, `payTo` = operator
  revenue wallet). Free endpoints: `GET /health`, `GET /pricing`.
- With payment -> `200`:
```json
{
  "verdict": "ALLOW",
  "checks": ["ALLOW  price check (bitcoin)", "ALLOW  sanctions screen (\"Acme Bakery\")", "ALLOW  link check"],
  "receipts": ["0x10dd...", "0x84c5...", "... 9 total"],
  "minerAnswers": 9, "minerCostUsd": 0.09,
  "priceUsd": 0.15, "marginUsd": 0.06,
  "paymentTx": "0x4c17...",
  "settled": true, "network": "eip155:11155111", "testnetOnly": true
}
```
plus a `PAYMENT-RESPONSE` header (base64 settle receipt).

**Settle-after-verdict:** the buyer's authorization is verified first, but
the on-chain settlement only happens *after* the guard produces a verdict.
If the guard crashes before a verdict, the payment is never settled and the
buyer is not charged (the signed authorization just expires unused).
A `HOLD`/`BLOCK` verdict IS charged — the checks were bought and delivered.

## How to run (local test)

```bash
cd paid-preflight
cp .env.example .env   # then set EVM_PRIVATE_KEY (burner, testnet only)
node --env-file=.env server.mjs        # listens on 127.0.0.1:3000
```

Test buyer (throwaway key, never the operator key):

```bash
# make a buyer key + fund it with 1 test USDC (minted by the operator burner)
node -e "console.log(require('viem/accounts').generatePrivateKey())"  # save to a file, chmod 600
node --env-file=.env fund-buyer.mjs <buyer-address> 1
BUYER_PRIVATE_KEY=0x... node test-client.mjs http://127.0.0.1:3000
```

Env: `EVM_PRIVATE_KEY` (burner: pays miners + signs facilitator settles),
`PAYTO_ADDRESS` (revenue wallet; default = burner address — for local tests
only; set a real revenue wallet before hosting), `PORT` (default 3000),
`SEPOLIA_RPC_URL` (default `https://ethereum-sepolia-rpc.publicnode.com`).

No new dependencies: uses the repo-root `@x402/*` v2.28 + `viem`, and
reuses `preflight.mjs` unchanged via a child process.

## Why a self-hosted facilitator

The public facilitator at `https://x402.org/facilitator` does **not** support
`eip155:11155111` (verified 2026-11-12: its `getSupported()` lists only
Base Sepolia, Solana, Algorand, Aptos, Stellar/Hedera testnets, XRPL).
So the server runs its own facilitator in-process (`@x402/core/facilitator`
+ `@x402/evm/exact/facilitator`), with the operator burner as the
facilitator signer. The facilitator submits the buyer's EIP-3009
authorization on-chain and pays its gas. Consequence: whoever hosts this
holds a key that can submit transactions — see key custody below.

Two things the stock SDK did not do for a non-default asset, both fixed
with on-chain verification, not guessing:

1. The buyer client refuses to sign unless the 402 requirements carry the
   token's EIP-712 domain (`extra.name` / `extra.version`). The test USDC
   has no `version()` function, but name `"USD Coin"` + version `"2"`
   reproduces its on-chain `DOMAIN_SEPARATOR`
   (`0xf71b96bf…`) exactly on chain 11155111 — that is what the server sends.
2. `processSettlement()` returns the `SettleResponse` **flat** (`.transaction`,
   `.success`, `.headers` on top level). The first live run read it nested
   (`.settleResponse.transaction`) and reported `paymentTx: null` even though
   the settlement had landed on-chain. Fixed the same day; the recorded
   payment tx was corrected in `paid-log.jsonl` from the on-chain
   `Transfer` event.

## Live verification (2026-11-12, one end-to-end run)

- Unpaid `POST /v1/preflight` -> `402` with correct `accepts`
  (exact / `eip155:11155111` / 150000 / test USDC / payTo burner).
- Paid run via `test-client.mjs` (buyer `0xBAdfBD7052317D589d23B05AdC43a1cE712d92F0`,
  funded with 1.00 test USDC by mint tx
  `0x192318150ed52bcbfe81e6a113e18d7b74693f5eb97108d7a6c38c95d30368f7`):
  `200`, verdict `ALLOW` (price + sanctions + link all ALLOW), 9 receipts,
  miner cost $0.09, margin $0.06.
- Buyer payment settled on-chain: buyer `1.00 -> 0.85` test USDC;
  `Transfer` buyer -> payTo `$0.15`, tx
  `0x4c17203de90797dc1d77c732d451107cb45072b7ef0d11384dc60b0b26e12849`,
  block 12118295. Full record: `paid-log.jsonl`.
- Total test spend: $0.09 net to miners (the $0.15 buyer payment went back
  to the operator wallet, which is also `payTo` in the test setup). No real
  money anywhere; Sepolia gas was ~0 gwei.

**Caveat, stated plainly:** after the live run I fixed the `paymentTx`
extraction bug (above). The fix is verified against the SDK's published
types and by a no-spend synthetic `createSettlementHeaders` check (it emits
a correct `PAYMENT-RESPONSE` header), but it has **not** had a second paid
live run — a second run would have added another $0.09 and pushed total test
spend over the ~$0.15 budget for this workstream. Re-run `test-client.mjs`
once after hosting to confirm `paymentTx` and the `PAYMENT-RESPONSE` header
appear in the live response.

## Key custody (read this before hosting)

- `EVM_PRIVATE_KEY` lives in env only, never in git (`.env` is gitignored
  at every level; `paid-preflight/.env` holds the same burner key as the
  repo-root `.env`). It pays miners AND submits buyer settlements, so a leak
  drains the operator wallet and lets anyone settle payments as the service.
- The burner is a **testnet-only throwaway**: ~18 test USDC + ~0.0018
  Sepolia ETH at time of writing. Never point this at a mainnet key or a
  wallet with real funds.
- `PAYTO_ADDRESS` must be set to George's revenue wallet before any hosted
  run; the default (burner address) only makes sense for local tests where
  the money cycles back to the operator.
- No auth, no rate limiting, no replay protection beyond x402 nonces, no
  persistence beyond `paid-log.jsonl`. Do not expose it to the open internet
  as-is.

## To go live (checklist — none of this is done)

1. A host: any always-on Node 22+ box (VPS, Render/Railway/Fly free tier,
   etc.). GitHub Pages cannot run it — it is static.
2. `EVM_PRIVATE_KEY` + `PAYTO_ADDRESS` in the host's env/secrets, never in
   the repo. Rotate the burner key before first hosted run (the current one
   has been copied around local test setups).
3. A domain + HTTPS (x402 clients and browsers expect it; plain HTTP only
   works for localhost tests).
4. Fund the operator wallet: enough test USDC to float miner payments
   between buyer settlements (each preflight fronts $0.09 before the $0.15
   lands) + Sepolia ETH for facilitator settle gas.
5. Re-run `test-client.mjs` against the public URL and confirm `paymentTx`
   + `PAYMENT-RESPONSE` header (see caveat above).
6. Decide the abuse story before announcing it: per-IP/per-buyer rate
   limits, a daily miner-spend cap, and an alert when the operator balance
   runs low — otherwise one buyer can drain the float with HOLDs.

## Future work (not built)

- Contract-audit leg as a second route (4-leg bundle: cost $0.11, needs its
  own price, e.g. $0.18–$0.20).
- Per-leg routes (`/v1/preflight/price`, `/screen`, `/link` at $0.05 each)
  instead of the flat bundle, if buyers want single checks.
- Mainnet: different network, real USDC, real facilitator economics, real
  Telegraph mainnet pricing — a separate design, not a config flip.
- The operator float problem: buyer pays first in the current flow only
  *after* verification; the $0.09 miner front is small, but at volume the
  float and the failed-settlement window need real accounting, not a JSONL.
