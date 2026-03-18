"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";

const NAV_ITEMS = [
  { href: "/screener", label: "Swing" },
  { href: "/screener?mode=position", label: "Position" },
  { href: "/screener?mode=quality", label: "Quality Growth" },
  { href: "/screener?mode=value", label: "Deep Value" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/settings", label: "Settings" },
];

export function HubNav() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1 border-b border-[var(--border-default)] bg-[var(--background-surface)] px-4 py-2">
      {NAV_ITEMS.map((item) => {
        const isActive =
          pathname === item.href ||
          (item.href.startsWith("/screener") && pathname === "/screener") ||
          (item.href === "/portfolio" && pathname === "/portfolio") ||
          (item.href === "/settings" && pathname === "/settings");
        const isComingSoon =
          item.label === "Position" ||
          item.label === "Quality Growth" ||
          item.label === "Deep Value";

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "rounded px-3 py-2 font-mono text-xs font-medium transition-colors",
              isActive
                ? "bg-[var(--background-elevated)] text-[var(--signal-neutral)]"
                : "text-[var(--text-secondary)] hover:bg-[var(--background-subtle)] hover:text-[var(--text-primary)]",
              isComingSoon && "opacity-60"
            )}
          >
            {item.label}
            {isComingSoon && (
              <span className="ml-1 text-[10px] text-[var(--text-muted)]">
                (Soon)
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
