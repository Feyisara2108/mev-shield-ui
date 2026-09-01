"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { formatEther, zeroAddress } from "viem";
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

function SwapStatusBadge({ info }: { info: RequestInfo }) {
  if (info.isCompleted) {
    return (
      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-(--color-success)/15 text-(--color-success)">
        Completed
      </span>
    );
  }
  if (info.auctionOpen) {
    return (
      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-(--color-amber-dim) text-(--color-amber)">
        Pending Auction
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-(--color-secondary-dim) text-(--color-secondary)">
      Awaiting Swap
    </span>
  );
}

function BidStatusBadge({
  info,
  address,
  hasRefund,
}: {
  info: RequestInfo;
  address: `0x${string}`;
  hasRefund: boolean;
}) {
  const isWinner = info.highestBidder.toLowerCase() === address.toLowerCase();
  if (hasRefund) {
    return (
      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-(--color-error)/15 text-(--color-error)">
        Refund
      </span>
    );
  }
  if (isWinner && info.isCompleted) {
    return (
      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-(--color-muted)/15 text-(--color-muted)">
        Settled
      </span>
    );
  }
  if (isWinner) {
    return (
      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-(--color-success)/15 text-(--color-success)">
        Winning
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-(--color-muted)/15 text-(--color-muted)">
      Outbid
    </span>
  );
}

function WithdrawButton({
  requestId,
  currencyAddress,
  amount,
}: {
  requestId: bigint;
  currencyAddress: `0x${string}`;
  amount: bigint;
}) {
  const queryClient = useQueryClient();
  const { writeContractAsync, isPending } = useWriteContract();
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const { isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  useEffect(() => {
    if (isSuccess) queryClient.invalidateQueries();
  }, [isSuccess, queryClient]);

  if (isSuccess) return <span className="text-xs text-(--color-success)">Withdrawn</span>;

  async function handleWithdraw() {
    try {
      const hash = await writeContractAsync({
        address: HOOK_ADDRESS,
        abi: MEV_AUCTION_HOOK_ABI,
        functionName: "withdrawRefund",
        args: [currencyAddress],
      });
      setTxHash(hash);
    } catch {}
  }

  const symbol = currencyAddress === zeroAddress ? TOKEN0_SYMBOL : TOKEN1_SYMBOL;

  return (
    <button
      onClick={handleWithdraw}
      disabled={isPending}
      className="rounded-lg bg-(--color-amber) px-3 py-1 text-xs font-semibold text-black hover:opacity-90 disabled:opacity-50 transition-opacity"
    >
      {isPending ? "…" : `Withdraw ${formatEther(amount)} ${symbol}`}
    </button>
  );
}

export default function ActivityPage() {
  const { address, isConnected } = useAccount();
  const { data: blockNumber } = useBlockNumber({ watch: true });
  const currentBlock = blockNumber ?? 0n;

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

  const { data: ethRefund } = useReadContract({
    address: HOOK_ADDRESS,
    abi: MEV_AUCTION_HOOK_ABI,
    functionName: "pendingRefunds",
    args: address ? [address, zeroAddress] : undefined,
    query: { enabled: !!address, refetchInterval: 5000 },
  });

  if (!isConnected || !address) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <p className="text-(--color-subtext) text-sm">
          Connect your wallet to see your activity.
        </p>
      </div>
    );
  }

  const allInfos = ids.map((id, i) => ({
    id,
    info: results.data?.[i]?.result as RequestInfo | undefined,
  }));

  const myRequests = allInfos
    .filter(
      (a) =>
        a.info !== undefined &&
        a.info.sender.toLowerCase() === address.toLowerCase()
    )
    .reverse();

  const myBids = allInfos
    .filter(
      (a) =>
        a.info !== undefined &&
        a.info.highestBidder.toLowerCase() === address.toLowerCase() &&
        a.info.sender.toLowerCase() !== address.toLowerCase()
    )
    .reverse();

  const hasRefundForBid = (info: RequestInfo): bigint => {
    if (
      info.highestBidder.toLowerCase() !== address.toLowerCase() &&
      ethRefund &&
      ethRefund > 0n
    ) {
      return ethRefund;
    }
    return 0n;
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-(--color-text)">My Activity</h1>
        <p className="mt-1 text-sm text-(--color-subtext)">
          Track your secure swaps and active auction bids.
        </p>
      </div>

      {nextIdLoading ? (
        <div className="rounded-xl border border-(--color-border) bg-(--color-surface) p-10 text-center">
          <p className="text-(--color-muted) text-sm">Loading…</p>
        </div>
      ) : (
        <>
          {/* My Swap Requests */}
          <div className="mb-8">
            <h2 className="text-sm font-semibold text-(--color-text) mb-3">
              My Swap Requests
            </h2>
            <div className="rounded-xl border border-(--color-border) bg-(--color-surface) overflow-hidden">
              {myRequests.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-sm text-(--color-muted)">No swap requests yet.</p>
                  <a
                    href="/"
                    className="mt-2 inline-block text-sm text-(--color-primary) hover:underline"
                  >
                    Request a swap →
                  </a>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-(--color-border)">
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-(--color-muted)">Swap</th>
                        <th className="text-left px-0 py-2.5 text-xs font-medium text-(--color-muted)">Amount</th>
                        <th className="text-left px-0 py-2.5 text-xs font-medium text-(--color-muted)">Status</th>
                        <th className="text-left px-0 py-2.5 text-xs font-medium text-(--color-muted)">Auction Closes</th>
                        <th className="text-left px-0 py-2.5 text-xs font-medium text-(--color-muted)">Action</th>
                      </tr>
                    </thead>
                    <tbody className="px-4">
                      {myRequests.map(({ id, info }) =>
                        info ? (
                          <tr key={id.toString()} className="border-b border-(--color-border) last:border-0">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1.5 text-sm font-medium text-(--color-text)">
                                <span className="size-5 rounded-full bg-(--color-surface-alt) flex items-center justify-center text-[10px] font-bold text-(--color-primary)">
                                  {(info.zeroForOne ? TOKEN0_SYMBOL : TOKEN1_SYMBOL).slice(0, 1)}
                                </span>
                                <span>{info.zeroForOne ? TOKEN0_SYMBOL : TOKEN1_SYMBOL}</span>
                                <svg viewBox="0 0 12 12" fill="none" className="w-3 h-3 text-(--color-muted)">
                                  <path d="M1 6h10M7 2l4 4-4 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                                <span>{info.zeroForOne ? TOKEN1_SYMBOL : TOKEN0_SYMBOL}</span>
                              </div>
                            </td>
                            <td className="py-3 pr-4 text-sm text-(--color-text)">
                              {formatEther(info.amountSpecified < 0n ? -info.amountSpecified : info.amountSpecified)}{" "}
                              {info.zeroForOne ? TOKEN0_SYMBOL : TOKEN1_SYMBOL}
                            </td>
                            <td className="py-3 pr-4">
                              <SwapStatusBadge info={info} />
                            </td>
                            <td className="py-3 pr-4 text-xs text-(--color-muted)">
                              {info.isCompleted
                                ? "Ended"
                                : info.auctionOpen
                                ? `~${Math.max(0, Number(info.deadlineBlock - currentBlock))}s`
                                : "—"}
                            </td>
                            <td className="py-3">
                              {!info.isCompleted ? (
                                <a href="/auctions" className="text-xs text-(--color-primary) hover:underline">
                                  {info.auctionOpen ? "Cancel" : "Track"}
                                </a>
                              ) : (
                                <span className="text-xs text-(--color-muted)">Done</span>
                              )}
                            </td>
                          </tr>
                        ) : null
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* My Bids */}
          <div>
            <h2 className="text-sm font-semibold text-(--color-text) mb-3">My Bids</h2>
            <div className="rounded-xl border border-(--color-border) bg-(--color-surface) overflow-hidden">
              {myBids.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-sm text-(--color-muted)">No bids placed yet.</p>
                  <a
                    href="/auctions"
                    className="mt-2 inline-block text-sm text-(--color-primary) hover:underline"
                  >
                    Browse auctions →
                  </a>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-(--color-border)">
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-(--color-muted)">Auction #</th>
                        <th className="text-left px-0 py-2.5 text-xs font-medium text-(--color-muted)">My Bid</th>
                        <th className="text-left px-0 py-2.5 text-xs font-medium text-(--color-muted)">Status</th>
                        <th className="text-left px-0 py-2.5 text-xs font-medium text-(--color-muted)">Refund Available</th>
                        <th className="text-left px-0 py-2.5 text-xs font-medium text-(--color-muted)">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {myBids.map(({ id, info }) => {
                        if (!info) return null;
                        const refund =
                          info.highestBidder.toLowerCase() !== address.toLowerCase() &&
                          ethRefund
                            ? ethRefund
                            : 0n;
                        const hasRefund = refund > 0n;
                        const isWinner =
                          info.highestBidder.toLowerCase() === address.toLowerCase();

                        return (
                          <tr key={id.toString()} className="border-b border-(--color-border) last:border-0">
                            <td className="px-4 py-3 text-sm font-mono text-(--color-subtext)">
                              #A-{id.toString().padStart(4, "0")}
                            </td>
                            <td className="py-3 pr-4 text-sm text-(--color-text)">
                              {info.highestBid > 0n ? `${formatEther(info.highestBid)} ETH` : "—"}
                            </td>
                            <td className="py-3 pr-4">
                              <BidStatusBadge info={info} address={address} hasRefund={hasRefund} />
                            </td>
                            <td className="py-3 pr-4 text-sm">
                              {hasRefund ? (
                                <span className="text-(--color-amber)">
                                  {formatEther(refund)} ETH
                                </span>
                              ) : (
                                <span className="text-(--color-muted)">—</span>
                              )}
                            </td>
                            <td className="py-3">
                              {hasRefund ? (
                                <WithdrawButton
                                  requestId={id}
                                  currencyAddress={zeroAddress}
                                  amount={refund}
                                />
                              ) : isWinner && !info.isCompleted ? (
                                <a href="/auctions" className="text-xs text-(--color-primary) hover:underline">
                                  Increase Bid
                                </a>
                              ) : null}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
