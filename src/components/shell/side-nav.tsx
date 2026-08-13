"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { NavSection } from "./nav-config";

export function SideNav({ sections }: { sections: NavSection[] }) {
  const pathname = usePathname();

  return (
    <nav className="flex h-full flex-col gap-4 overflow-y-auto px-3 py-4">
      <div className="px-2">
        <Link href="/home" className="text-sm font-semibold tracking-tight">
          AI Initiative Portfolio
        </Link>
      </div>
      {sections.map((section, i) => (
        <div key={section.label ?? i} className="space-y-0.5">
          {section.label ? (
            <div className="px-2 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {section.label}
            </div>
          ) : null}
          {section.items.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== "/home" && pathname.startsWith(item.href + "/"));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "block rounded-md px-2 py-1.5 text-sm transition-colors",
                  active
                    ? "bg-accent font-medium text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
