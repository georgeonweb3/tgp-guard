# Counterproof-only HOLD path — live test (2026-11-12)

## What was tested

The sanctions screen's Counterproof-only path: a name listed ONLY on an EU or UK
list (not OFAC SDN, not UN Consolidated) should produce **HOLD** — Counterproof
REVIEW (or HIT) while the OFAC and UN exact-name miners clear — instead of ALLOW
or BLOCK. The path was code-reviewed on 2026-11-11 but had never been live-tested:
no EU/UK-only listed name had been tried.

## Candidate: Roman Abramovich

Screened as `"Roman Abramovich"` (EU listing name: Roman Arkadyevich ABRAMOVICH,
entry 879, DOB 24.10.1966).

### Official-source list status (checked 2026-11-12, before the run)

| List | Status | Official source |
|---|---|---|
| EU consolidated (Reg. 269/2014, Annex I) | **LISTED** — entry 879, added 15.3.2022 | Council Implementing Regulation (EU) 2022/427, EUR-Lex: https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32022R0427 — entry confirmed still in force by Implementing Regulation (EU) 2023/806: https://eur-lex.europa.eu/eli/reg_impl/2023/806 ; General Court upheld the listing 2026-09-09 (Case T-358/25) |
| UK OFSI Consolidated List | **LISTED** — designated 10/03/2022, Group ID 14212, UK ref RUS0270 | OFSI Financial Sanctions Notice 10/03/2022 (Russia): https://www.gov.uk/government/publications/financial-sanctions-consolidated-list-of-targets/consolidated-list-of-targets ; notice PDF (National Archives): https://webarchive.nationalarchives.gov.uk/ukgwa/20220310185330mp_/https:/assets.publishing.service.gov.uk/government/uploads/system/uploads/attachment_data/file/1059928/notice_russia_100322.pdf |
| US OFAC SDN | **ABSENT** — 0 matches for "abramovich" in the full list | OFAC SDN XML downloaded 2026-11-12 from https://www.treasury.gov/ofac/downloads/sdn.xml (Publish_Date 11/09/2026, 19,563 records), case-insensitive grep |
| UN Consolidated | **ABSENT** — 0 matches for "abramovich" in the full list | UN Consolidated List XML downloaded 2026-11-12 from https://scsanctions.un.org/resources/xml/en/consolidated.xml, case-insensitive grep |

Note: the EU Financial Sanctions Database XML download
(`webgate.ec.europa.eu/fsd/.../xmlFullSanctionsList_1_1/content`) could not be
fetched from this VM (307 redirect loop), so the EUR-Lex regulation text above
is the official EU source relied on instead.

## Live run

Command (from repo root, burner wallet via `.env`):

    node --env-file=.env screen.mjs "Roman Abramovich"

Run at 2026-11-12T09:55:40Z. Verdict: **HOLD** — "Counterproof REVIEW (possible
near-match); OFAC/UN lists clear — human review before acting".

| Voter | Answer | Receipt |
|---|---|---|
| OFAC SDN (78021) | CLEAR | `0x403a50d67f35df1aed2fc72e42e85340edf571d69d8009fc80877d17671b01dd` |
| UN Consolidated (78022) | CLEAR | `0x8aa02d42993a5f0f522f94a8cd52ec84652229ea2bd07d9ceebeb2c0687f93bb` |
| Counterproof (731002) | REVIEW | `0x730f4110788dfebb8659b9f7a0bf5efb2c9471830f0346879bbf5bcf05b722ba` |

Full entry (with signal hashes) in `evidence/screen-log.jsonl`, ts
`2026-11-12T09:55:40.222Z`. Cost: 3 paid answers at the $0.01 per-payment cap
(~$0.03 max).

## Conclusion

**The Counterproof-only HOLD path is now live-tested and works as designed.**
A name the US/UN lists clear but the EU/UK lists carry is caught by the
Counterproof second opinion and escalates to HOLD for human review — it is
neither wrongly ALLOWed nor wrongly BLOCKed. No further candidates were needed;
the first candidate produced the expected path on the first run.
