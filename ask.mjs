import { x402Client, wrapFetchWithPayment } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";
const [,, id, method, endpoint, payload] = process.argv;
const N = "https://devnode.telegraphprotocol.com";
const signer = privateKeyToAccount(process.env.EVM_PRIVATE_KEY);
const client = new x402Client();
client.setSpendControls({ allowedAssets: [{ network: "eip155:11155111", asset: "0xcc194e1a843B658526D0D5C431f670028582Ae17", maxAmountPerPayment: "10000" }] });
registerExactEvmScheme(client, { signer });
const f = wrapFetchWithPayment(fetch, client);
const res = await f(`${N}/engine/v1/ask/${id}`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ method, endpoint, payload: JSON.parse(payload || "{}") }),
});
console.log("STATUS", res.status);
const rc = res.headers.get("x-telegraph-receipt");
if (rc) console.log("RECEIPT", Buffer.from(rc, "base64").toString());
console.log(await res.text());
