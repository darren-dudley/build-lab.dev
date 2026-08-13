"use client";

import { useState, useTransition } from "react";
import type { ProjectHealth } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { addUpdateAction } from "@/server/projects/actions";
import { cn } from "@/lib/utils";

export function UpdateComposer({
  projectId,
  currentHealth,
}: {
  projectId: string;
  currentHealth: ProjectHealth;
}) {
  const [open, setOpen] = useState(false);
  const [health, setHealth] = useState<ProjectHealth>(currentHealth);
  const [fields, setFields] = useState({ accomplished: "", next: "", risks: "", decisionsNeeded: "", kpiUpdate: "", healthNote: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  if (!open) {
    return (
      <Button size="sm" onClick={() => setOpen(true)}>
        Post status update
      </Button>
    );
  }

  function submit() {
    setError(null);
    start(async () => {
      try {
        await addUpdateAction(projectId, {
          ...Object.fromEntries(Object.entries(fields).filter(([, v]) => v.trim())),
          health,
        });
        setOpen(false);
        setFields({ accomplished: "", next: "", risks: "", decisionsNeeded: "", kpiUpdate: "", healthNote: "" });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to post update");
      }
    });
  }

  const needsNote = health !== "GREEN" && !fields.healthNote.trim();

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex items-center gap-4">
        <span className="text-sm font-medium">Health</span>
        <RadioGroup value={health} onValueChange={(v) => setHealth(v as ProjectHealth)} className="flex gap-4">
          {(["GREEN", "YELLOW", "RED"] as const).map((h) => (
            <label key={h} className="flex items-center gap-1.5 text-sm">
              <RadioGroupItem value={h} />
              <span className={cn(
                "h-2.5 w-2.5 rounded-full",
                h === "GREEN" ? "bg-green-500" : h === "YELLOW" ? "bg-amber-400" : "bg-red-500",
              )} />
              <span className="capitalize">{h.toLowerCase()}</span>
            </label>
          ))}
        </RadioGroup>
      </div>
      {health !== "GREEN" ? (
        <Textarea rows={2} placeholder="Why is this Yellow/Red? (required)"
          value={fields.healthNote} onChange={(e) => setFields({ ...fields, healthNote: e.target.value })} />
      ) : null}
      <Textarea rows={2} placeholder="Accomplished" value={fields.accomplished}
        onChange={(e) => setFields({ ...fields, accomplished: e.target.value })} />
      <Textarea rows={2} placeholder="Next" value={fields.next}
        onChange={(e) => setFields({ ...fields, next: e.target.value })} />
      <Textarea rows={2} placeholder="Risks / blockers" value={fields.risks}
        onChange={(e) => setFields({ ...fields, risks: e.target.value })} />
      <Textarea rows={2} placeholder="Decisions needed" value={fields.decisionsNeeded}
        onChange={(e) => setFields({ ...fields, decisionsNeeded: e.target.value })} />
      <Textarea rows={2} placeholder="KPI / impact update" value={fields.kpiUpdate}
        onChange={(e) => setFields({ ...fields, kpiUpdate: e.target.value })} />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
        <Button size="sm" disabled={busy || needsNote} onClick={submit}>
          {busy ? "Posting…" : "Post update"}
        </Button>
      </div>
    </div>
  );
}
