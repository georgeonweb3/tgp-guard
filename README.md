# tgp-guard: pre-flight guard for autonomous agents

Before an agent acts (swap, pay, click), tgp-guard buys independent checks through Telegraph and returns one verdict: ALLOW / HOLD / BLOCK, with every receipt attached.

Network: Ethereum Sepolia testnet (eip155:11155111), x402, ~$0.01 per answer, via devnode.telegraphprotocol.com. Payment asset: USD Coin 0xcc194e1a843B658526D0D5C431f670028582Ae17 (test token, open mint — see Run). Failed calls are not charged: a settled payment for a failed request is credited to your Telegraph escrow balance instead.

> Season II refresh (2026-11-03): the devnode moved from Base Sepolia to Ethereum Sepolia since Season I, and @x402 v2.28 rejects non-default assets unless they are allowlisted. The client now calls setSpendControls() with the payment token allowlisted and capped at exactly 10000 atomic units ($0.01) per payment. CoinGecko miner 21002 was retired by the network and replaced with 32001 (same /query interface). ProofGate 7402 was also retired; the link check currently runs on its two remaining voters and therefore returns HOLD (fails closed) until a compatible third voter is found. Live re-verification logs: evidence/season2-refresh/.

## Checks (each fires multiple independent miners and compares)
| Check | Intent | Miners | Rule |
|---|---|---|---|
| Price | CRYPTO_PRICE | TxLens 9002, CoinGecko 32001, Kraken 190076 | spread >0.5% HOLD, >2% BLOCK; quote >1% off median BLOCK |
| Sanctions | SANCTIONS_SCREENING_MATCH | OFAC SDN 78021, UN list 78022 | any hit BLOCK; list unavailable HOLD |
| Link | URL_SCAN | URL Sentinel 5001, NetWire 7334 (ProofGate 7402 retired) | 2+ flags BLOCK; 1 flag or unknown HOLD; with one voter seat empty the verdict is HOLD by design |

Fails closed: a missing source never produces ALLOW (price quorum 2-of-3 only with --quorum2).

## Run
    npm i
    echo "EVM_PRIVATE_KEY=0x<burner testnet key>" > .env   # never reuse a real wallet
    # fund the burner on Ethereum Sepolia: a little Sepolia ETH for gas, plus test USDC.
    # The payment token is an open-mint test token: call mint(address,uint256) on
    # 0xcc194e1a843B658526D0D5C431f670028582Ae17 from the burner (20 USDC is plenty).
    node --env-file=.env preflight.mjs --asset bitcoin --counterparty "Acme Bakery" --url https://github.com
    node --env-file=.env preflight.mjs --asset bitcoin --quote 79000 ...     # BLOCK: off-market quote
    node --env-file=.env preflight.mjs --counterparty "Laden" ...            # BLOCK: OFAC + UN listed
    node --env-file=.env preflight.mjs ... --down                            # HOLD: simulated miner outage

Individual checks: guard.mjs, screen.mjs, urlcheck.mjs. Raw paid call helper: ask.mjs. Logs: evidence/*.jsonl.

## Limitations (honest)
- Testnet only; no production traffic or customer adoption.
- Sanctions check is exact-name only; OFAC lists "LAZARUS GROUP" but the UN miner did not, so list coverage differs.
- OFAC and UN miners share one host. URL Sentinel and NetWire may overlap in what they check.
- Link check has only 2 live voters since ProofGate (7402) left the network, so it cannot currently return ALLOW; six candidate replacement miners were probed on 2026-11-03 and none matched the /scan interface.
- The BLOCK link demo uses a synthetic suspicious URL, not live malware (the URLhaus feed is gone).
- TxLens answers appear cached at times.
- The per-run spend cap is checked after payment, not enforced before; the per-payment cap IS enforced before payment via setSpendControls (Season II refresh).
- preflight.mjs wraps the other scripts by parsing their output; a shared module is the next step.
- --down simulates an outage by pointing one voter at a nonexistent miner id.
- Submitted URLs go to third-party miners: do not scan private URLs.
