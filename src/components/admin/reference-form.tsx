"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { addInvestmentReferenceAction } from "@/server/admin/actions";

const INPUTS = [
  { key: "checkSizeScore", label: "Equity Check Size", hint: "1 = smallest checks · 5 = largest" },
  { key: "remainingValueScore", label: "Remaining Value-Creation Opportunity", hint: "1 = mostly realized · 5 = substantial upside remains" },
  { key: "runwayScore", label: "Ownership / Value-Creation Runway", hint: "1 = near exit · 5 = long runway" },
] as const;

export function ReferenceForm({
  companyId,
  companyName,
  current,
}: {
  companyId: string;
  companyName: string;
  current?: { checkSizeScore: number; remainingValueScore: number; runwayScore: number };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState({
    checkSizeScore: current?.checkSizeScore ?? 3,
    remainingValueScore: current?.remainingValueScore ?? 3,
    runwayScore: current?.runwayScore ?? 3,
  });
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  const preview = ((values.checkSizeScore + values.remainingValueScore + values.runwayScore) / 3).toFixed(2);

  function save() {
    setError(null);
    start(async () => {
      try {
        await addInvestmentReferenceAction(companyId, { ...values, effectiveDate, adminNotes: notes || undefined });
        setOpen(false);
        setNotes("");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Save failed");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant={current ? "ghost" : "default"}>
          {current ? "Update" : "Add reference data"}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">BC Investment Priority — {companyName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Saves a new reference version — existing scores keep the version they
            were calculated with. New and re-scored initiatives use this one.
          </p>
          {INPUTS.map((inp) => (
            <div key={inp.key} className="space-y-1">
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-medium">{inp.label}</span>
              </div>
              <p className="text-xs text-muted-foreground">{inp.hint}</p>
              <Select
                value={String(values[inp.key])}
                onValueChange={(v) => setValues({ ...values, [inp.key]: Number(v) })}
              >
                <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
          <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
            Calculated BC Investment Priority:{" "}
            <span className="font-semibold tabular-nums">{preview}</span> / 5
            <span className="text-xs text-muted-foreground"> (simple average — no hidden multipliers)</span>
          </div>
          <div className="space-y-1">
            <div className="text-sm font-medium">Effective date</div>
            <Input type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} className="w-40" />
          </div>
          <Textarea rows={2} placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button disabled={busy} onClick={save}>{busy ? "Saving…" : "Save new version"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
