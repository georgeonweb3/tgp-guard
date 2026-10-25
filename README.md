# tgp-guard: pre-flight guard for autonomous agents

Before an agent acts (swap, pay, click), tgp-guard buys independent checks through Telegraph and returns one verdict: ALLOW / HOLD / BLOCK, with every receipt attached.

Network: Base Sepolia testnet, x402, ~$0.01 per answer, via devnode.telegraphprotocol.com. Failed calls are not charged.

## Checks (each fires multiple independent miners and compares)
| Check | Intent | Miners | Rule |
|---|---|---|---|
| Price | CRYPTO_PRICE | TxLens 9002, CoinGecko 21002, Kraken 190076 | spread >0.5% HOLD, >2% BLOCK; quote >1% off median BLOCK |
| Sanctions | SANCTIONS_SCREENING_MATCH | OFAC SDN 78021, UN list 78022 | any hit BLOCK; list unavailable HOLD |
| Link | URL_SCAN | ProofGate 7402, URL Sentinel 5001, NetWire 7334 | 2+ flags BLOCK; 1 flag or unknown HOLD |

Fails closed: a missing source never produces ALLOW (price quorum 2-of-3 only with --quorum2).

## Run
    npm i
    echo "EVM_PRIVATE_KEY=0x<burner testnet key>" > .env   # fund with Base Sepolia USDC, never reuse a real wallet
    node --env-file=.env preflight.mjs --asset bitcoin --counterparty "Acme Bakery" --url https://github.com
    node --env-file=.env preflight.mjs --asset bitcoin --quote 79000 ...     # BLOCK: off-market quote
    node --env-file=.env preflight.mjs --counterparty "Laden" ...            # BLOCK: OFAC + UN listed
    node --env-file=.env preflight.mjs ... --down                            # HOLD: simulated miner outage

Individual checks: guard.mjs, screen.mjs, urlcheck.mjs. Raw paid call helper: ask.mjs. Logs: evidence/*.jsonl.

## Limitations (honest)
- Testnet only; no production traffic or customer adoption.
- Sanctions check is exact-name only; OFAC lists "LAZARUS GROUP" but the UN miner did not, so list coverage differs.
- OFAC and UN miners share one host. ProofGate and URL Sentinel may overlap in what they check.
- The BLOCK link demo uses a synthetic suspicious URL, not live malware (the URLhaus feed is gone).
- TxLens answers appear cached at times.
- The per-run spend cap is checked after payment, not enforced before; TODO.
- preflight.mjs wraps the other scripts by parsing their output; a shared module is the next step.
- --down simulates an outage by pointing one voter at a nonexistent miner id.
- Submitted URLs go to third-party miners: do not scan private URLs.
