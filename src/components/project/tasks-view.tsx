"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { TaskStatus } from "@prisma/client";
import { cn } from "@/lib/utils";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { TaskList, type TaskRow } from "./task-list";
import { upsertTaskAction } from "@/server/projects/actions";

const BOARD_COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: "NOT_STARTED", label: "Not Started" },
  { status: "IN_PROGRESS", label: "In Progress" },
  { status: "WAITING", label: "Waiting" },
  { status: "BLOCKED", label: "Blocked" },
  { status: "COMPLETE", label: "Complete" },
];

export function TasksView(props: {
  projectId: string;
  tasks: TaskRow[];
  members: { id: string; name: string }[];
  phases: { id: string; name: string }[];
  canManage: boolean;
}) {
  const [view, setView] = useState<"list" | "board">("list");

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <div className="inline-flex rounded-md border p-0.5">
          {(["list", "board"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={cn(
                "rounded px-2.5 py-1 text-xs font-medium capitalize transition-colors",
                view === v ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {v}
            </button>
          ))}
        </div>
      </div>
      {view === "list" ? <TaskList {...props} /> : <TaskBoard {...props} />}
    </div>
  );
}

function TaskBoard({
  projectId, tasks, canManage,
}: {
  projectId: string;
  tasks: TaskRow[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [busy, start] = useTransition();

  function move(taskId: string, status: TaskStatus) {
    start(async () => {
      const blockerNote =
        status === "BLOCKED" ? (window.prompt("What is blocking this task?") ?? "") || null : null;
      await upsertTaskAction(projectId, taskId, { status, blockerNote });
      router.refresh();
    });
  }

  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[900px] grid-cols-5 gap-3">
        {BOARD_COLUMNS.map((col) => {
          const items = tasks.filter((t) => t.status === col.status);
          return (
            <div key={col.status} className="rounded-lg bg-muted/40 p-2">
              <div className="mb-2 flex items-baseline justify-between px-1">
                <span className="text-xs font-semibold">{col.label}</span>
                <span className="text-xs text-muted-foreground tabular-nums">{items.length}</span>
              </div>
              <div className="space-y-2">
                {items.map((t) => (
                  <div key={t.id} className={cn(
                    "rounded-md border bg-background p-2.5 text-sm shadow-xs",
                    t.status === "BLOCKED" && "border-red-300 dark:border-red-900",
                  )}>
                    <div className="font-medium leading-snug">{t.name}</div>
                    <div className="mt-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span className="truncate">{t.ownerName ?? "Unassigned"}</span>
                      {t.dueDate ? <span className="shrink-0">{t.dueDate.slice(5)}</span> : null}
                    </div>
                    {t.blockerNote ? (
                      <div className="mt-1 text-xs text-red-700 dark:text-red-400">{t.blockerNote}</div>
                    ) : null}
                    {canManage ? (
                      <Select value={t.status} onValueChange={(v) => move(t.id, v as TaskStatus)} disabled={busy}>
                        <SelectTrigger size="sm" className="mt-2 h-6 w-full border-dashed px-1.5 text-[11px] text-muted-foreground shadow-none">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {BOARD_COLUMNS.map((c) => (
                            <SelectItem key={c.status} value={c.status}>{c.label}</SelectItem>
                          ))}
                          <SelectItem value="CANCELLED">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : null}
                  </div>
                ))}
                {items.length === 0 ? (
                  <div className="rounded-md border border-dashed px-2 py-4 text-center text-xs text-muted-foreground">
                    Empty
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
