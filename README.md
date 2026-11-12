# tgp-guard: pre-flight guard for autonomous agents

Before an agent acts (swap, pay, click), tgp-guard buys independent checks through Telegraph and returns one verdict: ALLOW / HOLD / BLOCK, with every receipt attached.

Network: Ethereum Sepolia testnet (eip155:11155111), x402, ~$0.01 per answer, via devnode.telegraphprotocol.com. Payment asset: USD Coin 0xcc194e1a843B658526D0D5C431f670028582Ae17 (test token, open mint — see Run). Failed calls are not charged: a settled payment for a failed request is credited to your Telegraph escrow balance instead.

> Season II refresh (2026-11-03): the devnode moved from Base Sepolia to Ethereum Sepolia since Season I, and @x402 v2.28 rejects non-default assets unless they are allowlisted. The client now calls setSpendControls() with the payment token allowlisted and capped at exactly 10000 atomic units ($0.01) per payment. CoinGecko miner 21002 was retired by the network and replaced with 32001 (same /query interface). ProofGate 7402 was also retired; on 2026-11-03 a systematic probe of all 19 URL_SCAN miners in the directory found a qualifying third voter — PREFLIGHT Infrastructure Signals 20260828 (GET /url-safe) — and the link check returns full verdicts again (first 3/3-CLEAN ALLOWs the same day). Full probe record: LINKCHECK-FINDINGS.md. A fourth check was added the same day: contract audit (audit.mjs) buying GoPlus Security token-risk data and Sourcify source verification (SMART_CONTRACT_AUDIT). Live re-verification logs: evidence/season2-refresh/.
>
> Update (2026-11-11): the third link voter's verdict vocabulary drifted ("Safe" instead of "not_listed") and briefly turned every link check into a HOLD — fixed the same day in urlcheck.mjs, re-verified live (3/3 CLEAN ALLOW on github.com and example.com). The sanctions screen gained a second-opinion voter the same day: Counterproof 731002 screens US OFAC + UN + EU + UK lists in one ask (GET /screen); a Counterproof-only signal HOLDs for human review and never overrides an OFAC/UN hit. Fresh full-preflight ALLOW re-verified 2026-11-11: 9 paid answers, ~$0.09.
>
> Update (2026-11-12): the Counterproof-only HOLD path is now live-tested. "Roman Abramovich" — listed on the EU and UK lists only (verified at EUR-Lex and OFSI; absent from the OFAC SDN and UN Consolidated lists downloaded the same day) — returned HOLD: Counterproof REVIEW while OFAC + UN both cleared. Full record: evidence/counterproof-hold-2026-11-12.md.

## Checks (each fires multiple independent miners and compares)
| Check | Intent | Miners | Rule |
|---|---|---|---|
| Price | CRYPTO_PRICE | TxLens 9002, CoinGecko 32001, Kraken 190076 | spread >0.5% HOLD, >2% BLOCK; quote >1% off median BLOCK |
| Sanctions | SANCTIONS_SCREENING_MATCH | OFAC SDN 78021, UN list 78022, Counterproof 731002 (US/UN/EU/UK second opinion) | any OFAC/UN hit BLOCK; Counterproof-only hit or REVIEW HOLD; list unavailable HOLD |
| Link | URL_SCAN | URL Sentinel 5001, NetWire 7334, PREFLIGHT 20260828 (replaced ProofGate 7402, retired) | 2+ flags BLOCK; 1 flag or unknown HOLD |
| Contract audit | SMART_CONTRACT_AUDIT | GoPlus Security 200001, Sourcify 200002 | critical risk flag (honeypot, >10% tax, unverified source…) BLOCK; risk data + verified source ALLOW; either source unable to assess HOLD |

Fails closed: a missing source never produces ALLOW (price quorum 2-of-3 only with --quorum2).

## Mission use cases (each is its own working, testable flow)
- **Mission 14 — pre-flight (the core):** `preflight.mjs --asset bitcoin --counterparty "Acme Bakery" --url https://github.com` — price + sanctions + link in one verdict. Live 2026-11-11: ALLOW, 9 paid answers, ~$0.09.
- **Mission 01 — pre-swap check:** `swap.mjs --asset bitcoin --quote 74400 --counterparty "Acme Bakery" --contract 0xdAC17F958D2ee523a2206206994597C13D831ec7` — price integrity + counterparty sanctions + token contract audit before a swap executes. Live 2026-11-11: ALLOW, 8 paid answers, ~$0.08 (logs: evidence/swap-log.jsonl).
- **Mission 02 — stablecoin acceptance:** `stablecoin.mjs --payer "Acme Bakery" --token USDT --contract 0xdAC17F958D2ee523a2206206994597C13D831ec7` — payer sanctions screen + token contract audit + reserve attestation bought from por-attest miner 27741 (GET /reserve). Live 2026-11-11: ALLOW, 6 paid answers, ~$0.06 — USDT fully backed, ratio 1.0434 as of 2026-09-30 (BDO ISAE 3000R). Logs: evidence/stablecoin-log.jsonl. Note: the first two runs that night held on transient miner settlement 402s (UN list + GoPlus) and cleared on retry — the guard fails closed, and the HOLDs are in the log.

## Run
    npm i
    echo "EVM_PRIVATE_KEY=0x<burner testnet key>" > .env   # never reuse a real wallet
    # fund the burner on Ethereum Sepolia: a little Sepolia ETH for gas, plus test USDC.
    # The payment token is an open-mint test token: call mint(address,uint256) on
    # 0xcc194e1a843B658526D0D5C431f670028582Ae17 from the burner (20 USDC is plenty).
    node --env-file=.env preflight.mjs --asset bitcoin --counterparty "Acme Bakery" --url https://github.com
    node --env-file=.env preflight.mjs --asset bitcoin --quote 79000 ...     # BLOCK: off-market quote
    node --env-file=.env preflight.mjs --counterparty "Laden" ...            # BLOCK: OFAC + UN listed
    node --env-file=.env preflight.mjs --contract 0xdAC17F958D2ee523a2206206994597C13D831ec7   # audit check (USDT): ALLOW
    node --env-file=.env preflight.mjs ... --down                            # HOLD: simulated miner outage

Individual checks: guard.mjs, screen.mjs, urlcheck.mjs, audit.mjs. The audit check takes a contract
address and an optional --chain (ethereum default; also bsc, base, arbitrum, polygon, optimism, sepolia):
    node --env-file=.env audit.mjs 0xdAC17F958D2ee523a2206206994597C13D831ec7
Raw paid call helper: ask.mjs. Logs: evidence/*.jsonl.

## Privacy
tgp-guard has no accounts and collects nothing in the background. Each check is a single per-request ask, and it sends only the minimum that check needs — a name for a sanctions screen, a URL for a link scan, a quote for a price check, a contract address for an audit — to the Telegraph miners performing that check, and nothing else. No account is ever created or stored, and run history lives only in the local run log (`evidence/*.jsonl`) that you control. One honest caveat: the miners are third parties, so do not scan a private URL or a name you would not want a checker to see.

## Limitations (honest)
- Testnet only; no production traffic or customer adoption.
- Sanctions check is exact-name only; OFAC lists "LAZARUS GROUP" but the UN miner did not, so list coverage differs. The Counterproof second opinion (added 2026-11-11) uses fuzzy matching across four lists and can disagree with the exact-name miners: live 2026-11-11 it cleared "Laden" (confidence 0.207) while OFAC + UN both listed it. A Counterproof-only signal therefore HOLDs for human review instead of BLOCKing, and its CLEAR never overrides an OFAC/UN hit. The Counterproof-only HOLD path was live-tested 2026-11-12: "Roman Abramovich" (EU + UK listed only) returned HOLD on a Counterproof REVIEW with OFAC + UN clear (evidence/counterproof-hold-2026-11-12.md).
- OFAC and UN miners share one host. URL Sentinel and NetWire may overlap in what they check.
- Link check's third voter (PREFLIGHT 20260828) was found on 2026-11-03 after probing all 19 URL_SCAN miners in the directory (LINKCHECK-FINDINGS.md); one of its own upstream feeds (URLhaus) was unavailable in its answers, so its CLEAN rests on OpenPhish + Cloudflare DNS. If it leaves the network the check fails closed to HOLD again. Its verdict vocabulary drifted by 2026-11-11 ("Safe" instead of "not_listed"), which briefly turned every link check into a HOLD; urlcheck.mjs now accepts both spellings, re-verified live the same day (3/3 CLEAN ALLOW on github.com and example.com).
- Contract audit covers chains GoPlus has token data for (Ethereum by default); on chains without GoPlus data (e.g. Sepolia) it returns HOLD, and a contract with no Sourcify record cannot be ALLOWed. Owner controls common on established tokens (mintable, pausable, blacklist — USDT has all three) are reported as notes, not blockers; only critical flags block.
- The BLOCK link demo uses a synthetic suspicious URL, not live malware (the URLhaus feed is gone).
- TxLens answers appear cached at times.
- The per-run spend cap is checked after payment, not enforced before; the per-payment cap IS enforced before payment via setSpendControls (Season II refresh).
- preflight.mjs wraps the other scripts by parsing their output; a shared module is the next step.
- --down simulates an outage by pointing one voter at a nonexistent miner id.
- Submitted URLs go to third-party miners: do not scan private URLs.
