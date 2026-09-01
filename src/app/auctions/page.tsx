"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { formatEther, parseEther, zeroAddress } from "viem";
import {
  useAccount,
  useBlockNumber,
  useReadContract,
  useReadContracts,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { MEV_AUCTION_HOOK_ABI } from "@/lib/abi";
import { HOOK_ADDRESS, TOKEN0_SYMBOL, TOKEN1_SYMBOL } from "@/lib/constants";

type RequestInfo = {
  sender: `0x${string}`;
  currency0: `0x${string}`;
  currency1: `0x${string}`;
  zeroForOne: boolean;
  amountSpecified: bigint;
  deadlineBlock: bigint;
  highestBid: bigint;
  highestBidder: `0x${string}`;
  isCompleted: boolean;
  auctionOpen: boolean;
};

function AuctionCard({
  requestId,
  info,
  currentBlock,
}: {
  requestId: bigint;
  info: RequestInfo;
  currentBlock: bigint;
}) {
  const { address } = useAccount();
  const queryClient = useQueryClient();
  const [bidInput, setBidInput] = useState("");
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const [error, setError] = useState<string | undefined>();

  const { writeContractAsync, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  useEffect(() => {
    if (isSuccess) queryClient.invalidateQueries();
  }, [isSuccess, queryClient]);

  const absAmount = info.amountSpecified < 0n ? -info.amountSpecified : info.amountSpecified;
  const fromSymbol = info.zeroForOne ? TOKEN0_SYMBOL : TOKEN1_SYMBOL;
  const toSymbol = info.zeroForOne ? TOKEN1_SYMBOL : TOKEN0_SYMBOL;
  const blocksLeft =
    info.deadlineBlock > currentBlock ? info.deadlineBlock - currentBlock : 0n;
  const isClosed = !info.auctionOpen && !info.isCompleted;
  const isRequester = address?.toLowerCase() === info.sender.toLowerCase();
  const bidCurrencyIsNative = info.currency0 === zeroAddress;

  async function handleBid() {
    if (!bidInput) return;
    setError(undefined);
    const bidWei = parseEther(bidInput);
    try {
      const hash = await writeContractAsync({
        address: HOOK_ADDRESS,
        abi: MEV_AUCTION_HOOK_ABI,
        functionName: "submitBid",
        args: [requestId, bidCurrencyIsNative ? 0n : bidWei],
        value: bidCurrencyIsNative ? bidWei : 0n,
      });
      setTxHash(hash);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg.includes("User rejected") ? "Rejected." : msg.slice(0, 120));
    }
  }

  async function handleExecute() {
    setError(undefined);
    try {
      const hash = await writeContractAsync({
        address: HOOK_ADDRESS,
        abi: MEV_AUCTION_HOOK_ABI,
        functionName: "executeSwap",
        args: [requestId],
      });
      setTxHash(hash);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg.includes("User rejected") ? "Rejected." : msg.slice(0, 120));
    }
  }

  async function handleCancel() {
    setError(undefined);
    try {
      const hash = await writeContractAsync({
        address: HOOK_ADDRESS,
        abi: MEV_AUCTION_HOOK_ABI,
        functionName: "cancelSwap",
        args: [requestId],
      });
      setTxHash(hash);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg.includes("User rejected") ? "Rejected." : msg.slice(0, 120));
    }
  }

  const statusColor = info.isCompleted
    ? "bg-(--color-muted)/20 text-(--color-muted)"
    : info.auctionOpen
    ? "bg-(--color-secondary-dim) text-(--color-secondary)"
    : "bg-(--color-amber-dim) text-(--color-amber)";

  const statusLabel = info.isCompleted
    ? "Executed"
    : info.auctionOpen
    ? "Open"
    : "Closed";

  return (
    <div className="rounded-2xl border border-(--color-border) bg-(--color-surface) p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <span className="text-xs text-(--color-muted) font-mono">#{requestId.toString()}</span>
          <p className="mt-0.5 text-base font-semibold text-(--color-text)">
            {formatEther(absAmount)} {fromSymbol} → {toSymbol}
          </p>
          <p className="text-xs text-(--color-subtext) mt-0.5">
            by {info.sender.slice(0, 8)}…{info.sender.slice(-4)}
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor}`}>
          {statusLabel}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs mb-4">
        <div className="rounded-lg bg-(--color-bg) px-3 py-2">
          <p className="text-(--color-muted) mb-0.5">Deadline</p>
          <p className="font-mono text-(--color-text)">block {info.deadlineBlock.toString()}</p>
          {info.auctionOpen && (
            <p className="text-(--color-secondary) mt-0.5">{blocksLeft.toString()} blocks left</p>
          )}
        </div>
        <div className="rounded-lg bg-(--color-bg) px-3 py-2">
          <p className="text-(--color-muted) mb-0.5">Highest Bid</p>
          {info.highestBid > 0n ? (
            <>
              <p className="font-semibold text-(--color-amber)">{formatEther(info.highestBid)} {TOKEN0_SYMBOL}</p>
              <p className="text-(--color-subtext) mt-0.5 truncate">
                {info.highestBidder.slice(0, 8)}…{info.highestBidder.slice(-4)}
              </p>
            </>
          ) : (
            <p className="text-(--color-muted)">No bids yet</p>
          )}
        </div>
      </div>

      {error && (
        <p className="mb-3 rounded-lg bg-(--color-error)/10 px-3 py-2 text-xs text-(--color-error)">
          {error}
        </p>
      )}

      {isSuccess && (
        <p className="mb-3 rounded-lg bg-(--color-success)/10 px-3 py-2 text-xs text-(--color-success)">
          Transaction confirmed!
        </p>
      )}

      {/* Actions */}
      {info.auctionOpen && !info.isCompleted && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              type="number"
              min="0"
              step="any"
              placeholder={`Bid in ${TOKEN0_SYMBOL}`}
              value={bidInput}
              onChange={(e) => setBidInput(e.target.value)}
              className="flex-1 rounded-lg border border-(--color-border) bg-(--color-bg) px-3 py-2 text-sm text-(--color-text) placeholder:text-(--color-muted) outline-none focus:border-(--color-primary) [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <button
              onClick={handleBid}
              disabled={!bidInput || isPending || isConfirming}
              className="shrink-0 rounded-lg bg-(--color-amber) px-4 py-2 text-sm font-medium text-black hover:opacity-90 disabled:opacity-40 transition-opacity"
            >
              {isPending || isConfirming ? "…" : "Bid"}
            </button>
          </div>
          {isRequester && info.highestBid === 0n && (
            <button
              onClick={handleCancel}
              disabled={isPending || isConfirming}
              className="w-full rounded-lg border border-(--color-border) py-2 text-xs text-(--color-subtext) hover:text-(--color-error) hover:border-(--color-error) disabled:opacity-40 transition-colors"
            >
              Cancel Swap
            </button>
          )}
        </div>
      )}

      {isClosed && (
        <button
          onClick={handleExecute}
          disabled={isPending || isConfirming}
          className="w-full rounded-lg bg-(--color-primary) py-2.5 text-sm font-medium text-white hover:bg-(--color-primary-hover) disabled:opacity-40 transition-colors"
        >
          {isPending || isConfirming ? "Confirming…" : "Execute Swap"}
        </button>
      )}
    </div>
  );
}

export default function AuctionsPage() {
  const { data: blockNumber } = useBlockNumber({ watch: true });
  const { data: nextIdRaw, isLoading: nextIdLoading } = useReadContract({
    address: HOOK_ADDRESS,
    abi: MEV_AUCTION_HOOK_ABI,
    functionName: "nextRequestId",
    query: { refetchInterval: 4000 },
  });

  const nextId = nextIdRaw ?? 0n;
  const ids = Array.from({ length: Number(nextId) }, (_, i) => BigInt(i));

  const results = useReadContracts({
    contracts: ids.map((id) => ({
      address: HOOK_ADDRESS,
      abi: MEV_AUCTION_HOOK_ABI,
      functionName: "getRequestInfo" as const,
      args: [id] as const,
    })),
    query: { refetchInterval: 4000 },
  });

  const auctions = ids
    .map((id, i) => ({
      id,
      info: results.data?.[i]?.result as RequestInfo | undefined,
    }))
    .filter((a) => a.info !== undefined && !a.info.isCompleted)
    .reverse();

  const completed = ids
    .map((id, i) => ({
      id,
      info: results.data?.[i]?.result as RequestInfo | undefined,
    }))
    .filter((a) => a.info?.isCompleted)
    .reverse();

  const currentBlock = blockNumber ?? 0n;
  const isLoading = nextIdLoading || (nextId > 0n && results.isLoading);

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-(--color-text)">Live Auctions</h1>
          <p className="mt-1 text-sm text-(--color-subtext)">
            Submit bids to execute swaps and earn the spread. Bids donate to LPs.
          </p>
        </div>
        {blockNumber && (
          <span className="text-xs font-mono text-(--color-muted)">
            block {blockNumber.toString()}
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="rounded-2xl border border-(--color-border) bg-(--color-surface) p-10 text-center">
          <p className="text-(--color-muted) text-sm">Loading auctions…</p>
        </div>
      ) : nextId === 0n ? (
        <div className="rounded-2xl border border-(--color-border) bg-(--color-surface) p-10 text-center">
          <p className="text-(--color-muted) text-sm">No swap requests yet.</p>
          <a href="/" className="mt-2 inline-block text-sm text-(--color-primary) hover:underline">
            Request a swap →
          </a>
        </div>
      ) : (
        <div className="space-y-4">
          {auctions.length > 0 && (
            <>
              <h2 className="text-xs font-semibold text-(--color-subtext) uppercase tracking-wide">
                Active ({auctions.length})
              </h2>
              {auctions.map(({ id, info }) =>
                info ? (
                  <AuctionCard
                    key={id.toString()}
                    requestId={id}
                    info={info}
                    currentBlock={currentBlock}
                  />
                ) : null
              )}
            </>
          )}

          {completed.length > 0 && (
            <>
              <h2 className="mt-6 text-xs font-semibold text-(--color-subtext) uppercase tracking-wide">
                Completed ({completed.length})
              </h2>
              {completed.map(({ id, info }) =>
                info ? (
                  <AuctionCard
                    key={id.toString()}
                    requestId={id}
                    info={info}
                    currentBlock={currentBlock}
                  />
                ) : null
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
