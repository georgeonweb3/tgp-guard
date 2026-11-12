# Public updates — Telegraph Hackathon Season II (tgp-guard)

Drafted 2026-11-03. Update 1 POSTED by George on 2026-11-03: https://x.com/georgebuilding2/status/2117663766133219719 (Muse could not post it directly — X temporarily rate-limited the browser sign-in). @Telegraphprotoc retweeted the thread the same day. Rules ask for ~3 meaningful updates on separate dates (introduce → progress → demo), tagging @Telegraphprotoc on X, linking the repo/mission, and disclosing hackathon participation + prize incentive.

---

## Update 1 (X thread — shortened to fit, final)

**1/** (attach card-1-preflight.png)
Autonomous agents act first and ask questions later. I'm building the opposite for @Telegraphprotoc Season II: tgp-guard — a pre-flight guard that buys checks (price, sanctions, links) before an agent swaps, pays or clicks. ALLOW / HOLD / BLOCK, receipts attached.

**2/** (attach card-2-sanctions-block.png)
Live on testnet (Ethereum Sepolia):
• BTC price: 3/3 miners agree within 0.14% → ALLOW
• Sanctions: 'Laden' listed on OFAC + UN → BLOCK
• Quote 35% off-market → BLOCK
Full preflight: 7 paid answers, ~$0.07, capped at $0.01 per payment.

**3/** (no image)
Mission 14 (Web3 Native & DeFi) — also serving Missions 01 + 02. Code, honest limitations and run logs with receipt hashes are public. Reproduce it yourself:
https://github.com/georgeonweb3/tgp-guard
(Telegraph Hackathon Season II prize entry)

**4/** (attach guild-telegraph-10000-124.png)
Also in: Telegraph 10,000 member #124, Hacker role held. Build in public, prove it works. @Telegraphprotoc

---

## Update 2 (X thread — POSTED by George 2026-11-11 ~22:02 WAT)

Post 1: https://x.com/georgebuilding2/status/2120623156947755307 — graphic tgp-guard-link-check.png attached. **@Telegraphprotoc liked AND reposted it** (verified via fxtwitter: 1 like, 1 repost, 1 reply). Posts 2–3 as drafted below.

**1/**
The guard caught a real break today. My third link-scan voter silently changed its verdict word, and every link check failed closed to HOLD. Fixed and re-verified live within the hour. A silent upstream change surfaced as a HOLD, never as a false ALLOW. @Telegraphprotoc

**2/**
Sanctions now has a second opinion: Counterproof screens US/UN/EU/UK in one ask. It cleared "Laden" while OFAC + UN listed it — the disagreement is recorded in the verdict, and a CLEAR never overrides a list hit.
https://github.com/georgeonweb3/tgp-guard

**3/**
Fresh tonight: full preflight ALLOW, 9 paid answers, ~$0.09. The showcase thread is up in the Telegraph Discord. (Telegraph Hackathon Season II prize entry)

## Update 3 (X thread — drafted 2026-11-11, demo-focused, for George to post from his phone)

**Status 2026-11-12: still UNCONFIRMED as posted** (reminded 10:00 WAT today, 2026-11-12). George posts from his phone; do not mark it posted unless confirmed.

**1/** (157 chars X-counted)
The tgp-guard demo is live. Replay real runs in your browser, every verdict with its receipt hash. No slides, just the guard working: https://georgeonweb3.github.io/tgp-guard/

**2/** (182 chars X-counted)
What's inside: full preflight ALLOW, 9 paid answers, ~$0.09. Link-scan fix, Counterproof second opinion, pre-swap + stablecoin checks for Missions 01 and 02. https://github.com/georgeonweb3/tgp-guard

**3/** (111 chars)
Try it yourself, the code and run logs are public. (Telegraph Hackathon Season II prize entry) @Telegraphprotoc

## Discord milestone post (#hackers / milestone channel, before Nov 14)

**First Integration Milestone — tgp-guard (Apps & Agents, Missions 14 / 01 / 02)**

Hi all — I'm George (GitHub georgeonweb3). My Season I project tgp-guard is back for Season II, and its first working Telegraph purchases for this season are done and logged.

**What it is:** a pre-flight guard for autonomous agents. Before an agent swaps, pays or clicks, it buys independent checks through Telegraph and returns one verdict — ALLOW / HOLD / BLOCK — with a receipt for every check:
• Price cross-check — TxLens 9002, CoinGecko 32001, Kraken 190076
• Sanctions screen — OFAC SDN 78021, UN Consolidated 78022
• Link scan — URL Sentinel 5001, NetWire 7334

**What it took to get here (Season II changes):** the devnode now settles on Ethereum Sepolia (not Base Sepolia), in test USDC 0xcc194e1a843B658526D0D5C431f670028582Ae17; @x402 v2.28 needs `setSpendControls()` allowlisting or every payment is rejected — the guard now caps spend at exactly $0.01 per payment, enforced before paying. Dead miners swapped (CoinGecko 21002 → 32001).

**Live results (Nov 3, receipts in repo):**
• Price BTC — ALLOW, 3/3 sources within 0.12%
• Sanctions "Acme Bakery" — ALLOW; "Laden" — BLOCK (OFAC + UN)
• Off-market quote ($50,000 vs $77,217 median) — BLOCK
• Link check — HOLD: both live voters clean, but ProofGate 7402 left the network, so the check fails closed until a compatible third URL voter exists (if anyone knows one that answers POST /scan, I'd love the pointer)
• Cost: ~$0.07 for a full preflight; failed asks weren't billed (escrow credit)

**Try it / evidence:** https://github.com/georgeonweb3/tgp-guard — see README for run steps and `evidence/season2-refresh/` for the jsonl logs with receipt hashes. Feedback and reproductions very welcome.

Next up: a third URL voter, the shared-module refactor, and the demo recording.

---

## Update 4 (X thread — DRAFT, drafted 2026-11-12, for George to post from his phone before the Nov 20 community showcase)

Announces the interactive demo + the Counterproof-only HOLD path live test + the privacy line. Tags @Telegraphprotoc. Character counts are X-counted (URLs count as 23 chars, images cost nothing). NOT posted anywhere.

**1/** (224 chars X-counted)
The tgp-guard demo is now interactive. Replay real paid runs in your browser: full preflight ALLOW, the 'Laden' BLOCK, the off-market quote BLOCK, every verdict with its receipt hash. https://georgeonweb3.github.io/tgp-guard/ @Telegraphprotoc

**2/** (257 chars X-counted)
New live test: the Counterproof-only HOLD path works. 'Roman Abramovich' is listed on the EU + UK lists only, clear on OFAC + UN, and returned HOLD on a Counterproof REVIEW. An EU/UK-only listing held for review, never a false ALLOW. https://github.com/georgeonweb3/tgp-guard

**3/** (251 chars X-counted)
Privacy, stated plainly: each check sends only the minimum it needs, a name, a URL, a quote, to the miners running that check. No accounts, no background collection. Run history lives only in your local log. (Telegraph Hackathon Season II prize entry)

**4/** (192 chars X-counted)
Try it before the Nov 20 community showcase: clone the repo, fund a Sepolia burner, run one preflight. Code, run logs and honest limits are all public. https://github.com/georgeonweb3/tgp-guard @Telegraphprotoc
