"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { FlagType, ScoreDimension } from "@prisma/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { DIMENSION_LABELS, FLAG_LABELS } from "@/lib/labels";
import {
  markReadyAction, requestInformationAction, saveTriageReviewAction,
  scoreInitiativeAction, setFlagAction,
} from "@/server/triage/actions";

const DIMENSIONS: ScoreDimension[] = [
  "BUSINESS_IMPACT", "TIME_TO_ARTIFACT", "DATA_FEASIBILITY", "SPONSORSHIP", "STRATEGIC_FIT",
];

type Props = {
  initiativeId: string;
  status: string;
  isPortfolio: boolean;
  rubrics: Record<string, Record<string, string>>;
  weights: Record<string, number>;
  bcReference: {
    priority: number;
    checkSize: number;
    remainingValue: number;
    runway: number;
    effectiveDate: string;
  } | null;
  currentScore: {
    composite: number;
    opportunityQuality: number;
    bcPriority: number | null;
    components: { dimension: ScoreDimension; value: number; rationale: string | null }[];
  } | null;
  review: {
    normalizedName: string | null;
    normalizedProblem: string | null;
    normalizedAsk: string | null;
    internalNotes: string | null;
  } | null;
  activeFlags: { flagType: FlagType; note: string | null }[];
};

export function ScoringPanel(props: Props) {
  const router = useRouter();
  const [values, setValues] = useState<Partial<Record<ScoreDimension, number>>>(
    Object.fromEntries(props.currentScore?.components.map((c) => [c.dimension, c.value]) ?? []),
  );
  const [rationales, setRationales] = useState<Partial<Record<ScoreDimension, string>>>(
    Object.fromEntries(
      props.currentScore?.components.map((c) => [c.dimension, c.rationale ?? ""]) ?? [],
    ),
  );
  const [review, setReview] = useState({
    normalizedName: props.review?.normalizedName ?? "",
    normalizedProblem: props.review?.normalizedProblem ?? "",
    normalizedAsk: props.review?.normalizedAsk ?? "",
    internalNotes: props.review?.internalNotes ?? "",
  });
  const [flags, setFlags] = useState<Partial<Record<FlagType, { active: boolean; note: string }>>>(
    Object.fromEntries(
      props.activeFlags.map((f) => [f.flagType, { active: true, note: f.note ?? "" }]),
    ),
  );
  const [infoMessage, setInfoMessage] = useState("");
  const [showInfoBox, setShowInfoBox] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  const complete = DIMENSIONS.every((d) => values[d]);

  function act(fn: () => Promise<unknown>) {
    setError(null);
    start(async () => {
      try {
        await fn();
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Current score */}
      {props.currentScore ? (
        <div className="rounded-lg border bg-muted/30 p-4">
          <div className="flex items-baseline justify-between">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {props.isPortfolio ? "Portfolio Priority Score" : "Specialist Priority Score"}
            </div>
          </div>
          <div className="score-figure mt-1 text-2xl font-semibold">
            {props.currentScore.composite}
            <span className="text-sm font-normal text-muted-foreground"> / 100</span>
          </div>
          {props.isPortfolio ? (
            <div className="mt-1 flex gap-4 text-xs text-muted-foreground">
              <span>Opportunity Quality {props.currentScore.opportunityQuality}/100</span>
              {props.currentScore.bcPriority != null ? (
                <span>BC Priority {props.currentScore.bcPriority.toFixed(2)}/5</span>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Normalization */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Triage normalization</h2>
        <Input
          placeholder="Normalized initiative name"
          value={review.normalizedName}
          onChange={(e) => setReview({ ...review, normalizedName: e.target.value })}
        />
        <Textarea rows={2} placeholder="Normalized problem statement"
          value={review.normalizedProblem}
          onChange={(e) => setReview({ ...review, normalizedProblem: e.target.value })} />
        <Textarea rows={2} placeholder="Normalized AI task"
          value={review.normalizedAsk}
          onChange={(e) => setReview({ ...review, normalizedAsk: e.target.value })} />
        <Textarea rows={2} placeholder="Internal notes (never shown to requester)"
          value={review.internalNotes}
          onChange={(e) => setReview({ ...review, internalNotes: e.target.value })} />
        <Button size="sm" variant="outline" disabled={busy}
          onClick={() => act(() => saveTriageReviewAction(props.initiativeId, review))}>
          Save normalization
        </Button>
      </section>

      {/* Scoring */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold">Score</h2>
        {DIMENSIONS.map((dim) => (
          <div key={dim} className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-medium">{DIMENSION_LABELS[dim].label}</span>
              <span className="text-xs text-muted-foreground">
                {props.weights[dim] ?? 0}%
              </span>
              <Popover>
                <PopoverTrigger className="text-xs text-muted-foreground underline decoration-dotted underline-offset-2">
                  rubric
                </PopoverTrigger>
                <PopoverContent className="w-80 text-xs" align="start">
                  <p className="mb-2 font-medium">{DIMENSION_LABELS[dim].question}</p>
                  <dl className="space-y-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <div key={n} className="flex gap-2">
                        <dt className="font-semibold tabular-nums">{n}</dt>
                        <dd className="text-muted-foreground">
                          {props.rubrics[dim]?.[String(n)] ?? "—"}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex gap-1" role="radiogroup" aria-label={DIMENSION_LABELS[dim].label}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={values[dim] === n}
                  onClick={() => setValues({ ...values, [dim]: n })}
                  className={cn(
                    "h-8 w-10 rounded-md border text-sm font-medium tabular-nums transition-colors",
                    values[dim] === n
                      ? "border-foreground bg-foreground text-background"
                      : "hover:bg-accent",
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
            <Input
              placeholder="Rationale / evidence (short)"
              value={rationales[dim] ?? ""}
              onChange={(e) => setRationales({ ...rationales, [dim]: e.target.value })}
              className="h-8 text-xs"
            />
          </div>
        ))}

        {props.isPortfolio ? (
          props.bcReference ? (
            <div className="rounded-md border px-3 py-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">BC Investment Priority: </span>
              {props.bcReference.priority.toFixed(2)}/5 (35%) — check size{" "}
              {props.bcReference.checkSize}, remaining value {props.bcReference.remainingValue},
              runway {props.bcReference.runway}. Reference data as of{" "}
              {props.bcReference.effectiveDate}. Applied automatically.
            </div>
          ) : (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              No BC Investment Priority reference data for this company. An
              administrator must add it before this initiative can be scored.
            </div>
          )
        ) : null}

        <Button
          disabled={!complete || busy || (props.isPortfolio && !props.bcReference)}
          onClick={() =>
            act(() =>
              scoreInitiativeAction(
                props.initiativeId,
                DIMENSIONS.map((d) => ({
                  dimension: d,
                  value: values[d]!,
                  rationale: rationales[d] || undefined,
                })),
              ),
            )
          }
        >
          {props.currentScore ? "Re-score" : "Save score"}
        </Button>
        {!complete ? (
          <p className="text-xs text-muted-foreground">Score all five dimensions to save.</p>
        ) : null}
      </section>

      {/* Flags */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Flags</h2>
        <div className="space-y-1.5">
          {(Object.keys(FLAG_LABELS) as FlagType[]).map((f) => {
            const state = flags[f] ?? { active: false, note: "" };
            return (
              <div key={f} className="space-y-1">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={state.active}
                    disabled={busy}
                    onCheckedChange={(c) => {
                      const active = c === true;
                      setFlags({ ...flags, [f]: { ...state, active } });
                      act(() => setFlagAction(props.initiativeId, f, active, state.note || undefined));
                    }}
                  />
                  {FLAG_LABELS[f]}
                </label>
                {state.active ? (
                  <Input
                    className="ml-6 h-7 w-[calc(100%-1.5rem)] text-xs"
                    placeholder="Note (optional) — saved on blur"
                    value={state.note}
                    onChange={(e) => setFlags({ ...flags, [f]: { ...state, note: e.target.value } })}
                    onBlur={() => act(() => setFlagAction(props.initiativeId, f, true, state.note || undefined))}
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      </section>

      {/* Actions */}
      <section className="space-y-3 border-t pt-4">
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={busy || !props.currentScore || props.status === "READY_FOR_GOVERNANCE"}
            onClick={() => act(() => markReadyAction(props.initiativeId))}
          >
            Mark ready for governance
          </Button>
          <Button variant="outline" disabled={busy} onClick={() => setShowInfoBox((s) => !s)}>
            Request more information
          </Button>
        </div>
        {props.status === "READY_FOR_GOVERNANCE" ? (
          <p className="text-xs text-muted-foreground">Already marked ready for governance.</p>
        ) : null}
        {!props.currentScore ? (
          <p className="text-xs text-muted-foreground">Marking ready requires a saved score.</p>
        ) : null}
        {showInfoBox ? (
          <div className="space-y-2">
            <Textarea
              rows={3}
              placeholder="What do you need from the requester?"
              value={infoMessage}
              onChange={(e) => setInfoMessage(e.target.value)}
            />
            <Button
              size="sm"
              disabled={busy || infoMessage.trim().length < 5}
              onClick={() =>
                act(async () => {
                  await requestInformationAction(props.initiativeId, infoMessage.trim());
                  setShowInfoBox(false);
                  setInfoMessage("");
                })
              }
            >
              Send request
            </Button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
