import { zeroAddress } from "viem";

export const HOOK_ADDRESS = (process.env.NEXT_PUBLIC_HOOK_ADDRESS ??
  "0x0000000000000000000000000000000000000000") as `0x${string}`;

// Pool key configuration — override per chain via env vars
// currency0 must be < currency1 (address order)
export const POOL_KEY = {
  currency0: (process.env.NEXT_PUBLIC_POOL_CURRENCY0 ??
    zeroAddress) as `0x${string}`,
  currency1: (process.env.NEXT_PUBLIC_POOL_CURRENCY1 ??
    "0x0000000000000000000000000000000000000002") as `0x${string}`,
  fee: Number(process.env.NEXT_PUBLIC_POOL_FEE ?? "3000"),
  tickSpacing: Number(process.env.NEXT_PUBLIC_POOL_TICK_SPACING ?? "60"),
  hooks: HOOK_ADDRESS,
} as const;

// Symbol labels for display — currency0 and currency1
export const TOKEN0_SYMBOL = process.env.NEXT_PUBLIC_TOKEN0_SYMBOL ?? "ETH";
export const TOKEN1_SYMBOL = process.env.NEXT_PUBLIC_TOKEN1_SYMBOL ?? "USDC";

// Native ETH sentinel — address(0)
export const NATIVE_ETH = zeroAddress;
