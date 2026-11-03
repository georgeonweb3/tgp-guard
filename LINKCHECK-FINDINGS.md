# Link check: the search for a third voter (2026-11-03)

## Background
The link check (urlcheck.mjs) was designed for three independent voters. ProofGate (7402)
was retired by the network, leaving URL Sentinel (5001) and NetWire (7334). With one seat
empty the check failed closed: it could return HOLD or BLOCK, never ALLOW. This document
records the systematic search for a replacement across every miner tagged URL_SCAN in the
live directory (GET https://devnode.telegraphprotocol.com/engine/v1/miners — 1,909 miners,
19 tagged URL_SCAN), probed with the test URL https://github.com via the project's ask.mjs.

A voter qualifies only if it (a) accepts the URL we pass (not a fixed domain), and
(b) returns a clear per-URL safety assessment parseable into CLEAN / SUSPICIOUS.

## Result: third voter found
**PREFLIGHT Infrastructure Signals (20260828)** — added to urlcheck.mjs as the third voter.
- Endpoint used: `GET /url-safe` with payload `{"url": "..."}`.
- Returns `result.verdict` ("not_listed" for both https://github.com and
  https://example.com) plus a per-source breakdown (`sources[]` with `listed` booleans for
  OpenPhish and Cloudflare Security DNS; its URLhaus source reported "feed unavailable").
- Classification in urlcheck.mjs: `verdict === "not_listed"` and no source listing → CLEAN;
  any source `listed: true` or a "listed" verdict → FLAG; anything else → UNKNOWN (fails closed).
- It also declares a richer `GET /url-scan` endpoint (risk_score, redirect chain, TLS and
  header analysis; risk_score 0 for github.com) — verified working, kept as a future upgrade.
- Live after the change: urlcheck.mjs returned **ALLOW (3/3 CLEAN)** for both
  https://github.com and https://example.com — the first full link-check ALLOWs since
  ProofGate retired. Logs: evidence/season2-refresh/url-log.jsonl.

## Every URL_SCAN miner probed, and what happened

| Miner | Endpoint(s) tried | Outcome |
|---|---|---|
| 5001 URL Sentinel | POST /scan `{url}` | **Voter (existing).** verdict "safe" → CLEAN. |
| 7334 NetWire | GET /url-scan `{url}` | **Voter (existing).** `safe=true, risk=no_indicators_found` → CLEAN. |
| 20260828 PREFLIGHT | GET /url-safe, GET /url-scan `{url}` | **Voter (new).** See above. Declares 20 endpoints; /url-safe gives a parseable per-URL verdict. |
| 7402 ProofGate | POST /scan | Retired — no longer in the directory. |
| 11 URL Scan (URLhaus) | POST /scan (not declared); POST /check-url `{url}`; POST /check-host `{host}` | Declared endpoints are /check-url and /check-host, but both return upstream **401 Unauthorized** (URLhaus now requires an auth key the miner does not supply). Dead in practice. |
| 53003 URLScan github.com | GET /query `{url}` → 400 `"url" is not allowed`; GET /query `{}` → 200 | Fixed-domain urlscan.io *search* miner: ignores any target URL and returns a dump of recent urlscan.io results (no verdict, unrelated pages). Cannot assess an arbitrary URL. |
| 53001 URLScan example.com | GET /query `{url}` | Identical 400 ValidationError — same fixed-domain pattern. |
| 53007 URLScan amazon.com | GET /query `{url}` | Identical 400 ValidationError — same fixed-domain pattern. |
| 53010 URLScan discord.com | GET /query `{url}` | Identical 400 ValidationError — same fixed-domain pattern. |
| 53002 / 53004 / 53005 / 53006 / 53008 / 53009 (google / paypal / microsoft / apple / cloudflare / reddit) | — | Same miner family: identical slug template, description ("urlscan.io search for <domain>") and declared /query shape as the four probed directly; fixed-domain search, no per-URL verdict. Not probed individually. |
| 5530 Telegraph Verity Intelligence | /scan, /query shapes | Research/fact-check provider; no per-URL safety verdict in a parseable form. (Probed in the earlier 2026-11-03 sweep.) |
| 152 Kriterion-Pramagraph | /query shapes | Research/financial intelligence; no URL verdict. (Earlier sweep.) |
| 4433 LiveCert | /query shapes | General sourced-answer provider; no URL-scan verdict interface. (Earlier sweep.) |
| 302 ChainSight | /query shapes | Universal oracle; no dedicated URL verdict endpoint matched. (Earlier sweep.) |
| 9002 TxLens | GET /query | Market/on-chain provider (already used by guard.mjs as a price voter via /crypto-price); no URL verdict. (Earlier sweep.) |

Note on method: several miners reveal their declared endpoints in the error returned for an
undeclared one (`endpoint "..." is not declared by miner "..."; declared endpoints: ...`).
That is how /url-safe and /url-scan (20260828) and /check-url and /check-host (11) were found.

## Fallback plan (not needed now, kept for the record)
If the third seat ever empties again and no directory miner qualifies, the fallback is to
register our own URL-scan miner as a Provider (Track 1): a small service wrapping URLhaus /
OpenPhish / Google Safe Browsing lookups behind the same /scan `{url}` → verdict interface
ProofGate used, so urlcheck.mjs regains a voter we control and the project also gains a
Provider-track entry. Miner 11's 401 shows the main operational risk of that plan: upstream
feed credentials must be maintained, or the miner dies silently.
