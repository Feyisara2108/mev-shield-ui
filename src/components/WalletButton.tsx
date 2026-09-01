"use client";

import { useAccount, useConnect, useDisconnect } from "wagmi";

export function WalletButton() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();

  if (isConnected && address) {
    return (
      <button
        onClick={() => disconnect()}
        className="flex items-center gap-2 rounded-lg border border-(--color-border-bright) bg-(--color-surface-alt) px-3 py-1.5 text-sm text-(--color-text) hover:border-(--color-primary) transition-colors"
      >
        <span className="size-2 rounded-full bg-(--color-success)" />
        {address.slice(0, 6)}…{address.slice(-4)}
      </button>
    );
  }

  const injector = connectors[0];
  return (
    <button
      onClick={() => connect({ connector: injector })}
      disabled={isPending}
      className="rounded-lg bg-(--color-primary) px-3 py-1.5 text-sm font-medium text-white hover:bg-(--color-primary-hover) disabled:opacity-50 transition-colors"
    >
      {isPending ? "Connecting…" : "Connect Wallet"}
    </button>
  );
}
