import { cn } from "@/lib/utils";
import { LANE_LABELS } from "@/lib/lanes";
import type { DeliveryLane } from "@prisma/client";

export function CapacityStrip({
  capacity,
  compact = false,
}: {
  capacity: { lane: DeliveryLane; active: number; capacity: number }[];
  compact?: boolean;
}) {
  return (
    <div className={cn("flex flex-wrap gap-3", compact ? "text-xs" : "text-sm")}>
      {capacity.map((c) => {
        const full = c.active >= c.capacity;
        return (
          <div
            key={c.lane}
            className={cn(
              "flex items-center gap-2 rounded-md border px-3 py-1.5",
              full && "border-amber-400/60 bg-amber-50/60 dark:border-amber-800 dark:bg-amber-950/40",
            )}
          >
            <span className="text-muted-foreground">{LANE_LABELS[c.lane]}</span>
            <span className={cn("font-medium tabular-nums", full && "text-amber-700 dark:text-amber-400")}>
              {c.active}/{c.capacity}
            </span>
            {full ? <span className="text-xs text-amber-700 dark:text-amber-400">full</span> : null}
          </div>
        );
      })}
    </div>
  );
}
