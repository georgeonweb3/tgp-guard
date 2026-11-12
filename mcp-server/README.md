# tgp-guard MCP server

MCP server (stdio transport) for tgp-guard: pre-flight guard for autonomous
agents. It buys independent Telegraph checks on Ethereum Sepolia and returns
one verdict — ALLOW / HOLD / BLOCK — with a receipt per paid answer.

## Setup

```sh
cd mcp-server
npm install
```

Set the burner key (Sepolia testnet only — never a real wallet):

```sh
# either: point the server at the repo .env
node --env-file=../.env server.mjs
# or: export it in your shell
export EVM_PRIVATE_KEY=0x<burner testnet key>
node server.mjs
```

The burner key also lives at `~/workspace/scratch/tgp-guard/.env`
(`EVM_PRIVATE_KEY=0x...`). Fund the burner with a little Sepolia ETH for
gas plus test USDC — the payment token
(`0xcc194e1a843B658526D0D5C431f670028582Ae17`) is an open-mint test token; see
the repo README "Run" section.

## Pointing an MCP client at it (stdio)

Claude Desktop (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "tgp-guard": {
      "command": "node",
      "args": ["--env-file=/home/hatch/workspace/tgp-guard/.env",
               "/home/hatch/workspace/tgp-guard/mcp-server/server.mjs"]
    }
  }
}
```

Adjust the paths to your checkout. The server speaks JSON-RPC over stdio
only; it never logs to stdout (diagnostics go to stderr).

## Tools

| Tool | Inputs | What it does | Cost |
|---|---|---|---|
| `price_check` | `asset`: bitcoin \| ethereum \| solana; `quote?`: number | 3 miners (TxLens, CoinGecko, Kraken). Spread >0.5% HOLD, >2% BLOCK; quote >1% off median BLOCK. | 3 × $0.01 |
| `sanctions_screen` | `entity`: string | OFAC SDN + UN Consolidated + Counterproof (US/UN/EU/UK). OFAC/UN hit BLOCKs; Counterproof-only hit/REVIEW HOLDs. | 3 × $0.01 |
| `link_scan` | `url`: string | URL Sentinel + NetWire + PREFLIGHT. 2+ flags BLOCK, 1 flag or unassessable source HOLDs. | 3 × $0.01 |
| `full_preflight` | `asset?`, `quote?`, `counterparty?`, `url?` | Runs the price + sanctions + link legs in one call; worst verdict wins (BLOCK > HOLD > ALLOW). At least one of `asset`, `counterparty`, `url` is required. | $0.01 per paid answer, up to 9 × $0.01 |

Every tool returns the same verdict shape:

```json
{
  "check": "price",
  "verdict": "ALLOW",
  "reason": "3/3 sources agree within 0.08%",
  "paid_answers": 3,
  "cost_usd": 0.03,
  "results": [
    { "name": "TxLens", "ok": true, "price": 73433.87,
      "receipt": "0x535b23eb…", "signal": "0x19c47280…" }
  ]
}
```

Example calls (via an MCP client):

- `price_check` `{"asset": "bitcoin", "quote": 79000}` — BLOCK if the quote is off-market.
- `sanctions_screen` `{"entity": "Acme Bakery"}` — expect ALLOW.
- `link_scan` `{"url": "https://github.com"}` — expect ALLOW.
- `full_preflight` `{"asset": "bitcoin", "counterparty": "Acme Bakery", "url": "https://github.com"}` — the core pre-flight, one verdict.

## How it is built

`checks.mjs` holds the check logic (same miner ids, endpoints, parse rules
and verdict rules as the CLI scripts `guard.mjs`, `screen.mjs`,
`urlcheck.mjs` — if a miner id or rule changes, change it in both places).
`server.mjs` is a thin MCP wrapper using the official
`@modelcontextprotocol/sdk` (stdio transport). `smoke-test.mjs` is a real
MCP client that spawns the server and calls each tool live; its recorded
output is in `SMOKE-TEST.md`.

## Honest limits

- **Sepolia testnet only.** No production traffic, no real money. Every
  payment is $0.01 test USDC, capped at 10000 atomic units per payment via
  `setSpendControls` before payment. Failed calls are not charged.
- **A burner wallet is required.** The server refuses to start without
  `EVM_PRIVATE_KEY`. Never point it at a wallet holding real funds.
- **Fails closed.** A missing or unparseable source never produces ALLOW.
- **Sanctions is exact-name only** (plus Counterproof fuzzy second opinion);
  it is screening, not full KYC.
- **Link scan sends the URL to third-party miners** — do not scan private URLs.
- **The guard checks, it does not act.** It returns a verdict; the calling
  agent decides whether to proceed.
