"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { DeliveryLane } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { CapacityStrip } from "./capacity-strip";
import { LANES, LANE_LABELS } from "@/lib/lanes";
import { recordDecisionAction } from "@/server/governance/actions";

const DECISIONS = [
  { value: "APPROVE", label: "Approve", hint: "Starts nothing yet — assigns a delivery lane you choose." },
  { value: "APPROVE_AWAITING_CAPACITY", label: "Approve — Awaiting Capacity", hint: "Approved on merit; execution waits for room." },
  { value: "DEFER", label: "Defer", hint: "Not now. Requires rationale; optional reconsideration date." },
  { value: "MORE_INFORMATION", label: "More Information Required", hint: "Returns to triage/requester." },
  { value: "REJECT", label: "Reject", hint: "Requires rationale." },
] as const;

type DecisionValue = (typeof DECISIONS)[number]["value"];

export function DecisionPanel({
  initiativeId,
  initiativeName,
  capacity,
}: {
  initiativeId: string;
  initiativeName: string;
  capacity: { lane: DeliveryLane; active: number; capacity: number }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [decision, setDecision] = useState<DecisionValue | "">("");
  const [lane, setLane] = useState<DeliveryLane | "">("");
  const [anticipatedLane, setAnticipatedLane] = useState<DeliveryLane | "">("");
  const [rationale, setRationale] = useState("");
  const [conditions, setConditions] = useState("");
  const [priorityNotes, setPriorityNotes] = useState("");
  const [reconsiderAt, setReconsiderAt] = useState("");
  const [infoMessage, setInfoMessage] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, start] = useTransition();

  function submit() {
    start(async () => {
      const result = await recordDecisionAction(initiativeId, {
        decision,
        lane: decision === "APPROVE" ? lane || null : null,
        anticipatedLane: decision === "APPROVE_AWAITING_CAPACITY" ? anticipatedLane || null : null,
        rationale: rationale || null,
        conditions: conditions || undefined,
        priorityNotes: priorityNotes || undefined,
        reconsiderAt: decision === "DEFER" ? reconsiderAt || null : null,
        infoMessage: infoMessage || undefined,
      });
      if (!result.ok) {
        setErrors(result.errors);
      } else {
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">Decide</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="pr-6 text-base">{initiativeName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <CapacityStrip capacity={capacity} compact />
          <p className="text-xs text-muted-foreground">
            Capacity is context, not a constraint — a full lane routes approvals
            to Awaiting Capacity rather than blocking them.
          </p>

          <RadioGroup value={decision} onValueChange={(v) => { setDecision(v as DecisionValue); setErrors([]); }} className="space-y-1.5">
            {DECISIONS.map((d) => (
              <label key={d.value} className="flex items-start gap-3 rounded-md border p-2.5 text-sm has-[[data-state=checked]]:border-foreground/40">
                <RadioGroupItem value={d.value} className="mt-0.5" />
                <span>
                  <span className="font-medium">{d.label}</span>
                  <span className="block text-xs text-muted-foreground">{d.hint}</span>
                </span>
              </label>
            ))}
          </RadioGroup>

          {decision === "APPROVE" ? (
            <div className="space-y-1.5">
              <div className="text-sm font-medium">Delivery lane (your call — never suggested)</div>
              <Select value={lane} onValueChange={(v) => setLane(v as DeliveryLane)}>
                <SelectTrigger><SelectValue placeholder="Choose lane" /></SelectTrigger>
                <SelectContent>
                  {LANES.map((l) => (
                    <SelectItem key={l} value={l}>{LANE_LABELS[l]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {decision === "APPROVE_AWAITING_CAPACITY" ? (
            <div className="space-y-1.5">
              <div className="text-sm font-medium">
                Anticipated lane <span className="font-normal text-muted-foreground">(optional label — not an assignment)</span>
              </div>
              <Select value={anticipatedLane} onValueChange={(v) => setAnticipatedLane(v as DeliveryLane)}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  {LANES.map((l) => (
                    <SelectItem key={l} value={l}>{LANE_LABELS[l]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {decision === "MORE_INFORMATION" ? (
            <Textarea rows={2} placeholder="What information is needed?"
              value={infoMessage} onChange={(e) => setInfoMessage(e.target.value)} />
          ) : null}

          {decision ? (
            <>
              <Textarea rows={2}
                placeholder={decision === "REJECT" || decision === "DEFER" ? "Rationale (required)" : "Rationale (recommended)"}
                value={rationale} onChange={(e) => setRationale(e.target.value)} />
              {decision === "DEFER" ? (
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Reconsideration date (optional)</div>
                  <Input type="date" value={reconsiderAt} onChange={(e) => setReconsiderAt(e.target.value)} />
                </div>
              ) : null}
              <Input placeholder="Conditions (optional)" value={conditions} onChange={(e) => setConditions(e.target.value)} />
              <Input placeholder="Priority notes (optional)" value={priorityNotes} onChange={(e) => setPriorityNotes(e.target.value)} />
            </>
          ) : null}

          {errors.length > 0 ? (
            <ul className="list-disc space-y-0.5 pl-5 text-sm text-destructive">
              {errors.map((e) => <li key={e}>{e}</li>)}
            </ul>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button disabled={!decision || busy} onClick={submit}>
              {busy ? "Recording…" : "Record decision"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
