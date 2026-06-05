"use client";

import { useCallback, useMemo } from "react";
import { keccak256, stringToHex } from "viem";
import { base } from "viem/chains";
import { useAccount, useSignMessage, useSwitchChain } from "wagmi";
import { type WalletAdapter } from "../lib/terms-quiz-types";

export function useWalletAdapter() {
  const { address, chainId } = useAccount();
  const { switchChainAsync, isPending: isSwitching } = useSwitchChain();
  const { signMessageAsync, isPending: isSigning } = useSignMessage();

  const switchToBase = useCallback(async () => {
    if (!switchChainAsync) throw new Error("Network switching is unavailable for this wallet.");
    await switchChainAsync({ chainId: base.id });
  }, [switchChainAsync]);

  const signAttestation = useCallback(
    async (data: unknown) => {
      const message = [
        "K9 Terms Quiz Acknowledgement",
        "",
        "This signature confirms that you completed the quiz and accepted the terms shown in this session.",
        "",
        JSON.stringify(data, null, 2),
      ].join("\n");

      const signature = await signMessageAsync({ message });
      await new Promise(resolve => setTimeout(resolve, 600));
      return keccak256(stringToHex(`${signature}:${Date.now()}`)) as `0x${string}`;
    },
    [signMessageAsync],
  );

  const wallet = useMemo<WalletAdapter>(
    () => ({
      address: address as `0x${string}` | undefined,
      chainId,
      switchToBase,
      signAttestation,
    }),
    [address, chainId, switchToBase, signAttestation],
  );

  return { wallet, isSwitching, isSigning };
}
