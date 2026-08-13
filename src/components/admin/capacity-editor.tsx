"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { DeliveryLane } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LANE_LABELS } from "@/lib/lanes";
import { updateCapacityAction } from "@/server/admin/more-actions";

export function CapacityEditor({
  rows,
}: {
  rows: { lane: DeliveryLane; capacity: number; active: number }[];
}) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, number>>(
    Object.fromEntries(rows.map((r) => [r.lane, r.capacity])),
  );
  const [busy, start] = useTransition();
  const dirty = rows.some((r) => values[r.lane] !== r.capacity);

  return (
    <div className="space-y-3">
      <div className="divide-y rounded-md border">
        {rows.map((r) => (
          <div key={r.lane} className="flex items-center justify-between gap-4 px-4 py-3">
            <div>
              <div className="text-sm font-medium">{LANE_LABELS[r.lane]}</div>
              <div className="text-xs text-muted-foreground">{r.active} active now</div>
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="number" min={0} max={999}
                value={values[r.lane]}
                onChange={(e) => setValues({ ...values, [r.lane]: Number(e.target.value) })}
                className="h-8 w-20 text-right tabular-nums"
              />
              <span className="text-xs text-muted-foreground">slots</span>
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Limits inform governance — a full lane routes approvals to Awaiting
          Capacity and never blocks or auto-starts anything.
        </p>
        <Button
          size="sm" disabled={!dirty || busy}
          onClick={() =>
            start(async () => {
              for (const r of rows) {
                if (values[r.lane] !== r.capacity) {
                  await updateCapacityAction(r.lane, values[r.lane]);
                }
              }
              router.refresh();
            })
          }
        >
          {busy ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}
