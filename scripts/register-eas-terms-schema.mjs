#!/usr/bin/env node

import { createPublicClient, createWalletClient, encodePacked, getContract, http, keccak256, zeroAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";

const SCHEMA_REGISTRY_ADDRESS = "0x4200000000000000000000000000000000000020";
const TERMS_SCHEMA_DEFINITION =
  "bytes32 termsHash,string termsURI,uint32 termsVersion,uint256 airdropId,address[] claimContracts,string statement";

const schemaRegistryAbi = [
  {
    type: "function",
    name: "register",
    stateMutability: "nonpayable",
    inputs: [
      { name: "schema", type: "string" },
      { name: "resolver", type: "address" },
      { name: "revocable", type: "bool" },
    ],
    outputs: [{ name: "", type: "bytes32" }],
  },
  {
    type: "function",
    name: "getSchema",
    stateMutability: "view",
    inputs: [{ name: "uid", type: "bytes32" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "uid", type: "bytes32" },
          { name: "resolver", type: "address" },
          { name: "revocable", type: "bool" },
          { name: "schema", type: "string" },
        ],
      },
    ],
  },
];

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

async function main() {
  const rpcUrl = requireEnv("BASE_MAINNET_RPC_URL");
  const privateKey = requireEnv("DEPLOYER_PRIVATE_KEY");
  const account = privateKeyToAccount(privateKey);
  const publicClient = createPublicClient({ chain: base, transport: http(rpcUrl) });
  const walletClient = createWalletClient({ account, chain: base, transport: http(rpcUrl) });
  const registry = getContract({
    address: SCHEMA_REGISTRY_ADDRESS,
    abi: schemaRegistryAbi,
    client: { public: publicClient, wallet: walletClient },
  });

  const expectedUid = keccak256(
    encodePacked(["string", "address", "bool"], [TERMS_SCHEMA_DEFINITION, zeroAddress, true]),
  );

  console.log(`Registrar: ${account.address}`);
  console.log(`Registry:  ${SCHEMA_REGISTRY_ADDRESS}`);
  console.log(`Schema:    ${TERMS_SCHEMA_DEFINITION}`);
  console.log(`Expected UID: ${expectedUid}`);

  const existing = await registry.read.getSchema([expectedUid]);
  if (existing.uid === expectedUid) {
    console.log("Schema already registered.");
    console.log(`NEXT_PUBLIC_EAS_TERMS_SCHEMA_UID=${expectedUid}`);
    return;
  }

  const hash = await registry.write.register([TERMS_SCHEMA_DEFINITION, zeroAddress, true]);
  console.log(`Schema registration tx: ${hash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Schema registration reverted.");
  console.log("Schema registered.");
  console.log(`EASScan: https://base.easscan.org/schema/view/${expectedUid}`);
  console.log(`NEXT_PUBLIC_EAS_TERMS_SCHEMA_UID=${expectedUid}`);
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
