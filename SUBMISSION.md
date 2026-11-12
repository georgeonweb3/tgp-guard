# Telegraph Hackathon Season II — Submission Draft (prepared 2026-11-03, not yet submitted)

- **Project:** tgp-guard — pre-flight guard for autonomous agents
- **Repo:** https://github.com/georgeonweb3/tgp-guard (Season II refresh merged to main, PR #1 / merge commit 9fa5b66)
- **Track:** Apps & Agents
- **Builder:** George Agbe (GitHub georgeonweb3; Discord cryptomillionaire9138; X @georgebuilding2) — registered, Hacker role claimed on Guild
- **Network actually used:** Telegraph devnode on Ethereum Sepolia (eip155:11155111), x402 "exact" scheme, test USDC 0xcc194e1a843B658526D0D5C431f670028582Ae17, $0.01 per answer

## Chosen missions
- **Primary — Mission 14, Web3 Native and DeFi.** Its example build buys drainer/bytecode analysis *before committing capital*. tgp-guard is the same pattern generalised: an agent must pass independent, paid checks (price integrity, sanctions exposure, link safety) and receives ALLOW / HOLD / BLOCK before it acts, with a receipt for every check.
- **Also claimed — Mission 01, Exchange.** The listings desk buys "contract audit, contributor authenticity, holder concentration and sanctions exposure in parallel." tgp-guard's sanctions screen (OFAC SDN + UN Consolidated) and multi-source price cross-check are directly that class of pre-listing / pre-trade evidence, returned as one signed-off verdict with receipts and a cost line.
- **Also claimed — Mission 02, Stablecoin.** "Compliance screening attached to the payment itself as a proof": every tgp-guard verdict is backed by per-check Telegraph receipts, and the x402 spend is hard-capped per payment ($0.01 via client spend controls) — screening and spend discipline travel with the transaction.

Each mission claim is testable separately, and each now has its own working flow with its own live run (2026-11-11, logs in evidence/):
- **Mission 14:** `preflight.mjs` — full preflight ALLOW, 9 paid answers, ~$0.09.
- **Mission 01:** `swap.mjs` — pre-swap check (price + counterparty sanctions + token audit) ALLOW, 8 paid answers, ~$0.08.
- **Mission 02:** `stablecoin.mjs` — stablecoin acceptance (payer sanctions + token audit + por-attest reserve attestation: USDT fully backed, ratio 1.0434 as of 2026-09-30) ALLOW, 6 paid answers, ~$0.06. Its first two runs held on transient miner settlement 402s and cleared on retry; the HOLDs are in the log.

## What it does
Before an agent swaps, pays, or clicks, tgp-guard buys independent checks through Telegraph and returns one verdict:
- **Price check** (CRYPTO_PRICE): TxLens 9002, CoinGecko 32001, Kraken 190076. Spread >0.5% HOLD, >2% BLOCK, quote >1% off median BLOCK.
- **Sanctions screen** (SANCTIONS_SCREENING_MATCH): OFAC SDN 78021, UN Consolidated 78022, plus Counterproof 731002 as second opinion (added 2026-11-11; one ask screens US OFAC + UN + EU + UK lists with fuzzy matching, GET /screen). Any OFAC/UN hit BLOCK; a Counterproof-only hit or REVIEW HOLDs for human review; a list unavailable HOLDs. Live 2026-11-11 the voters disagreed honestly on "Laden": OFAC + UN listed it (BLOCK) while Counterproof cleared it (confidence 0.207) — the disagreement is recorded in the verdict line, and the CLEAR never overrides a list hit. Live 2026-11-12 the Counterproof-only HOLD path was tested with "Roman Abramovich" (EU + UK listed only, verified absent from OFAC SDN and UN lists): HOLD on a Counterproof REVIEW with OFAC + UN clear — full record in evidence/counterproof-hold-2026-11-12.md.
- **Link check** (URL_SCAN): URL Sentinel 5001, NetWire 7334, PREFLIGHT 20260828. 2+ flags BLOCK; 1 flag or unknown HOLD. (Third voter ProofGate 7402 was retired by the network; a systematic probe of all 19 URL_SCAN miners in the directory on 2026-11-03 found PREFLIGHT as a qualifying replacement — full record in LINKCHECK-FINDINGS.md.)
- **Contract audit** (SMART_CONTRACT_AUDIT): GoPlus Security 200001 (honeypot, tax, ownership, proxy and mint flags) + Sourcify 200002 (verified source). Any critical risk flag BLOCK; risk data clean *and* source verified ALLOW; either source unable to assess HOLD. This is Mission 14's "analysis before committing capital" bought directly, and the "contract audit" item in Mission 01's listings-desk brief.
Fails closed throughout: a missing source never produces ALLOW.

## Verified live results (2026-11-03, event period; logs in evidence/season2-refresh/)
- Price, bitcoin: **ALLOW** — 3/3 sources agreed within 0.12%
- Sanctions, "Acme Bakery": **ALLOW** — no match on either list
- Sanctions, "Laden": **BLOCK** — listed on OFAC SDN and UN Consolidated
- Price, bitcoin quoted $50,000 vs $77,217 median: **BLOCK** — 35.25% off-market
- Link, https://github.com: **HOLD** in the morning run — both live voters CLEAN, third seat empty (fails closed); after PREFLIGHT 20260828 was added as third voter the same day: **ALLOW** — 3/3 CLEAN (also ALLOW for https://example.com)
- Contract audit, USDT 0xdAC17F958D2ee523a2206206994597C13D831ec7 (Ethereum): **ALLOW** — no critical flags from GoPlus (owner controls noted: mintable, pausable, blacklist — not blocking), source verified on Sourcify; repeated run gave the identical verdict
- Contract audit, Sepolia test USDC 0xcc194e1a843B658526D0D5C431f670028582Ae17: **HOLD** — GoPlus has no risk data for that chain and Sourcify has no verified source on file (fails closed)
- Full preflight with all four checks (price + sanctions + link + audit): **ALLOW**, 10 paid answers, ~$0.10 total (the three-check version is 7 answers, ~$0.07). Failed miner asks are not billed (escrow credit).
- **Re-verified live 2026-11-11 (new receipts, same logs):** full three-check preflight **ALLOW** — price 3/3 within 0.01%, sanctions "Acme Bakery" 3/3 clear (incl. Counterproof), link 3/3 CLEAN — 9 paid answers, ~$0.09. "Laden" **BLOCK** (OFAC + UN listed; Counterproof second opinion CLEAR, recorded). Quote $50,000 vs $74,415 median **BLOCK** (32.81% off-market). The link check had broken the same day — the third voter's verdict changed from "not_listed" to "Safe" and every link check failed closed to HOLD — and was fixed and re-verified live within the hour (3/3 CLEAN ALLOW on github.com and example.com). This is the guard working as designed: a silent upstream change surfaced as a HOLD, never as a false ALLOW.
- **Live 2026-11-12 (Counterproof-only HOLD path, previously untested):** sanctions "Roman Abramovich" **HOLD** — Counterproof REVIEW, OFAC + UN clear. The name was verified at official sources before the run: listed on the EU list (Reg. 269/2014 Annex I, entry 879, EUR-Lex) and the UK OFSI list (designated 10/03/2022, Group ID 14212), and absent from the OFAC SDN list (full XML, published 11/09/2026) and the UN Consolidated list (full XML) downloaded the same day. 3 paid answers, ~$0.03. Full record: evidence/counterproof-hold-2026-11-12.md.

## How to run it (reproduction)
    npm i
    echo "EVM_PRIVATE_KEY=0x<burner testnet key>" > .env    # never a real wallet
    # Fund the burner on Ethereum Sepolia: a little Sepolia ETH for gas, and mint test USDC —
    # the payment token 0xcc194e1a843B658526D0D5C431f670028582Ae17 is open-mint (mint(address,uint256)); 20 is plenty.
    node --env-file=.env preflight.mjs --asset bitcoin --counterparty "Acme Bakery" --url https://github.com
    node --env-file=.env preflight.mjs --contract 0xdAC17F958D2ee523a2206206994597C13D831ec7   # expect ALLOW (contract audit)
    node --env-file=.env preflight.mjs --counterparty "Laden"          # expect BLOCK
    node --env-file=.env screen.mjs "Roman Abramovich"                 # expect HOLD (Counterproof REVIEW; OFAC/UN clear — EU/UK-only listing)
    node --env-file=.env guard.mjs bitcoin 50000                        # expect BLOCK (off-market quote)
Full instructions in README.md, including honest limitations.

## Commercial summary (Section 8 questions)
- **Who is the buyer, how often?** Any team running autonomous agents that move money or follow links — trading bots, payment agents, browser agents. The problem occurs before *every* consequential action, i.e. continuously.
- **Demo flow:** (1) Problem — an agent is about to act on an unverified price/counterparty/link. (2) Telegraph request — preflight fires paid asks across independent miners. (3) Intelligence + Provider evidence — per-miner answers with receipt hashes. (4) Observed cost — ~$0.01 per answer, ~$0.07 per full preflight, hard-capped per payment by client spend controls. (5) Completed result — one ALLOW / HOLD / BLOCK verdict with receipts attached. (6) How to try it — clone the repo, fund a Sepolia burner as above, run the three commands.
- **Honest labels:** all results are testnet; no production customers yet; testnet use is not presented as paying production usage.

## Demo (to record before Dec 1)
2–5 min screen recording script: run the happy-path four-check preflight (price + sanctions + link + contract audit, all ALLOW), then the "Laden" BLOCK, then the off-market-quote BLOCK; show one evidence/*.jsonl entry and its receipt hashes; close with the spend total.

## Milestones
- **Nov 14 First Integration Milestone:** already satisfied in substance — first working Telegraph purchases made 2026-11-03 with receipts in evidence/season2-refresh/. Share in Discord before Nov 14.
- **Dec 1, 23:59 UTC:** final submission through the H2 website with this document's fields, the demo video, and showcase permissions.

## Privacy
tgp-guard has no accounts and collects nothing in the background. Each check is a single per-request ask, and it sends only the minimum that check needs — a name for a sanctions screen, a URL for a link scan, a quote for a price check, a contract address for an audit — to the Telegraph miners performing that check, and nothing else. No account is ever created or stored, and run history lives only in the local run log (`evidence/*.jsonl`) that you control. One honest caveat: the miners are third parties, so do not scan a private URL or a name you would not want a checker to see.

## Anjoman listing status
- Listing: https://anjoman.ai/dashboard/apps/mine/87a25a1c-31d5-41e3-9906-462152567cae (live-app link https://georgeonweb3.github.io/tgp-guard/ added via Edit on 2026-11-11; status was "In review" on 2026-11-11).
- anjoman status (checked 2026-11-12): still to verify in a signed-in browser. A plain text fetch of the dashboard page returns only the generic edit-page header and no review status, and no public listing was found in search. Not claimed as approved or public.

## Limitations (honest)
- Testnet only; no production traffic or customer adoption yet.
- Link check has 3 live voters again (PREFLIGHT 20260828 replaced the retired ProofGate on 2026-11-03), but one of PREFLIGHT's own upstreams (URLhaus) reported unavailable in its answers; if PREFLIGHT leaves the network the check fails closed to HOLD again.
- Contract audit depends on GoPlus chain coverage: on chains where GoPlus has no token data (e.g. Sepolia) the audit returns HOLD, and unverified-source contracts cannot be ALLOWed.
- Sanctions screening is exact-name only; list coverage differs between OFAC and UN miners, which share one host. Counterproof (added 2026-11-11) adds EU/UK coverage with fuzzy matching; its CLEAR on "Laden" vs OFAC+UN BLOCK is a live, documented disagreement, and the Counterproof-only-hit HOLD path was live-tested 2026-11-12 ("Roman Abramovich": EU + UK listed only, Counterproof REVIEW, OFAC + UN clear → HOLD; evidence/counterproof-hold-2026-11-12.md).
- Per-run spend cap is summarised after the run; the per-payment cap ($0.01) IS enforced before payment via setSpendControls.
- preflight.mjs parses the sub-scripts' output; a shared module is the next refactor.
