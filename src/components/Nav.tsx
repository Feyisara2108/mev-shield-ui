"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { WalletButton } from "./WalletButton";

const links = [
  { href: "/", label: "Swap" },
  { href: "/auctions", label: "Auctions" },
  { href: "/activity", label: "My Activity" },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-(--color-border) bg-(--color-surface)/90 backdrop-blur-sm">
      <div className="mx-auto flex max-w-5xl items-center gap-6 px-4 h-14">
        <span className="font-semibold text-(--color-text) tracking-tight shrink-0">
          MEV Shield
        </span>

        <nav className="flex items-center gap-1 flex-1">
          {links.map(({ href, label }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  active
                    ? "bg-(--color-primary-dim) text-(--color-primary)"
                    : "text-(--color-subtext) hover:text-(--color-text) hover:bg-(--color-surface-alt)"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        <WalletButton />
      </div>
    </header>
  );
}
