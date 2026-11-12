# tgp-guard — Discord milestone post draft (#hackers)

**Timing note:** intended for the Nov 14 First Integration checkpoint. Post on
Nov 13–14, NOT today (Nov 12) unless the parent agent says otherwise.
Author: George (georgeonweb3). Do not post from any agent account — George
posts it himself, or the parent agent posts it via the browser.

**Character count:** 1,140 (post body only, target was under ~1,200).

---

**tgp-guard — Nov 14 checkpoint (Telegraph Season II, Apps & Agents)**

Hi all, George here (georgeonweb3). Sprint 2 update on tgp-guard, the preflight guard that returns ALLOW / HOLD / BLOCK with a receipt for every check before an agent swaps, pays or clicks.

- Interactive demo is live: replay real paid runs in your browser, every verdict with its receipt hash — https://georgeonweb3.github.io/tgp-guard/
- HOLD path live-tested Nov 12: "Roman Abramovich" (EU + UK listed only, OFAC/UN clear) returned HOLD on a Counterproof REVIEW. 3 paid answers, ~$0.03. Receipts in evidence/counterproof-hold-2026-11-12.md
- Privacy section added to the demo: each check sends only the minimum it needs (a name, a URL, a quote) to the miners running it. No accounts, no background collection; run history stays in your local log.
- Free preflights open: if you're building on Telegraph and want your agent's swap, pay or click preflighted before it acts, reply here or see my offer thread in #hackers — I'll run it free and share the verdict + receipts.

Repo: https://github.com/georgeonweb3/tgp-guard
Next: community showcase Nov 20, final Dec 1.

---

## Notes for the poster

- The "offer thread in #hackers" is the workstream-1 thread (free live
  preflights for other builders). If that thread is not live yet when this
  posts, drop that clause and keep "reply here".
- Receipts for the HOLD test: `evidence/counterproof-hold-2026-11-12.md`
  (OFAC CLEAR `0x403a…`, UN CLEAR `0x8aa0…`, Counterproof REVIEW `0x730f…`).
- Related: Update #3 X thread posted Nov 12 ~11:03 WAT; Update #4 X draft
  in UPDATES.md covers the same demo + HOLD + privacy news for X.
