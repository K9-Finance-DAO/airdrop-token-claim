"use client";

import { type Address, type Hash, getAddress, isHash } from "viem";

export type TokenProofData = { amount?: bigint; proof?: Hash[] };

export interface ProofEntry {
  amountWei: bigint;
  proof: Hash[];
}

export type ParsedProofs =
  | { ok: true; entries: Map<string, ProofEntry>; warnings: string[] }
  | { ok: false; reason: "schema-unknown" | "entry-malformed"; detail: string };

export const tokenClaimAbi = [
  {
    type: "function",
    name: "claim",
    stateMutability: "nonpayable",
    inputs: [
      { name: "amount", type: "uint256" },
      { name: "proof", type: "bytes32[]" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "isClaimed",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseAmount(value: unknown): bigint | undefined {
  if (typeof value === "bigint") return value > 0n ? value : undefined;
  if (typeof value === "number") {
    if (!Number.isFinite(value) || !Number.isInteger(value) || value <= 0 || !Number.isSafeInteger(value)) {
      return undefined;
    }
    return BigInt(value);
  }
  if (typeof value === "string") {
    try {
      const parsed = BigInt(value.trim());
      return parsed > 0n ? parsed : undefined;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function parseProofArray(value: unknown): Hash[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const proof: Hash[] = [];
  for (const item of value) {
    if (typeof item !== "string" || !isHash(item)) return undefined;
    proof.push(item);
  }
  return proof;
}

function normalizeAddressKey(value: string): string | undefined {
  try {
    return getAddress(value as Address).toLowerCase();
  } catch {
    return undefined;
  }
}

export function parseProofsPayload(json: unknown): ParsedProofs {
  if (!isRecord(json) || !Array.isArray(json.proofs)) {
    return { ok: false, reason: "schema-unknown", detail: "Missing top-level `proofs` array." };
  }

  const entries = new Map<string, ProofEntry>();
  let duplicateCount = 0;

  for (let i = 0; i < json.proofs.length; i++) {
    const item = json.proofs[i];
    if (!isRecord(item)) continue;

    const rawAddress = item.address ?? item.account ?? item.wallet;
    if (typeof rawAddress !== "string") continue;

    const key = normalizeAddressKey(rawAddress);
    if (!key) continue;

    if (entries.has(key)) {
      duplicateCount++;
      continue;
    }

    const amountWei = parseAmount(item.amount);
    if (amountWei === undefined) {
      return {
        ok: false,
        reason: "entry-malformed",
        detail: `Row ${i} (${rawAddress}) has an unparseable \`amount\`.`,
      };
    }

    const proof = parseProofArray(item.proof);
    if (proof === undefined) {
      return {
        ok: false,
        reason: "entry-malformed",
        detail: `Row ${i} (${rawAddress}) has a malformed \`proof\` array.`,
      };
    }

    entries.set(key, { amountWei, proof });
  }

  const warnings: string[] = [];
  if (duplicateCount > 0) warnings.push(`${duplicateCount} duplicate address(es) found; first occurrence kept.`);
  return { ok: true, entries, warnings };
}

export function lookupProof(parsed: ParsedProofs, account: Address): TokenProofData {
  if (!parsed.ok) return {};
  const entry = parsed.entries.get(getAddress(account).toLowerCase());
  if (!entry) return {};
  return { amount: entry.amountWei, proof: entry.proof };
}

export function formatTokenAmount(amountWei: bigint | undefined, decimals = 18, maxFractionDigits = 4): string {
  if (amountWei === undefined) return "0";
  const scale = 10n ** BigInt(decimals);
  const whole = amountWei / scale;
  const fraction = amountWei % scale;
  if (fraction === 0n || maxFractionDigits <= 0) return whole.toString();
  const padded = fraction.toString().padStart(decimals, "0");
  const trimmed = padded.slice(0, maxFractionDigits).replace(/0+$/, "");
  return trimmed ? `${whole}.${trimmed}` : whole.toString();
}

export function getErrorMessage(error: unknown, fallback = "Something went wrong."): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
