#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { getAddress, isAddress, keccak256 } from "viem";

const PINATA_ENDPOINT = "https://api.pinata.cloud/pinning/pinFileToIPFS";
const GATEWAYS = ["https://gateway.pinata.cloud/ipfs", "https://ipfs.io/ipfs", "https://dweb.link/ipfs"];
const SCHEMA =
  "bytes32 termsHash,string termsURI,uint32 termsVersion,uint256 airdropId,address[] claimContracts,string statement";

function usage() {
  throw new Error(
    [
      "Usage:",
      "  node scripts/prepare-eas-terms.mjs --input terms/terms-v1.md --version 1 --airdrop-id 1 --claim-contract 0x... [--claim-contract 0x...] [--output terms/terms-manifest-v1.json] [--no-upload]",
      "",
      "Pinata upload requires PINATA_JWT or PINATA_API_KEY + PINATA_API_SECRET.",
    ].join("\n"),
  );
}

function readArgs(argv) {
  const args = argv.slice(2);
  const value = flag => {
    const index = args.indexOf(flag);
    return index === -1 ? undefined : args[index + 1];
  };
  const values = flag => {
    const found = [];
    for (let i = 0; i < args.length; i++) {
      if (args[i] === flag && args[i + 1]) found.push(args[i + 1]);
    }
    return found;
  };

  const input = value("--input");
  const versionRaw = value("--version");
  const airdropIdRaw = value("--airdrop-id");
  const claimContractsRaw = values("--claim-contract");
  if (!input || !versionRaw || !airdropIdRaw || claimContractsRaw.length === 0) usage();

  const version = Number(versionRaw);
  const airdropId = Number(airdropIdRaw);
  if (!Number.isInteger(version) || version < 1) throw new Error(`Invalid --version: ${versionRaw}`);
  if (!Number.isInteger(airdropId) || airdropId < 0) throw new Error(`Invalid --airdrop-id: ${airdropIdRaw}`);
  for (const address of claimContractsRaw) {
    if (!isAddress(address)) throw new Error(`Invalid --claim-contract: ${address}`);
  }

  return {
    input,
    version,
    airdropId,
    claimContracts: claimContractsRaw.map(getAddress),
    output: value("--output"),
    noUpload: args.includes("--no-upload"),
  };
}

function resolvePath(filePath) {
  return path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
}

function authHeaders() {
  if (process.env.PINATA_JWT) return { Authorization: `Bearer ${process.env.PINATA_JWT}` };
  if (process.env.PINATA_API_KEY && process.env.PINATA_API_SECRET) {
    return {
      pinata_api_key: process.env.PINATA_API_KEY,
      pinata_secret_api_key: process.env.PINATA_API_SECRET,
    };
  }
  throw new Error("Missing Pinata credentials. Set PINATA_JWT or PINATA_API_KEY + PINATA_API_SECRET.");
}

async function uploadToPinata(filePath, bytes, version) {
  const form = new FormData();
  form.append("file", new Blob([bytes], { type: "text/markdown" }), path.basename(filePath));
  form.append(
    "pinataMetadata",
    JSON.stringify({
      name: `terms-v${version}`,
      keyvalues: { type: "terms-document" },
    }),
  );

  const response = await fetch(PINATA_ENDPOINT, { method: "POST", headers: authHeaders(), body: form });
  if (!response.ok) throw new Error(`Pinata upload failed (${response.status}): ${await response.text()}`);
  return response.json();
}

async function main() {
  const options = readArgs(process.argv);
  const inputPath = resolvePath(options.input);
  if (!fs.existsSync(inputPath)) throw new Error(`Terms file not found: ${inputPath}`);

  const bytes = fs.readFileSync(inputPath);
  const termsHash = keccak256(bytes);
  let cid = null;
  let termsURI = null;
  let gateways = [];

  if (!options.noUpload) {
    const uploaded = await uploadToPinata(inputPath, Uint8Array.from(bytes), options.version);
    cid = uploaded.IpfsHash;
    termsURI = `ipfs://${cid}`;
    gateways = GATEWAYS.map(base => `${base}/${cid}`);
  }

  const outputPath = resolvePath(options.output ?? `terms/terms-manifest-v${options.version}.json`);
  const manifest = {
    schema: SCHEMA,
    termsVersion: options.version,
    airdropId: options.airdropId,
    claimContracts: options.claimContracts,
    termsHash,
    sourceFile: path.relative(process.cwd(), inputPath),
    fileName: path.basename(inputPath),
    cid,
    termsURI,
    gateways,
    generatedAt: new Date().toISOString(),
  };

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  console.log("Prepared EAS terms manifest");
  console.log(`termsHash=${termsHash}`);
  if (termsURI) console.log(`termsURI=${termsURI}`);
  console.log(`output=${path.relative(process.cwd(), outputPath)}`);
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
