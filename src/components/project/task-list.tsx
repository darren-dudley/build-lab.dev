"use client";

import { useState, useTransition } from "react";
import type { TaskStatus } from "@prisma/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { upsertTaskAction } from "@/server/projects/actions";

export type TaskRow = {
  id: string;
  name: string;
  status: TaskStatus;
  ownerId: string | null;
  ownerName: string | null;
  dueDate: string | null; // yyyy-mm-dd
  phaseId: string | null;
  phaseName: string | null;
  priority: string | null;
  blockerNote: string | null;
};

const STATUS_LABELS: Record<TaskStatus, string> = {
  NOT_STARTED: "Not Started",
  IN_PROGRESS: "In Progress",
  WAITING: "Waiting",
  BLOCKED: "Blocked",
  COMPLETE: "Complete",
  CANCELLED: "Cancelled",
};

const STATUS_TONE: Record<TaskStatus, string> = {
  NOT_STARTED: "text-muted-foreground",
  IN_PROGRESS: "text-blue-700 dark:text-blue-400",
  WAITING: "text-amber-700 dark:text-amber-400",
  BLOCKED: "text-red-700 dark:text-red-400 font-medium",
  COMPLETE: "text-green-700 dark:text-green-400",
  CANCELLED: "text-muted-foreground line-through",
};

export function TaskList({
  projectId,
  tasks,
  members,
  phases,
  canManage,
}: {
  projectId: string;
  tasks: TaskRow[];
  members: { id: string; name: string }[];
  phases: { id: string; name: string }[];
  canManage: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [busy, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function patch(taskId: string | undefined, data: Record<string, unknown>) {
    setError(null);
    start(async () => {
      try {
        await upsertTaskAction(projectId, taskId, data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Update failed");
      }
    });
  }

  return (
    <div className="space-y-3">
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
              <th className="px-3 py-2 font-medium">Task</th>
              <th className="w-36 px-3 py-2 font-medium">Owner</th>
              <th className="w-36 px-3 py-2 font-medium">Status</th>
              <th className="w-36 px-3 py-2 font-medium">Due</th>
              <th className="w-36 px-3 py-2 font-medium">Phase</th>
            </tr>
          </thead>
          <tbody>
            {tasks.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-sm text-muted-foreground">
                  No tasks yet. {canManage ? "Add the first one below." : ""}
                </td>
              </tr>
            ) : null}
            {tasks.map((t) => (
              <tr key={t.id} className={cn("border-b last:border-0", t.status === "BLOCKED" && "bg-red-50/50 dark:bg-red-950/20")}>
                <td className="px-3 py-1.5">
                  <div className={cn(t.status === "COMPLETE" && "text-muted-foreground line-through")}>{t.name}</div>
                  {t.blockerNote ? (
                    <div className="text-xs text-red-700 dark:text-red-400">Blocked: {t.blockerNote}</div>
                  ) : null}
                </td>
                <td className="px-3 py-1.5">
                  {canManage ? (
                    <Select value={t.ownerId ?? "none"} onValueChange={(v) => patch(t.id, { ownerId: v === "none" ? null : v })}>
                      <SelectTrigger size="sm" className="h-7 border-0 bg-transparent px-1 text-xs shadow-none hover:bg-accent">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Unassigned</SelectItem>
                        {members.map((m) => (
                          <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <span className="text-xs">{t.ownerName ?? "—"}</span>
                  )}
                </td>
                <td className="px-3 py-1.5">
                  {canManage ? (
                    <Select
                      value={t.status}
                      onValueChange={(v) => {
                        if (v === "BLOCKED") {
                          const note = window.prompt("What is blocking this task?") ?? "";
                          patch(t.id, { status: v, blockerNote: note || null });
                        } else {
                          patch(t.id, { status: v, blockerNote: null });
                        }
                      }}
                    >
                      <SelectTrigger size="sm" className={cn("h-7 border-0 bg-transparent px-1 text-xs shadow-none hover:bg-accent", STATUS_TONE[t.status])}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(STATUS_LABELS) as TaskStatus[]).map((s) => (
                          <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <span className={cn("text-xs", STATUS_TONE[t.status])}>{STATUS_LABELS[t.status]}</span>
                  )}
                </td>
                <td className="px-3 py-1.5">
                  {canManage ? (
                    <Input
                      type="date"
                      defaultValue={t.dueDate ?? ""}
                      onBlur={(e) => {
                        if (e.target.value !== (t.dueDate ?? "")) patch(t.id, { dueDate: e.target.value || null });
                      }}
                      className="h-7 border-0 bg-transparent px-1 text-xs shadow-none hover:bg-accent"
                    />
                  ) : (
                    <span className="text-xs">{t.dueDate ?? "—"}</span>
                  )}
                </td>
                <td className="px-3 py-1.5">
                  {canManage ? (
                    <Select value={t.phaseId ?? "none"} onValueChange={(v) => patch(t.id, { phaseId: v === "none" ? null : v })}>
                      <SelectTrigger size="sm" className="h-7 border-0 bg-transparent px-1 text-xs shadow-none hover:bg-accent">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">—</SelectItem>
                        {phases.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <span className="text-xs">{t.phaseName ?? "—"}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {canManage ? (
        adding ? (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!newName.trim()) return;
              patch(undefined, { name: newName.trim() });
              setNewName("");
              setAdding(false);
            }}
          >
            <Input autoFocus placeholder="Task name" value={newName} onChange={(e) => setNewName(e.target.value)} className="h-8" />
            <Button type="submit" size="sm" disabled={busy || !newName.trim()}>Add</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
          </form>
        ) : (
          <Button size="sm" variant="outline" onClick={() => setAdding(true)}>Add task</Button>
        )
      ) : null}
    </div>
  );
}
