"use client";

import { useState } from "react";
import { parseEther, parseUnits, zeroAddress } from "viem";
import {
  useAccount,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { MEV_AUCTION_HOOK_ABI } from "@/lib/abi";
import { HOOK_ADDRESS, POOL_KEY, TOKEN0_SYMBOL, TOKEN1_SYMBOL } from "@/lib/constants";

export default function SwapPage() {
  const { isConnected } = useAccount();
  const [amount, setAmount] = useState("");
  const [zeroForOne, setZeroForOne] = useState(true);
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [doneSmall, setDoneSmall] = useState(false);

  const { data: auctionWindow } = useReadContract({
    address: HOOK_ADDRESS,
    abi: MEV_AUCTION_HOOK_ABI,
    functionName: "auctionWindowBlocks",
  });

  const { data: smallThreshold } = useReadContract({
    address: HOOK_ADDRESS,
    abi: MEV_AUCTION_HOOK_ABI,
    functionName: "smallSwapThreshold",
  });

  const { writeContractAsync, isPending } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const fromSymbol = zeroForOne ? TOKEN0_SYMBOL : TOKEN1_SYMBOL;
  const toSymbol = zeroForOne ? TOKEN1_SYMBOL : TOKEN0_SYMBOL;

  const isNativeIn =
    zeroForOne
      ? POOL_KEY.currency0 === zeroAddress
      : POOL_KEY.currency1 === zeroAddress;

  const parsedAmount = (() => {
    try {
      return isNativeIn ? parseEther(amount || "0") : parseUnits(amount || "0", 18);
    } catch {
      return 0n;
    }
  })();

  const isSmall =
    smallThreshold !== undefined &&
    parsedAmount < smallThreshold &&
    parsedAmount > 0n;

  async function handleSwap() {
    if (!amount || parsedAmount === 0n) return;
    setError(undefined);
    setTxHash(undefined);
    setDoneSmall(false);

    try {
      const hash = await writeContractAsync({
        address: HOOK_ADDRESS,
        abi: MEV_AUCTION_HOOK_ABI,
        functionName: "requestSwap",
        args: [
          POOL_KEY,
          {
            zeroForOne,
            amountSpecified: -parsedAmount,
            sqrtPriceLimitX96: 0n,
          },
        ],
        value: isNativeIn ? parsedAmount : 0n,
      });
      setTxHash(hash);
      if (isSmall) setDoneSmall(true);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(
        msg.includes("User rejected") ? "Transaction rejected." : msg.slice(0, 140)
      );
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-(--color-text)">Protected Swap</h1>
        <p className="mt-1 text-sm text-(--color-subtext)">
          Large swaps enter a MEV auction — searchers compete and donate winning
          bids back to LPs.
        </p>
      </div>

      <div className="rounded-2xl border border-(--color-border) bg-(--color-surface) p-5 shadow-lg">
        {/* From */}
        <label className="mb-1 block text-xs font-medium text-(--color-subtext) uppercase tracking-wide">
          You Pay
        </label>
        <div className="flex items-center gap-3 rounded-xl border border-(--color-border) bg-(--color-bg) px-4 py-3 focus-within:border-(--color-primary) transition-colors">
          <input
            type="number"
            min="0"
            step="any"
            placeholder="0.0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="flex-1 bg-transparent text-xl font-semibold text-(--color-text) placeholder:text-(--color-muted) outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <span className="shrink-0 rounded-lg bg-(--color-surface-alt) px-2.5 py-1 text-sm font-medium text-(--color-text)">
            {fromSymbol}
          </span>
        </div>

        {/* Flip */}
        <div className="flex justify-center my-3">
          <button
            onClick={() => setZeroForOne((v) => !v)}
            className="rounded-full border border-(--color-border) bg-(--color-surface-alt) p-2 hover:border-(--color-primary) hover:text-(--color-primary) transition-colors text-(--color-subtext)"
            title="Flip direction"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M8 2v12M4 10l4 4 4-4M4 6l4-4 4 4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>

        {/* To */}
        <label className="mb-1 block text-xs font-medium text-(--color-subtext) uppercase tracking-wide">
          You Receive
        </label>
        <div className="flex items-center gap-3 rounded-xl border border-(--color-border) bg-(--color-bg) px-4 py-3">
          <span className="flex-1 text-xl font-semibold text-(--color-muted)">~</span>
          <span className="shrink-0 rounded-lg bg-(--color-surface-alt) px-2.5 py-1 text-sm font-medium text-(--color-text)">
            {toSymbol}
          </span>
        </div>

        {/* Auction info */}
        {parsedAmount > 0n && (
          <div
            className={`mt-4 rounded-lg px-3 py-2 text-xs ${
              isSmall
                ? "bg-(--color-success)/10 text-(--color-success)"
                : "bg-(--color-secondary-dim) text-(--color-secondary)"
            }`}
          >
            {isSmall ? (
              "Small swap — executes instantly, no auction."
            ) : (
              <>
                Large swap — enters MEV auction.{" "}
                {auctionWindow !== undefined && (
                  <span className="font-semibold">
                    Window: {auctionWindow.toString()} blocks.
                  </span>
                )}
              </>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <p className="mt-3 rounded-lg bg-(--color-error)/10 px-3 py-2 text-xs text-(--color-error)">
            {error}
          </p>
        )}

        {/* Success */}
        {isSuccess && doneSmall && (
          <div className="mt-3 rounded-lg bg-(--color-success)/10 px-3 py-2 text-xs text-(--color-success)">
            Swap executed instantly.
          </div>
        )}
        {isSuccess && !doneSmall && (
          <div className="mt-3 rounded-lg bg-(--color-secondary-dim) px-3 py-2 text-xs text-(--color-secondary)">
            Swap requested! Track it in{" "}
            <a href="/auctions" className="underline font-medium">
              Live Auctions
            </a>
            .
          </div>
        )}

        <button
          onClick={handleSwap}
          disabled={
            !isConnected ||
            !amount ||
            parsedAmount === 0n ||
            isPending ||
            isConfirming
          }
          className="mt-4 w-full rounded-xl bg-(--color-primary) py-3 text-sm font-semibold text-white hover:bg-(--color-primary-hover) disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {!isConnected
            ? "Connect Wallet"
            : isPending
            ? "Confirm in wallet…"
            : isConfirming
            ? "Confirming…"
            : "Request Protected Swap"}
        </button>
      </div>

      <p className="mt-4 text-center text-xs text-(--color-muted) font-mono">
        {HOOK_ADDRESS === "0x0000000000000000000000000000000000000000"
          ? "Hook not deployed — set NEXT_PUBLIC_HOOK_ADDRESS"
          : `Hook: ${HOOK_ADDRESS.slice(0, 10)}…${HOOK_ADDRESS.slice(-6)}`}
      </p>
    </div>
  );
}
