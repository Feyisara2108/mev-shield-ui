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

type Filter = "ALL" | "Open" | "Closed";

function formatBlocks(blocks: bigint): string {
  const secs = Number(blocks);
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function StatusBadge({
  info,
  isRequester,
}: {
  info: RequestInfo;
  isRequester: boolean;
}) {
  if (info.isCompleted) {
    return (
      <span className="rounded-md px-2 py-0.5 text-xs font-semibold bg-(--color-muted)/20 text-(--color-muted)">
        EXECUTED
      </span>
    );
  }
  if (isRequester) {
    return (
      <span className="rounded-md px-2 py-0.5 text-xs font-semibold bg-(--color-primary)/20 text-(--color-primary)">
        YOUR AUCTION
      </span>
    );
  }
  if (info.auctionOpen) {
    return (
      <span className="rounded-md px-2 py-0.5 text-xs font-semibold bg-(--color-secondary-dim) text-(--color-secondary)">
        OPEN
      </span>
    );
  }
  return (
    <span className="rounded-md px-2 py-0.5 text-xs font-semibold bg-(--color-amber-dim) text-(--color-amber)">
      CLOSED
    </span>
  );
}

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
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  useEffect(() => {
    if (isSuccess) queryClient.invalidateQueries();
  }, [isSuccess, queryClient]);

  const absAmount =
    info.amountSpecified < 0n ? -info.amountSpecified : info.amountSpecified;
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

  return (
    <div className="rounded-xl border border-(--color-border) bg-(--color-surface) overflow-hidden">
      {/* Header row */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-(--color-border)">
        <div className="flex items-center gap-2 text-xs text-(--color-muted) font-mono">
          <span>{info.sender.slice(0, 8)}…{info.sender.slice(-2)}</span>
          <svg viewBox="0 0 16 16" fill="none" className="w-3 h-3">
            <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="font-semibold text-(--color-text)">
            {fromSymbol} → {toSymbol}
          </span>
        </div>
        <StatusBadge info={info} isRequester={isRequester} />
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-3 divide-x divide-(--color-border)">
        <div className="px-4 py-3">
          <p className="text-xs text-(--color-muted) mb-1">Swap Amount</p>
          <p className="text-sm font-semibold text-(--color-text)">
            {formatEther(absAmount)} {fromSymbol}
          </p>
        </div>
        <div className="px-4 py-3">
          <p className="text-xs text-(--color-muted) mb-1">
            {info.isCompleted ? "Winning Bid" : "Highest Bid"}
          </p>
          <p
            className={`text-sm font-semibold ${
              info.highestBid > 0n
                ? "text-(--color-amber)"
                : "text-(--color-muted)"
            }`}
          >
            {info.highestBid > 0n
              ? `${formatEther(info.highestBid)} ETH`
              : "None"}
          </p>
        </div>
        <div className="px-4 py-3">
          <p className="text-xs text-(--color-muted) mb-1">
            {info.isCompleted ? "Final Status" : "Time Remaining"}
          </p>
          <p
            className={`text-sm font-semibold font-mono ${
              info.isCompleted
                ? "text-(--color-muted)"
                : info.auctionOpen
                ? "text-(--color-error)"
                : "text-(--color-subtext)"
            }`}
          >
            {info.isCompleted
              ? "Settled"
              : info.auctionOpen
              ? formatBlocks(blocksLeft)
              : "Closed"}
          </p>
        </div>
      </div>

      {/* Executed banner */}
      {info.isCompleted && info.highestBid > 0n && (
        <div className="px-4 py-2 border-t border-(--color-border) bg-(--color-success)/5 flex items-center gap-1.5 text-xs text-(--color-success)">
          <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5 shrink-0">
            <path
              fillRule="evenodd"
              d="M8 15A7 7 0 108 1a7 7 0 000 14zm3.707-9.293a1 1 0 00-1.414-1.414L7 7.586 5.707 6.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
          Executed — {formatEther(info.highestBid)} ETH donated to LPs
        </div>
      )}

      {/* Error / success */}
      {error && (
        <div className="px-4 pb-2">
          <p className="rounded-lg bg-(--color-error)/10 px-3 py-2 text-xs text-(--color-error)">
            {error}
          </p>
        </div>
      )}
      {isSuccess && (
        <div className="px-4 pb-2">
          <p className="rounded-lg bg-(--color-success)/10 px-3 py-2 text-xs text-(--color-success)">
            Transaction confirmed!
          </p>
        </div>
      )}

      {/* Action area — open auction */}
      {info.auctionOpen && !info.isCompleted && (
        <div className="px-4 py-3 border-t border-(--color-border) flex items-center gap-2">
          <input
            type="number"
            min="0"
            step="any"
            placeholder={`Bid (${TOKEN0_SYMBOL})`}
            value={bidInput}
            onChange={(e) => setBidInput(e.target.value)}
            className="flex-1 rounded-lg border border-(--color-border) bg-(--color-bg) px-3 py-2 text-sm text-(--color-text) placeholder:text-(--color-muted) outline-none focus:border-(--color-primary) [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <button
            onClick={handleBid}
            disabled={!bidInput || isPending || isConfirming}
            className="shrink-0 rounded-lg bg-(--color-amber) px-4 py-2 text-sm font-medium text-black hover:opacity-90 disabled:opacity-40 transition-opacity"
          >
            {isPending || isConfirming ? "…" : "Place Bid"}
          </button>
          {isRequester && info.highestBid === 0n && (
            <button
              onClick={handleCancel}
              disabled={isPending || isConfirming}
              className="shrink-0 rounded-lg border border-(--color-error)/40 px-3 py-2 text-sm text-(--color-error) hover:bg-(--color-error)/10 disabled:opacity-40 transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      )}

      {/* Action area — closed, ready to execute */}
      {isClosed && (
        <div className="px-4 py-3 border-t border-(--color-border)">
          <button
            onClick={handleExecute}
            disabled={isPending || isConfirming}
            className="w-full rounded-lg bg-(--color-primary) py-2.5 text-sm font-medium text-white hover:bg-(--color-primary-hover) disabled:opacity-40 transition-colors"
          >
            {isPending || isConfirming ? "Confirming…" : "Execute Swap"}
          </button>
        </div>
      )}
    </div>
  );
}

export default function AuctionsPage() {
  const [filter, setFilter] = useState<Filter>("ALL");
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

  const currentBlock = blockNumber ?? 0n;
  const isLoading = nextIdLoading || (nextId > 0n && results.isLoading);

  const allAuctions = ids
    .map((id, i) => ({
      id,
      info: results.data?.[i]?.result as RequestInfo | undefined,
    }))
    .filter((a) => a.info !== undefined)
    .reverse();

  const openAuctions = allAuctions.filter(
    (a) => a.info?.auctionOpen && !a.info?.isCompleted
  );
  const closedAuctions = allAuctions.filter(
    (a) => a.info?.isCompleted || (!a.info?.auctionOpen && !a.info?.isCompleted)
  );

  const displayed =
    filter === "Open"
      ? openAuctions
      : filter === "Closed"
      ? closedAuctions
      : allAuctions;

  const totalBidVolume = openAuctions.reduce(
    (sum, a) => sum + (a.info?.highestBid ?? 0n),
    0n
  );

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-(--color-text)">Live Auctions</h1>
        <p className="mt-1 text-sm text-(--color-subtext)">
          Participate in MEV recapture events.
        </p>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 divide-x divide-(--color-border) rounded-xl border border-(--color-border) bg-(--color-surface) mb-5 overflow-hidden">
        <div className="px-4 py-3">
          <p className="text-xs text-(--color-muted) mb-1">Open Auctions</p>
          <p className="text-2xl font-bold text-(--color-text)">
            {openAuctions.length}
          </p>
        </div>
        <div className="px-4 py-3">
          <p className="text-xs text-(--color-muted) mb-1">Total Bid Volume</p>
          <p className="text-2xl font-bold text-(--color-text)">
            {parseFloat(formatEther(totalBidVolume)).toFixed(2)} ETH
          </p>
        </div>
        <div className="px-4 py-3">
          <p className="text-xs text-(--color-muted) mb-1">Avg Recapture Rate</p>
          <p className="text-2xl font-bold text-(--color-text)">500 bps</p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 mb-5">
        {(["ALL", "Open", "Closed"] as Filter[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`px-4 py-1.5 text-sm rounded-md font-medium transition-colors ${
              filter === tab
                ? "bg-(--color-primary)/20 text-(--color-primary)"
                : "text-(--color-subtext) hover:text-(--color-text)"
            }`}
          >
            {tab}
          </button>
        ))}
        {blockNumber && (
          <span className="ml-auto text-xs font-mono text-(--color-muted)">
            block {blockNumber.toString()}
          </span>
        )}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="rounded-xl border border-(--color-border) bg-(--color-surface) p-10 text-center">
          <p className="text-(--color-muted) text-sm">Loading auctions…</p>
        </div>
      ) : displayed.length === 0 ? (
        <div className="rounded-xl border border-(--color-border) bg-(--color-surface) p-10 text-center">
          <p className="text-(--color-muted) text-sm">
            {nextId === 0n ? "No swap requests yet." : "No auctions in this filter."}
          </p>
          {nextId === 0n && (
            <a
              href="/"
              className="mt-2 inline-block text-sm text-(--color-primary) hover:underline"
            >
              Request a swap →
            </a>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {displayed.map(({ id, info }) =>
            info ? (
              <AuctionCard
                key={id.toString()}
                requestId={id}
                info={info}
                currentBlock={currentBlock}
              />
            ) : null
          )}
        </div>
      )}
    </div>
  );
}
