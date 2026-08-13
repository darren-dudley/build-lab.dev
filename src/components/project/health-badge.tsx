import type { ProjectHealth } from "@prisma/client";
import { cn } from "@/lib/utils";

const TONE: Record<ProjectHealth, string> = {
  GREEN: "bg-green-500",
  YELLOW: "bg-amber-400",
  RED: "bg-red-500",
};

export function HealthBadge({ health, note, className }: { health: ProjectHealth; note?: string | null; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-sm", className)} title={note ?? undefined}>
      <span className={cn("h-2.5 w-2.5 rounded-full", TONE[health])} aria-hidden />
      <span className="capitalize">{health.toLowerCase()}</span>
    </span>
  );
}
