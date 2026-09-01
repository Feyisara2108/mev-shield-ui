"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { formatEther, zeroAddress } from "viem";
import {
  useAccount,
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

function WithdrawRefundCard({
  currencyAddress,
  amount,
}: {
  currencyAddress: `0x${string}`;
  amount: bigint;
}) {
  const queryClient = useQueryClient();
  const { writeContractAsync, isPending } = useWriteContract();
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const [error, setError] = useState<string | undefined>();
  const { isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  useEffect(() => {
    if (isSuccess) queryClient.invalidateQueries();
  }, [isSuccess, queryClient]);

  const symbol = currencyAddress === zeroAddress ? TOKEN0_SYMBOL : TOKEN1_SYMBOL;

  async function handleWithdraw() {
    setError(undefined);
    try {
      const hash = await writeContractAsync({
        address: HOOK_ADDRESS,
        abi: MEV_AUCTION_HOOK_ABI,
        functionName: "withdrawRefund",
        args: [currencyAddress],
      });
      setTxHash(hash);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg.includes("User rejected") ? "Rejected." : msg.slice(0, 120));
    }
  }

  if (isSuccess) return null;

  return (
    <div className="rounded-2xl border border-(--color-amber)/40 bg-(--color-amber-dim) p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs text-(--color-amber) font-medium mb-0.5">Pending Refund</p>
          <p className="text-xl font-bold text-(--color-text)">
            {formatEther(amount)} {symbol}
          </p>
          <p className="text-xs text-(--color-subtext) mt-0.5">Your outbid was returned here</p>
        </div>
        <button
          onClick={handleWithdraw}
          disabled={isPending}
          className="shrink-0 rounded-xl bg-(--color-amber) px-4 py-2.5 text-sm font-semibold text-black hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {isPending ? "Confirming…" : "Withdraw"}
        </button>
      </div>
      {error && (
        <p className="mt-2 text-xs text-(--color-error)">{error}</p>
      )}
    </div>
  );
}

function ActivityRow({
  requestId,
  info,
  userAddress,
}: {
  requestId: bigint;
  info: RequestInfo;
  userAddress: `0x${string}`;
}) {
  const absAmount = info.amountSpecified < 0n ? -info.amountSpecified : info.amountSpecified;
  const fromSymbol = info.zeroForOne ? TOKEN0_SYMBOL : TOKEN1_SYMBOL;
  const toSymbol = info.zeroForOne ? TOKEN1_SYMBOL : TOKEN0_SYMBOL;

  const isRequester = userAddress.toLowerCase() === info.sender.toLowerCase();
  const isBidder = userAddress.toLowerCase() === info.highestBidder.toLowerCase();
  const role = isRequester ? "Requester" : isBidder ? "Highest Bidder" : "Participant";

  const statusLabel = info.isCompleted
    ? "Executed"
    : info.auctionOpen
    ? "Open"
    : "Closed";

  const statusColor = info.isCompleted
    ? "text-(--color-muted)"
    : info.auctionOpen
    ? "text-(--color-secondary)"
    : "text-(--color-amber)";

  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-(--color-border) bg-(--color-surface) px-4 py-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-xs font-mono text-(--color-muted)">#{requestId.toString()}</span>
          <span className="text-xs rounded-full bg-(--color-surface-alt) px-2 py-0.5 text-(--color-subtext)">
            {role}
          </span>
        </div>
        <p className="text-sm font-semibold text-(--color-text)">
          {formatEther(absAmount)} {fromSymbol} → {toSymbol}
        </p>
        {info.highestBid > 0n && (
          <p className="text-xs text-(--color-subtext) mt-0.5">
            Top bid: <span className="text-(--color-amber) font-medium">{formatEther(info.highestBid)} {TOKEN0_SYMBOL}</span>
          </p>
        )}
      </div>
      <div className="shrink-0 text-right">
        <span className={`text-xs font-medium ${statusColor}`}>{statusLabel}</span>
        <p className="text-xs text-(--color-muted) mt-0.5">block {info.deadlineBlock.toString()}</p>
      </div>
    </div>
  );
}

export default function ActivityPage() {
  const { address, isConnected } = useAccount();

  const { data: nextIdRaw, isLoading: nextIdLoading } = useReadContract({
    address: HOOK_ADDRESS,
    abi: MEV_AUCTION_HOOK_ABI,
    functionName: "nextRequestId",
    query: { refetchInterval: 5000 },
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
    query: { refetchInterval: 5000 },
  });

  // Pending refund in ETH (currency0 = address(0))
  const { data: ethRefund } = useReadContract({
    address: HOOK_ADDRESS,
    abi: MEV_AUCTION_HOOK_ABI,
    functionName: "pendingRefunds",
    args: address ? [address, zeroAddress] : undefined,
    query: { enabled: !!address, refetchInterval: 5000 },
  });

  if (!isConnected || !address) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <p className="text-(--color-subtext) text-sm">Connect your wallet to see your activity.</p>
      </div>
    );
  }

  const myActivity = ids
    .map((id, i) => ({
      id,
      info: results.data?.[i]?.result as RequestInfo | undefined,
    }))
    .filter(
      (a) =>
        a.info !== undefined &&
        (a.info.sender.toLowerCase() === address.toLowerCase() ||
          a.info.highestBidder.toLowerCase() === address.toLowerCase())
    )
    .reverse();

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-(--color-text)">My Activity</h1>
        <p className="mt-1 text-sm text-(--color-subtext)">
          Your swap requests and bids.
        </p>
      </div>

      {/* Refunds */}
      {ethRefund !== undefined && ethRefund > 0n && (
        <div className="mb-6">
          <h2 className="mb-3 text-xs font-semibold text-(--color-subtext) uppercase tracking-wide">
            Refunds Available
          </h2>
          <WithdrawRefundCard currencyAddress={zeroAddress} amount={ethRefund} />
        </div>
      )}

      {/* Activity list */}
      {nextIdLoading ? (
        <div className="rounded-2xl border border-(--color-border) bg-(--color-surface) p-10 text-center">
          <p className="text-(--color-muted) text-sm">Loading…</p>
        </div>
      ) : myActivity.length === 0 ? (
        <div className="rounded-2xl border border-(--color-border) bg-(--color-surface) p-10 text-center">
          <p className="text-(--color-muted) text-sm">No activity yet.</p>
          <a href="/" className="mt-2 inline-block text-sm text-(--color-primary) hover:underline">
            Request a swap →
          </a>
        </div>
      ) : (
        <div className="space-y-3">
          <h2 className="text-xs font-semibold text-(--color-subtext) uppercase tracking-wide">
            History ({myActivity.length})
          </h2>
          {myActivity.map(({ id, info }) =>
            info ? (
              <ActivityRow
                key={id.toString()}
                requestId={id}
                info={info}
                userAddress={address}
              />
            ) : null
          )}
        </div>
      )}
    </div>
  );
}
