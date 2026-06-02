"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AlertCircle, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { type Address, getAddress } from "viem";
import { useAccount, useReadContract, useSwitchChain, useWriteContract } from "wagmi";
import {
  formatTokenAmount,
  getErrorMessage,
  lookupProof,
  parseProofsPayload,
  tokenClaimAbi,
  type ParsedProofs,
  type TokenProofData,
} from "@/lib/token-claim";

export interface TokenClaimProps {
  chainId: number;
  chainName: string;
  claimContractAddress: Address;
  proofsUrl: string;
  token: {
    symbol: string;
    name?: string;
    decimals?: number;
    iconUrl?: string;
  };
  allocationsUrl?: string;
  className?: string;
}

type ProofLoadState =
  | { status: "idle" | "loading" }
  | { status: "ready"; parsed: ParsedProofs }
  | { status: "error"; message: string };

function cx(...classes: Array<string | false | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

function describeParseError(parsed: Extract<ParsedProofs, { ok: false }>): string {
  if (parsed.reason === "schema-unknown") return "Proofs file has an unexpected format.";
  return `Proofs file is malformed: ${parsed.detail}`;
}

export function TokenClaim({
  chainId,
  chainName,
  claimContractAddress,
  proofsUrl,
  token,
  allocationsUrl,
  className,
}: TokenClaimProps) {
  const { address, chainId: activeChainId, isConnected } = useAccount();
  const { switchChainAsync, isPending: isSwitching } = useSwitchChain();
  const { writeContractAsync, isPending: isClaiming } = useWriteContract();
  const [proofState, setProofState] = useState<ProofLoadState>({ status: "idle" });
  const [reloadKey, setReloadKey] = useState(0);
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setProofState({ status: "loading" });
    fetch(proofsUrl, { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error(`Could not load proofs (HTTP ${response.status}).`);
        const parsed = parseProofsPayload(await response.json());
        setProofState({ status: "ready", parsed });
      })
      .catch(error => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setProofState({ status: "error", message: getErrorMessage(error, "Failed to load proofs.") });
      });
    return () => controller.abort();
  }, [proofsUrl, reloadKey]);

  const proofData: TokenProofData = useMemo(() => {
    if (!address || proofState.status !== "ready" || !proofState.parsed.ok) return {};
    return lookupProof(proofState.parsed, getAddress(address));
  }, [address, proofState]);

  const { data: alreadyClaimed, isLoading: isClaimedLoading } = useReadContract({
    address: claimContractAddress,
    abi: tokenClaimAbi,
    functionName: "isClaimed",
    args: address ? [address] : undefined,
    chainId,
    query: { enabled: Boolean(address) },
  });

  const wrongChain = activeChainId !== undefined && activeChainId !== chainId;
  const eligible = proofData.amount !== undefined && proofData.proof !== undefined;
  const decimals = token.decimals ?? 18;
  const parsedProofs = proofState.status === "ready" ? proofState.parsed : null;

  const handleClaim = async () => {
    if (!eligible || !proofData.amount || !proofData.proof) return;
    setClaimError(null);
    setTxHash(null);
    try {
      if (wrongChain) await switchChainAsync({ chainId });
      const hash = await writeContractAsync({
        address: claimContractAddress,
        abi: tokenClaimAbi,
        functionName: "claim",
        args: [proofData.amount, proofData.proof],
        chainId,
      });
      setTxHash(hash);
    } catch (error) {
      setClaimError(getErrorMessage(error, "Claim transaction was not completed."));
    }
  };

  const title = token.name ? `${token.name} (${token.symbol})` : token.symbol;

  return (
    <section
      className={cx(
        "rounded-[var(--airdrop-claim-radius,0.75rem)] border border-border bg-card p-5 text-card-foreground shadow-sm",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          {token.iconUrl ? <img src={token.iconUrl} alt="" className="h-10 w-10 rounded-full" /> : null}
          <div>
            <h2 className="text-lg font-semibold">{title}</h2>
            <p className="text-sm text-muted-foreground">Claim on {chainName}</p>
          </div>
        </div>
        {allocationsUrl ? (
          <a className="text-sm text-primary underline" href={allocationsUrl} target="_blank" rel="noreferrer">
            Allocations
          </a>
        ) : null}
      </div>

      <div className="mt-5 rounded-lg border bg-muted/40 p-4">
        {!isConnected ? (
          <Status
            icon={<AlertCircle className="h-4 w-4" />}
            title="Connect wallet"
            detail="Connect to check eligibility."
          />
        ) : proofState.status === "loading" || proofState.status === "idle" || isClaimedLoading ? (
          <Status
            icon={<Loader2 className="h-4 w-4 animate-spin" />}
            title="Checking allocation"
            detail="Loading proof data."
          />
        ) : proofState.status === "error" ? (
          <Status
            icon={<AlertCircle className="h-4 w-4" />}
            title="Proofs unavailable"
            detail={proofState.message}
            actionLabel="Retry"
            onAction={() => setReloadKey(key => key + 1)}
          />
        ) : parsedProofs && !parsedProofs.ok ? (
          <Status
            icon={<AlertCircle className="h-4 w-4" />}
            title="Proofs malformed"
            detail={describeParseError(parsedProofs)}
          />
        ) : alreadyClaimed ? (
          <Status
            icon={<CheckCircle2 className="h-4 w-4" />}
            title="Already claimed"
            detail="This wallet has already claimed."
          />
        ) : eligible ? (
          <div className="space-y-4">
            <Status
              icon={<CheckCircle2 className="h-4 w-4" />}
              title="Eligible"
              detail={`${formatTokenAmount(proofData.amount, decimals)} ${token.symbol}`}
            />
            <button
              type="button"
              onClick={handleClaim}
              disabled={isClaiming || isSwitching}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isClaiming || isSwitching ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {wrongChain ? `Switch to ${chainName} and claim` : `Claim ${token.symbol}`}
            </button>
          </div>
        ) : (
          <Status
            icon={<AlertCircle className="h-4 w-4" />}
            title="Not eligible"
            detail="No allocation found for this wallet."
          />
        )}
      </div>

      {claimError ? <p className="mt-3 text-sm text-destructive">{claimError}</p> : null}
      {txHash ? <p className="mt-3 break-all text-sm text-muted-foreground">Transaction submitted: {txHash}</p> : null}
    </section>
  );
}

function Status({
  icon,
  title,
  detail,
  actionLabel,
  onAction,
}: {
  icon: ReactNode;
  title: string;
  detail: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 text-primary">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="font-medium">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
      </div>
      {actionLabel && onAction ? (
        <button type="button" onClick={onAction} className="inline-flex items-center gap-1 text-sm text-primary underline">
          <RefreshCw className="h-3.5 w-3.5" />
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
