"use client";

import { useTransition } from "react";
import { cn } from "@/lib/utils";
import { setPhaseAction } from "@/server/projects/actions";

export function PhaseRail({
  projectId,
  phases,
  currentPhaseId,
  canManage,
}: {
  projectId: string;
  phases: { id: string; name: string; sortOrder: number; completedAt: string | null }[];
  currentPhaseId: string | null;
  canManage: boolean;
}) {
  const [busy, start] = useTransition();
  const currentIdx = phases.findIndex((p) => p.id === currentPhaseId);

  return (
    <ol className="flex flex-wrap items-center gap-1" aria-label="Project phases">
      {phases.map((p, i) => {
        const state = p.completedAt || i < currentIdx ? "done" : p.id === currentPhaseId ? "current" : "todo";
        return (
          <li key={p.id} className="flex items-center gap-1">
            <button
              type="button"
              disabled={!canManage || busy || state === "current"}
              onClick={() => start(async () => { await setPhaseAction(projectId, p.id); })}
              title={canManage && state !== "current" ? `Set phase to ${p.name}` : p.name}
              className={cn(
                "rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                state === "done" && "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
                state === "current" && "bg-foreground text-background",
                state === "todo" && "bg-muted text-muted-foreground",
                canManage && state !== "current" && "hover:ring-1 hover:ring-foreground/30",
              )}
            >
              {p.name}
            </button>
            {i < phases.length - 1 ? <span className="text-muted-foreground/40">→</span> : null}
          </li>
        );
      })}
    </ol>
  );
}
