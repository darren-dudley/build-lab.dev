"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DIMENSION_LABELS } from "@/lib/labels";
import { createScoringVersionAction } from "@/server/admin/actions";
import type { ScoreDimension } from "@prisma/client";

const DIMS: ScoreDimension[] = [
  "BUSINESS_IMPACT", "TIME_TO_ARTIFACT", "DATA_FEASIBILITY", "SPONSORSHIP", "STRATEGIC_FIT",
];

type Rubrics = Record<string, Record<string, string>>;
type Weights = Record<string, number>;

export function ScoringEditor({
  modelId,
  modelName,
  modelType,
  version,
  initialWeights,
  initialRubrics,
}: {
  modelId: string;
  modelName: string;
  modelType: "PORTFOLIO" | "SPECIALIST";
  version: number;
  initialWeights: Weights;
  initialRubrics: Rubrics;
}) {
  const router = useRouter();
  const [weights, setWeights] = useState<Weights>(initialWeights);
  const [rubrics, setRubrics] = useState<Rubrics>(initialRubrics);
  const [dirty, setDirty] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [busy, start] = useTransition();

  const bcWeight = weights.BC_INVESTMENT_PRIORITY ?? 0;
  const total = DIMS.reduce((s, d) => s + (weights[d] ?? 0), 0) + bcWeight;

  function setRubric(dim: string, level: string, text: string) {
    setRubrics((r) => ({ ...r, [dim]: { ...r[dim], [level]: text } }));
    setDirty(true);
    setSaved(false);
  }

  function setWeight(key: string, value: number) {
    setWeights((w) => ({ ...w, [key]: value }));
    setDirty(true);
    setSaved(false);
  }

  function save() {
    setErrors([]);
    start(async () => {
      const result = await createScoringVersionAction(modelId, { weights, rubrics });
      if (!result.ok) {
        setErrors(result.errors);
      } else {
        setDirty(false);
        setSaved(true);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-5 rounded-lg border p-5">
      <div className="flex items-baseline justify-between">
        <div>
          <h2 className="text-sm font-semibold">{modelName}</h2>
          <p className="text-xs text-muted-foreground">
            Current version v{version}. Saving creates v{version + 1} — existing
            scores keep v{version} forever.
          </p>
        </div>
        <div className={`text-xs tabular-nums ${total === 100 ? "text-muted-foreground" : "text-destructive font-medium"}`}>
          Weights total: {total}/100
        </div>
      </div>

      <div className="space-y-6">
        {DIMS.map((dim) => (
          <div key={dim} className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">{DIMENSION_LABELS[dim].label}</span>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                weight
                <Input
                  type="number" min={0} max={100}
                  value={weights[dim] ?? 0}
                  onChange={(e) => setWeight(dim, Number(e.target.value))}
                  className="h-6 w-16 px-1.5 text-xs"
                />
                %
              </span>
            </div>
            <p className="text-xs text-muted-foreground">{DIMENSION_LABELS[dim].question}</p>
            <div className="grid gap-1.5">
              {["1", "2", "3", "4", "5"].map((level) => (
                <div key={level} className="grid grid-cols-[1.5rem_1fr] items-start gap-2">
                  <span className="pt-1.5 text-right text-xs font-semibold tabular-nums">{level}</span>
                  <Textarea
                    rows={1}
                    value={rubrics[dim]?.[level] ?? ""}
                    onChange={(e) => setRubric(dim, level, e.target.value)}
                    className="min-h-8 py-1.5 text-xs"
                  />
                </div>
              ))}
            </div>
          </div>
        ))}

        {modelType === "PORTFOLIO" ? (
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">BC Investment Priority</span>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              weight
              <Input
                type="number" min={0} max={100}
                value={bcWeight}
                onChange={(e) => setWeight("BC_INVESTMENT_PRIORITY", Number(e.target.value))}
                className="h-6 w-16 px-1.5 text-xs"
              />
              %
            </span>
            <span className="text-xs text-muted-foreground">
              (from admin reference data — no rubric; simple average of three inputs)
            </span>
          </div>
        ) : null}
      </div>

      {errors.length > 0 ? (
        <ul className="list-disc space-y-0.5 pl-5 text-sm text-destructive">
          {errors.map((e) => <li key={e}>{e}</li>)}
        </ul>
      ) : null}

      <div className="flex items-center justify-end gap-3">
        {saved ? <span className="text-xs text-green-700 dark:text-green-400">Saved as v{version}</span> : null}
        <Button size="sm" disabled={!dirty || busy || total !== 100} onClick={save}>
          {busy ? "Saving…" : `Save as new version (v${version + 1})`}
        </Button>
      </div>
    </div>
  );
}
