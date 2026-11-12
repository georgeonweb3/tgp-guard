# MCP server smoke test — 2026-11-12 ~11:35 WAT (live)

Real MCP client (`smoke-test.mjs`, official SDK `Client` +
`StdioClientTransport`) spawning `server.mjs` over stdio, calling each tool
once live against the Telegraph devnode with the burner wallet. All four
tools shipped and answered live. No recorded-evidence fallbacks were needed.

## Results

### price_check {"asset": "bitcoin"} — ALLOW (live, 3 paid, $0.03)

3/3 sources agree within 0.08%; median $73,433.87.

| Miner | Price (USD) | Receipt |
|---|---|---|
| TxLens | 73,433.87 | `0x535b23eb53314930207de9fd41d52d6d7213eb24fd9a4db32ade740941f54844` |
| CoinGecko | 73,484 | `0x531b78b6394635378c7eaedf8158145d9b7ad266acdf55091a729bfc0ad434cc` |
| Kraken | 73,428.60 | `0x0a65c8479a3950c275b5c0a10cdce50fb8dd96597c9f3ae8cc8df0722c170a03` |

### sanctions_screen {"entity": "Acme Bakery"} — ALLOW (live, 3 paid, $0.03)

3/3 CLEAR; no match on any list.

| Miner | Verdict | Receipt |
|---|---|---|
| OFAC SDN | CLEAR | `0xba5b744543411956a6235b91f7af72871da07c8d200f2e97fc31ad1eabef8f3d` |
| UN Consolidated | CLEAR | `0xffea50d98ec11357210e15c433ab880e0972886a3a7a65c436204582d63e84ad` |
| Counterproof (US/UN/EU/UK) | CLEAR | `0x3a451f315af1cf7fd0faa8a606917d44089b44f4cd2a3cafdb4e90a83d50b55a` |

> First attempt FAILED before any payment: a bug in `checks.mjs` called
> the sanctions payload object as a function (`l.payload is not a function`).
> The guard failed closed to HOLD with 0 paid answers and $0 charged. Bug
> fixed (`l.payload` passed directly), retest above is the live pass.

### link_scan {"url": "https://github.com"} — ALLOW (live, 3 paid, $0.03)

3/3 CLEAN, no flags.

| Miner | Result | Receipt |
|---|---|---|
| Preflight | CLEAN (verdict=Safe) | `0xf02d3ea1a1591941360906f631f81504eb677fdae96cd113d25d006114121d8d` |
| URLSentinel | CLEAN (safe) | `0xe4432b1210a5849f1353e5ae9de37d6808931241b1c7e790890b927464af9f44` |
| NetWire | CLEAN (safe=true, risk=no_indicators_found) | `0x86b834552f0fca3b6bdeae0ab524ed7ff3bc770e5a14fb81a22899ad0aabd3c1` |

### full_preflight {"asset": "bitcoin"} — ALLOW (live, 3 paid, $0.03)

Price leg only in this run: 3/3 agree within 0.08%, median $73,484.

| Miner | Price (USD) | Receipt |
|---|---|---|
| TxLens | 73,492.19 | `0xeb6bcfbe8efccc7d843a5aa2a4dd04dbcba50e98322a38ffa918edeb03da614f` |
| CoinGecko | 73,484 | `0x610fe5d810f98176ca0da023a9c2098a979aec9e6c8b1adf9940411e927d4f48` |
| Kraken | 73,436.70 | `0x487b66aa29438910fe73967f2cdfa8414cec18ee0949952924a2b0b3aa36a398` |

## Totals

- Paid answers with receipts: **12 × $0.01 = $0.12 test USDC** (slightly over
  the ~$0.10 smoke-test target — the sanctions retest after the bug fix added
  one extra 3-answer round).
- One retest attempt's stdout was lost to a shell redirection quirk (exit 0,
  ~31 s runtime, consistent with a completed live call); it may have spent a
  further 3 × $0.01 with no receipts captured. Not counted above.

## Not live-tested

- `full_preflight` with all three legs at once (would cost a further 9 ×
  $0.01). The single-leg run above is live, and the composition is just
  `Promise.all` over the same leg functions that the three individual tools
  live-verified in this session, combined by worst-verdict. A 3-leg run is
  the obvious next check before demoing the tool to anyone.
- No BLOCK/HOLD case was exercised through the MCP tools in this run (the
  CLI scripts already cover those paths live: off-market quote BLOCK,
  OFAC-listed BLOCK, Counterproof-only HOLD — see repo README).
