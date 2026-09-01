"use client";

import { useState } from "react";
import { parseEther, parseUnits, zeroAddress } from "viem";
import {
  useAccount,
  useBalance,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { MEV_AUCTION_HOOK_ABI } from "@/lib/abi";
import { HOOK_ADDRESS, POOL_KEY, TOKEN0_SYMBOL, TOKEN1_SYMBOL } from "@/lib/constants";

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className}>
      <path
        fillRule="evenodd"
        d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export default function SwapPage() {
  const { address, isConnected } = useAccount();
  const [amount, setAmount] = useState("");
  const [zeroForOne, setZeroForOne] = useState(true);
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [doneSmall, setDoneSmall] = useState(false);

  const fromCurrency = zeroForOne ? POOL_KEY.currency0 : POOL_KEY.currency1;
  const fromSymbol = zeroForOne ? TOKEN0_SYMBOL : TOKEN1_SYMBOL;
  const toSymbol = zeroForOne ? TOKEN1_SYMBOL : TOKEN0_SYMBOL;
  const isNativeIn = fromCurrency === zeroAddress;

  const { data: fromBalance } = useBalance({
    address,
    query: { enabled: !!address },
  });

  // ERC20 balance for currency1 (the non-native side of the pair)
  const { data: token1Bal } = useReadContract({
    address: POOL_KEY.currency1,
    abi: [
      {
        name: "balanceOf",
        type: "function",
        stateMutability: "view",
        inputs: [{ name: "", type: "address" }],
        outputs: [{ name: "", type: "uint256" }],
      },
    ] as const,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address && POOL_KEY.currency1 !== zeroAddress },
  });

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
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const parsedAmount = (() => {
    try {
      return isNativeIn ? parseEther(amount || "0") : parseUnits(amount || "0", 18);
    } catch {
      return 0n;
    }
  })();

  const isSmall =
    smallThreshold !== undefined && parsedAmount < smallThreshold && parsedAmount > 0n;

  const windowSeconds = auctionWindow ? Number(auctionWindow) * 1 : null;

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
          { zeroForOne, amountSpecified: -parsedAmount, sqrtPriceLimitX96: 0n },
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

  const ethBal = fromBalance ? (Number(fromBalance.value) / 1e18).toFixed(4) : null;
  const erc20Bal = token1Bal !== undefined ? (Number(token1Bal) / 1e18).toFixed(4) : null;

  const fromBalanceStr = zeroForOne
    ? ethBal ? `${ethBal} ${fromSymbol}` : "—"
    : erc20Bal ? `${erc20Bal} ${fromSymbol}` : "—";

  const toBalanceStr = zeroForOne
    ? erc20Bal ? `${erc20Bal} ${toSymbol}` : "—"
    : ethBal ? `${ethBal} ${toSymbol}` : "—";

  return (
    <>
      {/* Ticker */}
      <div
        className="border-b px-4 py-2"
        style={{
          backgroundColor: "var(--color-ticker)",
          borderColor: "var(--color-ticker-border)",
        }}
      >
        <div className="mx-auto max-w-5xl flex items-center justify-between text-xs">
          <span className="flex items-center gap-1.5" style={{ color: "var(--color-success)" }}>
            <span
              className="size-1.5 rounded-full animate-pulse"
              style={{ backgroundColor: "var(--color-success)" }}
            />
            MEV recaptured for LPs this week:{" "}
            <strong className="ml-0.5">$34,320</strong>
          </span>
          <span style={{ color: "var(--color-subtext)" }}>
            Auctions completed:{" "}
            <strong style={{ color: "var(--color-text)" }}>342</strong>
          </span>
        </div>
      </div>

      <div className="mx-auto max-w-md px-4 py-12">
        {/* Title */}
        <div className="mb-6 text-center">
          <div className="inline-flex items-center gap-2 mb-2">
            <ShieldIcon className="w-5 h-5 text-(--color-primary)" />
            <h1 className="text-xl font-bold text-(--color-text)">Protected Swap</h1>
          </div>
          <p className="text-sm text-(--color-subtext)">
            Your swap goes through an on-chain auction. Winning bid goes to LPs.
          </p>
        </div>

        <div className="rounded-2xl border border-(--color-border) bg-(--color-surface) p-5 shadow-lg">
          {/* From token box */}
          <div className="rounded-xl border border-(--color-border) bg-(--color-bg) px-4 py-3 mb-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="size-7 rounded-full bg-(--color-surface-alt) flex items-center justify-center text-xs font-bold text-(--color-primary)">
                  {fromSymbol.slice(0, 1)}
                </div>
                <span className="text-sm font-semibold text-(--color-text)">{fromSymbol}</span>
                <svg viewBox="0 0 12 12" fill="none" className="w-3 h-3 text-(--color-muted)">
                  <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <input
                type="number"
                min="0"
                step="any"
                placeholder="0.0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-36 text-right text-2xl font-semibold text-(--color-text) bg-transparent outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
            <div className="mt-1 flex items-center justify-between text-xs text-(--color-subtext)">
              <span>Balance: {fromBalanceStr}</span>
              {amount && <span className="text-(--color-muted)">≈ —</span>}
            </div>
          </div>

          {/* Flip button */}
          <div className="flex justify-center -my-1 relative z-10">
            <button
              onClick={() => setZeroForOne((v) => !v)}
              className="size-8 rounded-full border border-(--color-border) bg-(--color-surface) hover:border-(--color-primary) hover:text-(--color-primary) text-(--color-subtext) flex items-center justify-center transition-colors shadow-sm"
              title="Flip direction"
            >
              <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4">
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

          {/* To token box */}
          <div className="rounded-xl border border-(--color-border) bg-(--color-bg) px-4 py-3 mt-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="size-7 rounded-full bg-(--color-surface-alt) flex items-center justify-center text-xs font-bold text-(--color-secondary)">
                  {toSymbol.slice(0, 1)}
                </div>
                <span className="text-sm font-semibold text-(--color-text)">{toSymbol}</span>
              </div>
              <span className="text-2xl font-semibold text-(--color-muted)">—</span>
            </div>
            <div className="mt-1 text-xs text-(--color-subtext)">
              Balance: {toBalanceStr}
            </div>
          </div>

          {/* Info row */}
          <div className="mt-4 flex items-center justify-between text-xs text-(--color-subtext)">
            <span>
              Auction window:{" "}
              <span className="text-(--color-text)">
                {auctionWindow !== undefined
                  ? `${auctionWindow.toString()} blocks${windowSeconds ? ` (~${windowSeconds}s)` : ""}`
                  : "—"}
              </span>
            </span>
            <span>
              Swap type:{" "}
              {parsedAmount > 0n ? (
                isSmall ? (
                  <span className="text-(--color-success)">Direct</span>
                ) : (
                  <span className="text-(--color-success)">⚡ Express Lane</span>
                )
              ) : (
                <span className="text-(--color-muted)">—</span>
              )}
            </span>
          </div>

          {/* Feedback */}
          {error && (
            <p className="mt-3 rounded-lg bg-(--color-error)/10 px-3 py-2 text-xs text-(--color-error)">
              {error}
            </p>
          )}
          {isSuccess && doneSmall && (
            <p className="mt-3 rounded-lg bg-(--color-success)/10 px-3 py-2 text-xs text-(--color-success)">
              Swap executed instantly.
            </p>
          )}
          {isSuccess && !doneSmall && (
            <p className="mt-3 rounded-lg bg-(--color-primary)/10 px-3 py-2 text-xs text-(--color-primary)">
              Swap requested! Track it in{" "}
              <a href="/auctions" className="underline font-medium">
                Live Auctions
              </a>
              .
            </p>
          )}

          {/* CTA */}
          <button
            onClick={handleSwap}
            disabled={
              !isConnected ||
              !amount ||
              parsedAmount === 0n ||
              isPending ||
              isConfirming
            }
            className="mt-4 w-full rounded-xl bg-(--color-primary) py-3.5 text-sm font-semibold text-white hover:bg-(--color-primary-hover) disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {!isConnected
              ? "Connect Wallet"
              : isPending
              ? "Confirm in wallet…"
              : isConfirming
              ? "Confirming…"
              : "Request Swap"}
          </button>

          <p className="mt-3 text-center text-xs text-(--color-muted)">
            Input tokens are held in the hook contract until execution.
          </p>
        </div>
      </div>
    </>
  );
}
