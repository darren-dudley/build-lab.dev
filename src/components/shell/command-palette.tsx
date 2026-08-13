"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput,
  CommandItem, CommandList, CommandSeparator,
} from "@/components/ui/command";
import { globalSearchAction, type SearchResult } from "@/server/search/actions";
import type { NavSection } from "./nav-config";

export function CommandPalette({ sections }: { sections: NavSection[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    function onClick(e: MouseEvent) {
      if ((e.target as HTMLElement).closest("[data-command-trigger]")) {
        setOpen(true);
      }
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("click", onClick);
    };
  }, []);

  const runSearch = useCallback((value: string) => {
    setQuery(value);
    if (timer.current) clearTimeout(timer.current);
    if (value.trim().length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    timer.current = setTimeout(async () => {
      try {
        const r = await globalSearchAction(value);
        setResults(r);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 250);
  }, []);

  function go(href: string) {
    setOpen(false);
    setQuery("");
    setResults([]);
    router.push(href);
  }

  const groups = [...new Set(results.map((r) => r.group))];

  return (
    <CommandDialog open={open} onOpenChange={setOpen} title="Search" description="Search initiatives, projects, companies, and people">
      <CommandInput
        placeholder="Search initiatives, projects, companies… "
        value={query}
        onValueChange={runSearch}
      />
      <CommandList>
        <CommandEmpty>{searching ? "Searching…" : "No results."}</CommandEmpty>
        {groups.map((g) => (
          <CommandGroup key={g} heading={g}>
            {results
              .filter((r) => r.group === g)
              .map((r) => (
                // value embeds the query so cmdk's filter never hides server-matched results
                <CommandItem key={`${r.href}-${r.label}`} value={`${query} ${g} ${r.label}`} onSelect={() => go(r.href)}>
                  <span className="truncate">{r.label}</span>
                  {r.sublabel ? (
                    <span className="ml-auto truncate pl-3 text-xs text-muted-foreground">{r.sublabel}</span>
                  ) : null}
                </CommandItem>
              ))}
          </CommandGroup>
        ))}
        {query.trim().length < 2 ? (
          <>
            <CommandSeparator />
            <CommandGroup heading="Go to">
              {sections.flatMap((s) =>
                s.items.map((item) => (
                  <CommandItem key={item.href} value={item.label} onSelect={() => go(item.href)}>
                    {item.label}
                    {s.label ? (
                      <span className="ml-auto text-xs text-muted-foreground">{s.label}</span>
                    ) : null}
                  </CommandItem>
                )),
              )}
            </CommandGroup>
          </>
        ) : null}
      </CommandList>
    </CommandDialog>
  );
}
