// paid-preflight/fund-buyer.mjs — one-off test helper.
//
// Mints test USDC (open-mint token) from the OPERATOR burner to a buyer
// address, so the test buyer can pay the server. Testnet only, tiny amounts.
//
//   node --env-file=.env fund-buyer.mjs <buyer-address> [amount-usdc]
//   Env: EVM_PRIVATE_KEY (burner)

import { createPublicClient, createWalletClient, http, parseAbi } from "viem";
import { sepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

const USDC = "0xcc194e1a843B658526D0D5C431f670028582Ae17";
const to = process.argv[2];
const amount = BigInt(Math.round(Number(process.argv[3] || "1") * 1e6));
if (!/^0x[0-9a-fA-F]{40}$/.test(to || "")) {
  console.error("usage: fund-buyer.mjs <buyer-address> [amount-usdc]");
  process.exit(1);
}
const account = privateKeyToAccount(process.env.EVM_PRIVATE_KEY);
const rpc = process.env.SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com";
const publicClient = createPublicClient({ chain: sepolia, transport: http(rpc) });
const wallet = createWalletClient({ account, chain: sepolia, transport: http(rpc) });
const hash = await wallet.writeContract({
  address: USDC,
  abi: parseAbi(["function mint(address,uint256)"]),
  functionName: "mint",
  args: [to, amount],
});
console.log("mint tx:", hash);
const receipt = await publicClient.waitForTransactionReceipt({ hash });
console.log("mint status:", receipt.status, "to", to, "amount:", (Number(amount) / 1e6).toFixed(2), "test USDC");
