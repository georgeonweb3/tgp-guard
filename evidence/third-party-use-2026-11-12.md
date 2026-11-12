# tgp-guard — verified third-party use log

Sprint #2, Telegraph Hackathon Season II (final Dec 1, 2026 23:59 UTC). Workstream 1: offer free live preflight checks to other Telegraph builders in the Discord #hackers channel; every run is real (paid x402 answers on Sepolia test USDC, burner wallet only, max $0.01 per payment) and logged here with its receipt hash(es).

Offer posted: **not yet — draft only.** The #hackers post still needs the parent agent's browser to publish (see `discord-offer-draft.md` for the exact text). Third-party takers so far: **0**.

## The offer (as drafted 2026-11-12)

> Hey hackers — quick offer while I'm building tgp-guard, a preflight guard for agents on Telegraph: I'll run a free live check on anything you're about to touch.
>
> Drop a contract address, a link, or a counterparty name in this thread and I'll run the real guard on it — sanctions screen (OFAC / UN / EU / UK via Counterproof), link safety, or contract audit — and post the verdict + the on-chain receipt hash back here.
>
> Costs you nothing. It runs on Sepolia test USDC, ~$0.06–0.09 of test funds per full preflight, paid from my burner. No wallet connect, no sign-up, no DM needed — just reply here.
>
> Demo: https://georgeonweb3.github.io/tgp-guard/

## Third-party runs

| # | Who | What was checked | Verdict | Receipt hash(es) | Thread reply |
|---|-----|------------------|---------|------------------|--------------|
| — | — | — | — | — | — |

*No third-party runs yet. Add one row per reply, with a link to the thread reply.*

## Self-test (NOT third-party use — pipeline readiness check only)

Run 2026-11-12 10:30 UTC by Muse (subagent) to verify the pipeline works before real replies arrive. Command: `node preflight.mjs --counterparty "Maple Street Coffee Roasters" --url https://georgeonweb3.github.io/tgp-guard/`. Raw logs: `evidence/preflight-log.jsonl`, `evidence/screen-log.jsonl`, `evidence/url-log.jsonl`.

| # | Who | What was checked | Verdict | Receipt hash(es) | Thread reply |
|---|-----|------------------|---------|------------------|--------------|
| S1 | **SELF-TEST** (Muse, not a third party) | Sanctions screen: "Maple Street Coffee Roasters" (OFAC SDN / UN Consolidated / Counterproof) | **ALLOW** — no match on any list | `0xccad7c6f645657365730b18cfef916ff2992a7795429689b9b1885dc9aa20758`, `0xd1a672565db982693749b158e4d834583ba581ef8b16f5e580445d51e014c3e0`, `0xa5e9c263f2e44cc3e57703741285e6c45e2eed65ad00278fd9154eb6118189a2` | n/a (self-test) |
| S1 | **SELF-TEST** (Muse, not a third party) | Link check: https://georgeonweb3.github.io/tgp-guard/ (Preflight / URLSentinel / NetWire) | **ALLOW** — no flags from 3/3 sources | `0xf030afe53ea3a0b52151175503f59a602089eb4b4e2caa83fafcaf50c42a65b9`, `0x864813a13e297bfa7e498c2f2236d5cbc93577e0ba966903edbcc847194644b2`, `0x22cfb15ca281605657692f63ba65af6ce24b8decdf1aef6714981d240da92910` | n/a (self-test) |

Overall self-test: **PREFLIGHT: ALLOW**, 6 paid answers, ~$0.06 test USDC.
