"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { updateKpiAction } from "@/server/projects/actions";
import { cn } from "@/lib/utils";

type Kpi = {
  id: string;
  metric: string;
  baseline: string | null;
  target: string | null;
  currentResult: string | null;
  valueType: "ESTIMATED" | "VALIDATED";
  measuredAt: string | null;
  methodology: string | null;
};

export function KpiTable({
  projectId, kpis, canManage,
}: {
  projectId: string; kpis: Kpi[]; canManage: boolean;
}) {
  const [editing, setEditing] = useState<string | null>(null);

  if (kpis.length === 0) {
    return <p className="text-sm text-muted-foreground">No KPIs were carried over from the initiative.</p>;
  }

  return (
    <div className="space-y-1">
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
              <th className="px-3 py-2 font-medium">Metric</th>
              <th className="px-3 py-2 font-medium">Baseline</th>
              <th className="px-3 py-2 font-medium">Target</th>
              <th className="px-3 py-2 font-medium">Current result</th>
              <th className="px-3 py-2 font-medium">Type</th>
              <th className="px-3 py-2 font-medium">Measured</th>
              {canManage ? <th className="px-3 py-2" /> : null}
            </tr>
          </thead>
          <tbody>
            {kpis.map((k) => (
              <KpiRow
                key={k.id} kpi={k} projectId={projectId} canManage={canManage}
                editing={editing === k.id}
                onEdit={() => setEditing(k.id)} onDone={() => setEditing(null)}
              />
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        <span className="font-medium">Estimated</span> values are projections.{" "}
        <span className="font-medium">Validated</span> values require a measurement
        date and methodology — the two are never presented interchangeably.
      </p>
    </div>
  );
}

function KpiRow({
  kpi, projectId, canManage, editing, onEdit, onDone,
}: {
  kpi: Kpi; projectId: string; canManage: boolean;
  editing: boolean; onEdit: () => void; onDone: () => void;
}) {
  const [result, setResult] = useState(kpi.currentResult ?? "");
  const [validated, setValidated] = useState(kpi.valueType === "VALIDATED");
  const [measuredAt, setMeasuredAt] = useState(kpi.measuredAt ?? "");
  const [methodology, setMethodology] = useState(kpi.methodology ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  function save() {
    setError(null);
    start(async () => {
      try {
        await updateKpiAction(kpi.id, projectId, {
          currentResult: result,
          valueType: validated ? "VALIDATED" : "ESTIMATED",
          measuredAt: measuredAt || undefined,
          methodology: methodology || undefined,
        });
        onDone();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Save failed");
      }
    });
  }

  return (
    <tr className="border-b align-top last:border-0">
      <td className="px-3 py-2 font-medium">{kpi.metric}</td>
      <td className="px-3 py-2">{kpi.baseline ?? "—"}</td>
      <td className="px-3 py-2">{kpi.target ?? "—"}</td>
      {editing ? (
        <td className="px-3 py-2" colSpan={3}>
          <div className="space-y-2">
            <Input placeholder="Current result" value={result} onChange={(e) => setResult(e.target.value)} className="h-8" />
            <label className="flex items-center gap-2 text-xs">
              <Checkbox checked={validated} onCheckedChange={(c) => setValidated(c === true)} />
              This is a validated (measured) result, not an estimate
            </label>
            {validated ? (
              <div className="flex gap-2">
                <Input type="date" value={measuredAt} onChange={(e) => setMeasuredAt(e.target.value)} className="h-8 w-36" />
                <Input placeholder="Methodology" value={methodology} onChange={(e) => setMethodology(e.target.value)} className="h-8" />
              </div>
            ) : null}
            {error ? <p className="text-xs text-destructive">{error}</p> : null}
            <div className="flex gap-2">
              <Button size="sm" disabled={busy || !result.trim()} onClick={save}>Save</Button>
              <Button size="sm" variant="ghost" onClick={onDone}>Cancel</Button>
            </div>
          </div>
        </td>
      ) : (
        <>
          <td className="px-3 py-2">{kpi.currentResult ?? "—"}</td>
          <td className="px-3 py-2">
            <span className={cn(
              "rounded-full px-2 py-0.5 text-xs font-medium",
              kpi.valueType === "VALIDATED"
                ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"
                : "bg-muted text-muted-foreground",
            )}>
              {kpi.valueType === "VALIDATED" ? "Validated" : "Estimated"}
            </span>
          </td>
          <td className="px-3 py-2 text-xs text-muted-foreground">{kpi.measuredAt ?? "—"}</td>
        </>
      )}
      {canManage && !editing ? (
        <td className="px-3 py-2 text-right">
          <Button size="sm" variant="ghost" onClick={onEdit}>Update</Button>
        </td>
      ) : canManage ? <td /> : null}
    </tr>
  );
}
