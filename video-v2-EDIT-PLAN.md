# tgp-guard demo video v2 — EDIT PLAN

**Status:** plan written before render (video-editing-standard.md gate).
**Target:** 60–90 s, 1080x1920 vertical, faceless (screen + voice only), ~-16 LUFS.
**Deliverable:** `~/workspace/your_files/tgp-guard-demo-v2.mp4` — file only, NO upload.
**Awaits George's per-video approval before any upload.**

## 1. Diagnosis

- **Type / purpose:** hackathon demo video (ad / product-demo lane) for Telegraph
  Hackathon Season II, final Dec 1, 2026 23:59 UTC. Replaces the 2:23 v1, which
  predates the interactive demo page.
- **Platform / audience:** hackathon judges + builders on X / GitHub / demo page.
  Judges skim: proof must land in the first 10 seconds, receipts on screen.
- **Emotion / tone:** calm competence, not hype. "Check first, then act."
- **Key message:** autonomous agents act first and ask later; tgp-guard buys
  independent Telegraph checks *before* the agent acts and returns one verdict —
  ALLOW / HOLD / BLOCK — with a receipt for every check.
- **Length:** ~72–78 s (7 scenes), inside the 60–90 s brief.

### Diagnosis findings (verified 2026-11-12, ~10:30 WAT)

- Demo page live: `https://georgeonweb3.github.io/tgp-guard/` returns HTTP 200.
  Interactive "Try it yourself" section present (sprint 1, commit 824ec7d):
  sanctions / link / quote presets replaying real paid runs from 11 Nov 2026
  with receipt hashes from `evidence/*.jsonl`. No backend, no simulation.
- Chromium: the bundled `/opt/meta-chromium/chrome` (Muse Browser build) **cannot
  launch in the exec sandbox** — exits 13, "Hatch WebGL domain policy is required
  for browser startup", even for `--headless --screenshot`. Fix: Chrome for
  Testing 157.0.8103.78 downloaded to `video-v2/chrome-linux64/` (kit-documented
  route); `--version` verified. `/tmp` is a 512 MB tmpfs and filled during the
  first unzip — all build work lives under `~/workspace/tgp-guard/video-v2/`
  (103 GB free on /home), never /tmp.
- Voice: the `/opt/hatch/bin/tts` CLI has no `helio` voice ID — requesting it
  prints `Using TTS voice "avocado_v2:MAI_03" for requested ID "helio"` and
  synthesises with the default. So: default clear voice `avocado_v2:MAI_03`
  (Shortwave), NOT Piper lessac (George rejected that voice before; Piper is
  fallback only if the TTS CLI fails). Test clip verified: 3.12 s MP3, valid.
- Style: code-drawn explainer, same kit + pipeline as the swap.io video
  (`~/workspace/your_files/code-drawn-video-kit/`): canvas scenes rendered with
  headless Chromium, voiceover + quiet synth pad bed, ffmpeg loudnorm to -16 LUFS.
  NOT photorealistic, no AI images, no face, no room.
- Theme: kit default `coral-noir` with accent overridden to tgp-guard teal
  `#2dd4bf` (matches the demo page) — dark product contrast, per standard.

## 2. Overall strategy & style rationale

Ad/product-demo lane: punchy, text-heavy, proof early. Hook in the first 3 s
(the page's own headline: "Your agent is about to pay. Who checked first?").
The core scene (S4) is a **real screen capture** of the live demo page running
the "Laden" sanctions preset to its BLOCK verdict — not a redraw — framed by
code-drawn scenes. Every number on screen is copied from the page /
`evidence/*.jsonl`, nothing invented. One idea per scene, one verdict per scene,
captions word-for-word with the voiceover. Quiet electric-piano pad bed
(`make-bed.py`), no synth bed, no drums.

## 3. Hook (first 3–5 s)

Black screen, teal `$` coin drops in, headline slams: **"YOUR AGENT IS ABOUT
TO PAY."** Voice: "Your agent is about to pay. Who checked first?" The
question is the page headline and the whole product in one line — a judge who
watches 3 seconds still gets the problem.

## 4. Timestamped timeline

Scene durations below are **planned** from a ~150 wpm read; final durations are
set from measured per-scene voice-clip lengths (clip + 0.8 s breathing room)
before the frame render, and the total is re-checked to stay in 60–90 s.

| # | Time (planned) | Tag | On screen | Voiceover (exact) |
|---|---|---|---|---|
| 1 | 0:00–0:06 | HOOK | Teal `$` coin, pulsing red ring. Headline: YOUR AGENT IS / ABOUT TO PAY. | "Your agent is about to pay. Who checked first?" |
| 2 | 0:06–0:16 | THE PROBLEM | Three red-X cards: BAD NAME / RIGGED QUOTE / POISONED LINK. Headline: ACT FIRST, / ASK LATER. | "Autonomous agents swap, pay, and click on their own. One bad name, one rigged quote, one poisoned link — and the money is gone." |
| 3 | 0:16–0:28 | CHECK FIRST | Four check boxes flow into one verdict pill: PRICE → SANCTIONS → LINK → AUDIT → ALLOW / HOLD / BLOCK. Headline: CHECK FIRST. / THEN ACT. | "tgp-guard checks first. Before your agent acts, it buys independent checks through Telegraph — price, sanctions, link, and contract audit — and returns one verdict: allow, hold, or block." |
| 4 | 0:28–0:43 | LIVE DEMO | **Real screen capture** of the demo page "Try it yourself" running sanctions preset "Laden": OFAC SDN LISTED, UN Consolidated LISTED, verdict BLOCK. Strip under it: LADEN → BLOCK · receipt 0xdd8c…14efc. | "Try it yourself, right on the demo page. I pick the sanctions check and type Laden. Three miners answer: OFAC listed, UN listed, receipt attached. Verdict: block. The payment never happens." |
| 5 | 0:43–0:58 | THE HOLD | Receipt card: ROMAN ABRAMOVICH / HOLD / EU + UK listed · OFAC + UN clear / Counterproof REVIEW · receipt 0x730f…722ba. Headline: UNCLEAR? / IT HOLDS. | "And when the answer is unclear, it holds. Roman Abramovich is listed in Europe and the UK, but clear in the US and UN lists — so Counterproof flagged it for review, and tgp-guard held. Not wrongly allowed. Not wrongly blocked." |
| 6 | 0:58–1:10 | THE COST | Stat card: 9 PAID ANSWERS / ~$0.09 FULL PREFLIGHT. Strip: $50,000 quote vs $74,415 median — 32.81% off → BLOCK. Headline: 9 ANSWERS. / 9 CENTS. | "Every check costs about one cent per answer. A full preflight — nine paid answers — is about nine cents. And if anything is unknown, it fails closed to hold. Never a false allow." |
| 7 | 1:10–1:18 | CLOSE | Link card: demo georgeonweb3.github.io/tgp-guard · repo github.com/georgeonweb3/tgp-guard. Headline: TRY IT / YOURSELF. | "Try the interactive demo yourself, and read the receipts in the repo. tgp-guard — check first, then act." |

**Planned total: ~78 s.** If measured voice runs long, trim S2/S6 wording first;
never cut S4 (the demo) or S5 (the HOLD proof).

## 5. Exact cuts, transitions, zooms, speed ramps

- Every scene cut: kit-standard impact — white flash + scale punch (1.13→1.0
  over 0.32 s) + micro-shake, then a slow 5% push-in for the scene's life.
  No cross-dissolves; hard cuts keep the demo pace.
- S4 screenshot: slow Ken Burns push (scale 1.00→1.04) across the 15 s so the
  static capture still moves; the verdict strip wipes in at ~2 s into the scene.
- S1 coin: gentle bob (±5 px, sine). S3 flow arrows draw themselves in over
  the first 1.5 s. S5 HOLD card: amber pill pulses once when the word "holds"
  is spoken (timed to the clip, ~60% through the scene).
- No speed ramps on voice; narration is real-time throughout.

## 6. Caption style & timing

- Bottom band, Inter Bold 44 px, cream on dark, centred, max 3 lines, wrapped
  per scene; caption text = the voiceover line word-for-word (see table).
- Key words highlighted by the headline, not by caption colour changes —
  captions stay one colour for legibility at phone size.
- Captions appear with the scene (no karaoke word timing — Shorts-style
  readability, timed to speech by scene boundaries).

## 7. B-roll & AI image prompts

- None. No AI images, no stock. B-roll is the real demo-page screen capture
  (S4) plus code-drawn diagrams and receipt cards. The screenshot is captured
  with Playwright against the live page: viewport 1080×1920, click the "Laden"
  preset chip, wait for all 3 steps + verdict, element screenshot of the
  interactive box (`video-v2/shots/interactive-laden.png`).

## 8. Colour grade

- Dark product contrast (standard's demo lane): near-black `#0e0e0d` base,
  cream ink `#f5f0e8`, teal accent `#2dd4bf`, paper cards `#f4efe6` with dark
  ink, red `#f87171` reserved for BLOCK / danger, amber `#fbbf24` reserved
  for HOLD. Matches the demo page palette (`--bg #0b0e14`, teal `#2dd4bf`).

## 9. Music & sound design

- Bed: `make-bed.py` gentle electric-piano pad, same length as the video,
  mixed at 0.25 under the voice (assemble.sh default). No drums, no drone,
  no synth bed. No whooshes — the cut-impact flash is the only punctuation;
  a demo for judges should not sound like a trailer.
- Voice mixed loud and forward; bed never competes.

## 10. Export specs

- 1080×1920, 30 fps, H.264 yuv420p, AAC 192k, faststart.
- Loudnorm two-pass to **-16 LUFS / -1.5 dBTP** (assemble.sh).
- Output: `~/workspace/your_files/tgp-guard-demo-v2.mp4`.

## 11. Retention & engagement notes

- Hook is a question the target (agent builders) already worries about.
- Proof lands twice before 60 s: a BLOCK with receipt (S4) and a HOLD with
  receipt (S5) — the two behaviours that separate a guard from a filter.
- Numbers are the retention device: $0.01/answer, $0.09 preflight, 32.81%
  off-market, 9 answers — all exact, all checkable on the page.
- End card gives two actions (try the demo, read the repo) and nothing else;
  no subscribe beg, no logo linger.

## 12. Numbers — sources (all verified, none invented)

- "Laden" BLOCK: OFAC SDN LISTED receipt
  `0xdd8c6fd0a85d990f77471f15aa38e54a9f8297b3f6dbf230f347bb2f21d14efc`;
  UN Consolidated LISTED
  `0x315477a7ded62323db1d74bc2baf4a04129e08b3505a0421692b4e2090dde42b`;
  Counterproof CLEAR (confidence 0.207), 11 Nov 2026, 3 paid answers ~$0.03.
  Source: page `RUNS.laden`, `evidence/screen-log.jsonl`.
- Full preflight ALLOW: 9 paid answers, ~$0.09, 11 Nov 2026; price 3/3 sources
  agree within 0.01%. Source: page `RUNS.allow`.
- Quote BLOCK: quoted $50,000 is 32.81% off median $74,415.00 (spread 0.163%),
  spent $0.03. Source: page `RUNS.quote`, `evidence/guard-log.jsonl`.
- Abramovich HOLD (12 Nov 2026): OFAC CLEAR
  `0x403a50d67f35df1aed2fc72e42e85340edf571d69d8009fc80877d17671b01dd`, UN CLEAR
  `0x8aa02d42993a5f0f522f94a8cd52ec84652229ea2bd07d9ceebeb2c0687f93bb`,
  Counterproof REVIEW
  `0x730f4110788dfebb8659b9f7a0bf5efb2c9471830f0346879bbf5bcf05b722ba`;
  EU entry 879 / UK Group ID 14212, absent from OFAC SDN + UN lists (checked
  same day). Source: `evidence/counterproof-hold-2026-11-12.md`.
- Per-answer cost ~$0.01, hard-capped at $0.01 per payment (x402
  setSpendControls). Source: README.

## 13. Verification checklist (after render)

- [ ] ffprobe: 1080×1920, 30 fps, duration 60–90 s, audio present.
- [ ] Loudness ~-16 LUFS (ffmpeg loudnorm measure on the final file).
- [ ] Frame extracts at hook / S3 / S4-mid / S5 / end: no text overlap or
      runoff, screenshot legible, BLOCK/HOLD pills correct colour.
- [ ] Every number on screen re-checked against §12 sources.
- [ ] Voice matches captions word-for-word; voice audible over the bed.
- [ ] Watch the full mp4 through once with sound.
- [ ] Fix and re-render broken scenes only (delete those frames, re-run).
- [ ] No upload anywhere — file only, awaiting George's per-video approval.
