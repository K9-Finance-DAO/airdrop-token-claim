"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  type Address,
  type Hex,
  decodeEventLog,
  encodeAbiParameters,
  isAddress,
  isHex,
  parseAbi,
  zeroAddress,
  zeroHash,
} from "viem";
import { base } from "viem/chains";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";

export const BASE_EAS_TERMS_DEFAULTS = {
  chainId: base.id,
  chainName: "Base Mainnet",
  easAddress: "0x4200000000000000000000000000000000000021" as Address,
  schemaRegistryAddress: "0x4200000000000000000000000000000000000020" as Address,
  easScanUrl: "https://base.easscan.org",
  baseScanUrl: "https://basescan.org",
};

/**
 * V1 is Base-first by default. Other EAS deployments can be wired by passing
 * explicit addresses/URLs, but the packaged defaults intentionally target Base.
 */
export const TERMS_SCHEMA_DEFINITION =
  "bytes32 termsHash,string termsURI,uint32 termsVersion,uint256 airdropId,address[] claimContracts,string statement";

export interface EasTermsConfig {
  schemaUid: Hex;
  termsHash: Hex;
  termsURI: string;
  termsVersion: number;
  airdropId: number;
  claimContracts: Address[];
  statement: string;
  chainId?: number;
  easAddress?: Address;
  easScanUrl?: string;
}

export interface EasTermsAttestResult {
  txHash: Hex;
  attestationUid: Hex | null;
}

const easAbi = parseAbi([
  "function attest((bytes32 schema,(address recipient,uint64 expirationTime,bool revocable,bytes32 refUID,bytes data,uint256 value) data) request) payable returns (bytes32)",
  "event Attested(address indexed recipient,address indexed attester,bytes32 uid,bytes32 indexed schemaUID)",
]);

const ATTESTATION_QUERY = `
  query HasTermsAttestation($where: AttestationWhereInput!) {
    attestations(where: $where, orderBy: [{ time: desc }], take: 1) {
      id
      time
      attester
      recipient
      revoked
    }
  }
`;

export function isBytes32(value: string): value is Hex {
  return isHex(value, { strict: true }) && value.length === 66;
}

export function isEasTermsConfigValid(config: EasTermsConfig): boolean {
  return (
    config.schemaUid !== zeroHash &&
    config.termsHash !== zeroHash &&
    config.termsURI.startsWith("ipfs://") &&
    Number.isInteger(config.termsVersion) &&
    config.termsVersion > 0 &&
    Number.isInteger(config.airdropId) &&
    config.airdropId >= 0 &&
    config.claimContracts.length > 0 &&
    config.claimContracts.every(address => isAddress(address) && address !== zeroAddress)
  );
}

export function encodeTermsAttestationData(config: EasTermsConfig): Hex {
  return encodeAbiParameters(
    [
      { name: "termsHash", type: "bytes32" },
      { name: "termsURI", type: "string" },
      { name: "termsVersion", type: "uint32" },
      { name: "airdropId", type: "uint256" },
      { name: "claimContracts", type: "address[]" },
      { name: "statement", type: "string" },
    ],
    [
      config.termsHash,
      config.termsURI,
      config.termsVersion,
      BigInt(config.airdropId),
      config.claimContracts,
      config.statement,
    ],
  );
}

export function getEasScanAttestationUrl(attestationUid: Hex, easScanUrl = BASE_EAS_TERMS_DEFAULTS.easScanUrl): string {
  return `${easScanUrl}/attestation/view/${attestationUid}`;
}

export function getEasScanSchemaUrl(schemaUid: Hex, easScanUrl = BASE_EAS_TERMS_DEFAULTS.easScanUrl): string {
  return `${easScanUrl}/schema/view/${schemaUid}`;
}

export function useEasTermsAttest(config: EasTermsConfig) {
  const { address } = useAccount();
  const chainId = config.chainId ?? BASE_EAS_TERMS_DEFAULTS.chainId;
  const easAddress = config.easAddress ?? BASE_EAS_TERMS_DEFAULTS.easAddress;
  const publicClient = usePublicClient({ chainId });
  const { writeContractAsync } = useWriteContract();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<Hex | null>(null);
  const [attestationUid, setAttestationUid] = useState<Hex | null>(null);
  const inFlightRef = useRef(false);
  const isConfigValid = isEasTermsConfigValid(config);

  const attest = useCallback(async (): Promise<EasTermsAttestResult | null> => {
    if (inFlightRef.current || !address || !publicClient || !isConfigValid) return null;
    inFlightRef.current = true;
    setIsSubmitting(true);
    setError(null);
    setTxHash(null);
    setAttestationUid(null);

    try {
      const hash = await writeContractAsync({
        address: easAddress,
        abi: easAbi,
        functionName: "attest",
        args: [
          {
            schema: config.schemaUid,
            data: {
              recipient: address,
              expirationTime: 0n,
              revocable: false,
              refUID: zeroHash,
              data: encodeTermsAttestationData(config),
              value: 0n,
            },
          },
        ],
        chainId,
      });
      setTxHash(hash);

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") throw new Error("Transaction reverted on-chain.");

      let uid: Hex | null = null;
      const accountLower = address.toLowerCase();
      for (const log of receipt.logs) {
        if (log.address.toLowerCase() !== easAddress.toLowerCase()) continue;
        try {
          const decoded = decodeEventLog({ abi: easAbi, data: log.data, topics: log.topics });
          if (
            decoded.eventName === "Attested" &&
            decoded.args.schemaUID === config.schemaUid &&
            decoded.args.recipient.toLowerCase() === accountLower &&
            decoded.args.attester.toLowerCase() === accountLower
          ) {
            uid = decoded.args.uid;
            break;
          }
        } catch {
          // Ignore unrelated logs.
        }
      }
      setAttestationUid(uid);
      return { txHash: hash, attestationUid: uid };
    } catch (err) {
      setError(err instanceof Error ? err.message : "Attestation was not completed.");
      return null;
    } finally {
      inFlightRef.current = false;
      setIsSubmitting(false);
    }
  }, [address, chainId, config, easAddress, isConfigValid, publicClient, writeContractAsync]);

  return { attest, isSubmitting, error, txHash, attestationUid, isConfigValid };
}

export function useHasTermsAttestation(config: EasTermsConfig, address: Address | undefined) {
  const [hasAttestation, setHasAttestation] = useState(false);
  const [attestationUid, setAttestationUid] = useState<Hex | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refetch = useCallback(() => setRefreshKey(key => key + 1), []);
  const easScanUrl = config.easScanUrl ?? BASE_EAS_TERMS_DEFAULTS.easScanUrl;
  const schemaConfigured = config.schemaUid !== zeroHash;
  const normalizedAddress = address?.toLowerCase();

  useEffect(() => {
    if (!normalizedAddress || !schemaConfigured) {
      setHasAttestation(false);
      setAttestationUid(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    const controller = new AbortController();
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    fetch(`${easScanUrl}/graphql`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        query: ATTESTATION_QUERY,
        variables: {
          where: {
            schemaId: { equals: config.schemaUid },
            attester: { equals: normalizedAddress },
            recipient: { equals: normalizedAddress },
            revoked: { equals: false },
          },
        },
      }),
    })
      .then(async response => {
        if (!response.ok) throw new Error(`EAS API returned ${response.status}.`);
        return response.json();
      })
      .then(json => {
        if (cancelled) return;
        const attestation = json?.data?.attestations?.[0];
        setHasAttestation(Boolean(attestation));
        setAttestationUid(attestation?.id ?? null);
      })
      .catch(err => {
        if (cancelled || (err instanceof DOMException && err.name === "AbortError")) return;
        setError(err instanceof Error ? err.message : "Failed to check terms attestation.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [config.schemaUid, easScanUrl, normalizedAddress, refreshKey, schemaConfigured]);

  return { hasAttestation, attestationUid, isLoading, error, refetch };
}
