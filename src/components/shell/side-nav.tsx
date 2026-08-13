"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { NavSection } from "./nav-config";

export function SideNav({ sections }: { sections: NavSection[] }) {
  const pathname = usePathname();

  return (
    <nav className="flex h-full flex-col gap-5 overflow-y-auto px-3 py-5 text-sidebar-foreground">
      <Link href="/home" className="flex items-baseline gap-2 px-2">
        <span className="rounded-sm bg-sidebar-primary px-1.5 py-0.5 text-[11px] font-bold tracking-wide text-sidebar-primary-foreground">
          BCP
        </span>
        <span className="text-sm font-semibold tracking-tight text-white">Build Lab</span>
      </Link>
      {sections.map((section, i) => (
        <div key={section.label ?? i} className="space-y-px">
          {section.label ? (
            <div className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-sidebar-foreground/45">
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
                  "relative block rounded-md py-1.5 pl-3 pr-2 text-[13px] transition-colors",
                  active
                    ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-full before:bg-sidebar-primary"
                    : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
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
