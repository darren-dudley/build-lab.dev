"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { upsertTaxonomyItemAction } from "@/server/admin/more-actions";
import { cn } from "@/lib/utils";

export function TaxonomyManager({
  kind,
  title,
  items,
}: {
  kind: string;
  title: string;
  items: { id: string; label: string; isActive: boolean }[];
}) {
  const router = useRouter();
  const [newLabel, setNewLabel] = useState("");
  const [busy, start] = useTransition();

  function act(fn: () => Promise<unknown>) {
    start(async () => {
      await fn();
      router.refresh();
    });
  }

  return (
    <div className="space-y-2 rounded-lg border p-4">
      <h2 className="text-sm font-semibold">{title}</h2>
      <ul className="flex flex-wrap gap-1.5">
        {items.map((i) => (
          <li key={i.id}>
            <button
              type="button"
              disabled={busy}
              title={i.isActive ? "Click to deactivate" : "Click to reactivate"}
              onClick={() =>
                act(() => upsertTaxonomyItemAction(i.id, { kind, label: i.label, isActive: !i.isActive }))
              }
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs transition-colors",
                i.isActive
                  ? "hover:border-destructive/50 hover:text-destructive"
                  : "border-dashed text-muted-foreground/60 line-through hover:text-foreground",
              )}
            >
              {i.label}
            </button>
          </li>
        ))}
      </ul>
      <form
        className="flex gap-2 pt-1"
        onSubmit={(e) => {
          e.preventDefault();
          if (!newLabel.trim()) return;
          act(() => upsertTaxonomyItemAction(null, { kind, label: newLabel.trim() }));
          setNewLabel("");
        }}
      >
        <Input
          placeholder={`Add ${title.toLowerCase().replace(/s$/, "")}…`}
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          className="h-8 max-w-60"
        />
        <Button type="submit" size="sm" variant="outline" disabled={busy || !newLabel.trim()}>
          Add
        </Button>
      </form>
    </div>
  );
}
