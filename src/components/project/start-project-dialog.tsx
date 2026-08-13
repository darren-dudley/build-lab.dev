"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { startProjectAction } from "@/server/projects/actions";

export function StartProjectDialog({
  initiativeId,
  initiativeName,
  leads,
}: {
  initiativeId: string;
  initiativeName: string;
  leads: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [leadId, setLeadId] = useState("");
  const [target, setTarget] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">Start project</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Start: {initiativeName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Creates the execution record with the lane&apos;s phase template and
            carries the initiative&apos;s KPIs forward as estimates.
          </p>
          <div className="space-y-1.5">
            <div className="text-sm font-medium">Project lead</div>
            <Select value={leadId} onValueChange={setLeadId}>
              <SelectTrigger><SelectValue placeholder="Choose lead (optional)" /></SelectTrigger>
              <SelectContent>
                {leads.map((l) => (
                  <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <div className="text-sm font-medium">Target deployment date</div>
            <Input type="date" value={target} onChange={(e) => setTarget(e.target.value)} />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              disabled={busy}
              onClick={() => {
                setError(null);
                start(async () => {
                  try {
                    await startProjectAction(initiativeId, {
                      leadId: leadId || undefined,
                      targetDeploymentDate: target || undefined,
                    });
                  } catch (e) {
                    // redirect() throws NEXT_REDIRECT — let it through
                    if (e instanceof Error && e.message.includes("NEXT_REDIRECT")) throw e;
                    setError(e instanceof Error ? e.message : "Failed to start project");
                  }
                });
              }}
            >
              {busy ? "Starting…" : "Start project"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
