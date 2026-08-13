"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { saveDraftAction, submitInitiativeAction } from "@/server/intake/actions";
import {
  AFFECTED_OPTIONS, AI_TASK_HELPER, ACCESS_STATUS_OPTIONS, EFFORT_OPTIONS,
  PRIOR_ATTEMPT_OPTIONS, TTA_HELPER, VALUE_LEVER_OPTIONS, isPortfolioType,
  validateSubmission, type DraftData,
} from "@/lib/intake-schema";

type Option = { id: string; label: string };

type Props = {
  initiativeId: string;
  requestType: string;
  requesterName: string;
  requesterEmail: string;
  companies: Option[];
  functions: Option[];
  specialistWorkflows: Option[];
  systems: Option[];
  initial: DraftData;
};

const STEPS = [
  { key: "routing", label: "Basics" },
  { key: "problem", label: "Business Problem" },
  { key: "ask", label: "The Ask" },
  { key: "feasibility", label: "Feasibility" },
  { key: "priority", label: "Priority Signal" },
  { key: "review", label: "Review & Submit" },
] as const;

export function IntakeForm(props: Props) {
  const portfolio = isPortfolioType(props.requestType);
  const [d, setD] = useState<DraftData>(props.initial);
  const [step, setStep] = useState(0);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [missing, setMissing] = useState<string[]>([]);
  const [submitting, startSubmit] = useTransition();
  const pending = useRef<DraftData>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(async () => {
    const payload = pending.current;
    pending.current = {};
    if (Object.keys(payload).length === 0) return;
    setSaveState("saving");
    try {
      await saveDraftAction(props.initiativeId, payload);
      setSaveState("saved");
    } catch {
      setSaveState("error");
      // Re-queue so the next edit retries the failed payload
      pending.current = { ...payload, ...pending.current };
    }
  }, [props.initiativeId]);

  const update = useCallback(
    (patch: DraftData) => {
      setD((prev) => ({ ...prev, ...patch }));
      pending.current = { ...pending.current, ...patch };
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, 800);
    },
    [flush],
  );

  // Flush on unmount / tab close
  useEffect(() => {
    const onHide = () => {
      if (timer.current) clearTimeout(timer.current);
      void flush();
    };
    window.addEventListener("pagehide", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      onHide();
    };
  }, [flush]);

  function goTo(next: number) {
    void flush();
    if (next === STEPS.length - 1) setMissing(validateSubmission(props.requestType, d));
    setStep(Math.max(0, Math.min(STEPS.length - 1, next)));
    window.scrollTo({ top: 0 });
  }

  function submit() {
    startSubmit(async () => {
      await flush();
      const result = await submitInitiativeAction(props.initiativeId);
      if (result && !result.ok) setMissing(result.missing);
    });
  }

  return (
    <div className="mx-auto flex max-w-4xl gap-8">
      {/* Step rail */}
      <nav className="hidden w-44 shrink-0 sm:block" aria-label="Form steps">
        <ol className="sticky top-6 space-y-1">
          {STEPS.map((s, i) => (
            <li key={s.key}>
              <button
                type="button"
                onClick={() => goTo(i)}
                className={cn(
                  "w-full rounded-md px-2 py-1.5 text-left text-sm",
                  i === step
                    ? "bg-accent font-medium"
                    : "text-muted-foreground hover:text-foreground",
                )}
                aria-current={i === step ? "step" : undefined}
              >
                <span className="mr-1.5 tabular-nums">{i + 1}.</span>
                {s.label}
              </button>
            </li>
          ))}
        </ol>
      </nav>

      <div className="min-w-0 flex-1 space-y-6 pb-24">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-muted-foreground">
              Step {step + 1} of {STEPS.length}
            </div>
            <h1 className="text-lg font-semibold tracking-tight">{STEPS[step].label}</h1>
          </div>
          <div className="text-xs text-muted-foreground" aria-live="polite">
            {saveState === "saving" && "Saving…"}
            {saveState === "saved" && "All changes saved"}
            {saveState === "error" && (
              <span className="text-destructive">Save failed — will retry</span>
            )}
          </div>
        </div>

        {step === 0 && (
          <StepRouting {...props} d={d} update={update} portfolio={portfolio} />
        )}
        {step === 1 && <StepProblem d={d} update={update} />}
        {step === 2 && <StepAsk d={d} update={update} portfolio={portfolio} />}
        {step === 3 && <StepFeasibility d={d} update={update} systems={props.systems} />}
        {step === 4 && <StepPriority d={d} update={update} />}
        {step === 5 && (
          <StepReview
            d={d}
            missing={missing}
            portfolio={portfolio}
            companies={props.companies}
            functions={props.functions}
            goTo={goTo}
          />
        )}

        <div className="flex items-center justify-between border-t pt-4">
          <Button variant="ghost" onClick={() => goTo(step - 1)} disabled={step === 0}>
            Back
          </Button>
          {step < STEPS.length - 1 ? (
            <Button onClick={() => goTo(step + 1)}>Continue</Button>
          ) : (
            <Button onClick={submit} disabled={submitting || missing.length > 0}>
              {submitting ? "Submitting…" : "Submit initiative"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────────── field helpers ───────────────────────────── */

function Field({
  label, helper, children, optional,
}: {
  label: string; helper?: string; children: React.ReactNode; optional?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">
        {label}
        {optional ? <span className="ml-1.5 font-normal text-muted-foreground">(optional)</span> : null}
      </Label>
      {helper ? <p className="text-xs text-muted-foreground">{helper}</p> : null}
      {children}
    </div>
  );
}

function CheckboxGrid({
  options, selected, onChange,
}: {
  options: readonly string[]; selected: string[]; onChange: (next: string[]) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
      {options.map((o) => (
        <label key={o} className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={selected.includes(o)}
            onCheckedChange={(c) =>
              onChange(c ? [...selected, o] : selected.filter((x) => x !== o))
            }
          />
          {o}
        </label>
      ))}
    </div>
  );
}

/* ───────────────────────────── steps ───────────────────────────── */

function StepRouting({
  d, update, portfolio, requesterName, requesterEmail, companies, functions, specialistWorkflows,
}: Props & { d: DraftData; update: (p: DraftData) => void; portfolio: boolean }) {
  return (
    <div className="space-y-5">
      <Field label="Initiative name" helper="A short, recognizable name. You can refine it later.">
        <Input
          value={d.name ?? ""}
          onChange={(e) => update({ name: e.target.value })}
          placeholder={portfolio ? "e.g. Automated QBR decks for Meridian" : "e.g. FP&A variance narrative drafts"}
        />
      </Field>

      <div className="rounded-md border bg-muted/30 px-4 py-3 text-sm">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Requester</div>
        <div className="mt-1">{requesterName} · {requesterEmail}</div>
      </div>

      {portfolio ? (
        <>
          <Field label="Portfolio company">
            <Select
              value={d.portfolioCompanyId ?? ""}
              onValueChange={(v) => update({ portfolioCompanyId: v })}
            >
              <SelectTrigger><SelectValue placeholder="Select company" /></SelectTrigger>
              <SelectContent>
                {companies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Function" helper="Where in the business does this live?">
            <Select value={d.functionId ?? ""} onValueChange={(v) => update({ functionId: v })}>
              <SelectTrigger><SelectValue placeholder="Select function" /></SelectTrigger>
              <SelectContent>
                {functions.map((f) => (
                  <SelectItem key={f.id} value={f.id}>{f.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Internal sponsor</Label>
            <p className="text-xs text-muted-foreground">
              The internal person sponsoring this with the portfolio company.
            </p>
            <div className="grid gap-2 sm:grid-cols-3">
              <Input placeholder="Name" value={d.sponsorName ?? ""} onChange={(e) => update({ sponsorName: e.target.value })} />
              <Input placeholder="Title" value={d.sponsorTitle ?? ""} onChange={(e) => update({ sponsorTitle: e.target.value })} />
              <Input placeholder="Email" type="email" value={d.sponsorEmail ?? ""} onChange={(e) => update({ sponsorEmail: e.target.value })} />
            </div>
          </div>
        </>
      ) : (
        <Field label="Specialist function / workflow" helper="Which Specialist workflow is this for?">
          <Select
            value={d.specialistWorkflow ?? ""}
            onValueChange={(v) => update({ specialistWorkflow: v })}
          >
            <SelectTrigger><SelectValue placeholder="Select workflow" /></SelectTrigger>
            <SelectContent>
              {specialistWorkflows.map((w) => (
                <SelectItem key={w.id} value={w.label}>{w.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      )}
    </div>
  );
}

function StepProblem({ d, update }: { d: DraftData; update: (p: DraftData) => void }) {
  const affected = d.affected ?? { selections: [], explanation: "" };
  return (
    <div className="space-y-5">
      <Field label="What business process or challenge are you looking to address with AI?">
        <Textarea
          rows={4}
          value={d.businessProblem ?? ""}
          onChange={(e) => update({ businessProblem: e.target.value })}
          placeholder="Describe the problem in plain language."
        />
      </Field>
      <Field
        label="How does this work today?"
        helper="Who does it, what systems or tools are used, roughly how often, how much time it takes, and the approximate cost if you know it."
      >
        <Textarea
          rows={5}
          value={d.currentProcess ?? ""}
          onChange={(e) => update({ currentProcess: e.target.value })}
        />
      </Field>
      <Field label="Who or what is affected?">
        <div className="space-y-3">
          <CheckboxGrid
            options={AFFECTED_OPTIONS}
            selected={affected.selections}
            onChange={(selections) => update({ affected: { ...affected, selections } })}
          />
          <Textarea
            rows={2}
            placeholder="Briefly explain the impact…"
            value={affected.explanation ?? ""}
            onChange={(e) => update({ affected: { ...affected, explanation: e.target.value } })}
          />
        </div>
      </Field>
    </div>
  );
}

function StepAsk({
  d, update, portfolio,
}: { d: DraftData; update: (p: DraftData) => void; portfolio: boolean }) {
  const kpis = d.kpis ?? [];
  const value = d.valueCreation ?? { levers: [], explanation: "" };
  return (
    <div className="space-y-5">
      <Field label="What do you want AI to actually do?" helper={AI_TASK_HELPER}>
        <Textarea rows={4} value={d.aiTask ?? ""} onChange={(e) => update({ aiTask: e.target.value })} />
      </Field>
      <Field label="What would success look like 90 days after this ships?">
        <Textarea rows={3} value={d.successDefinition ?? ""} onChange={(e) => update({ successDefinition: e.target.value })} />
      </Field>

      <div className="space-y-2">
        <Label className="text-sm font-medium">What metrics exist today?</Label>
        <div className="space-y-2">
          {kpis.map((k, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
              <Input placeholder="Metric" value={k.metric}
                onChange={(e) => update({ kpis: kpis.map((x, j) => (j === i ? { ...x, metric: e.target.value } : x)) })} />
              <Input placeholder="Current baseline" value={k.baseline ?? ""}
                onChange={(e) => update({ kpis: kpis.map((x, j) => (j === i ? { ...x, baseline: e.target.value } : x)) })} />
              <Input placeholder="Desired result" value={k.target ?? ""}
                onChange={(e) => update({ kpis: kpis.map((x, j) => (j === i ? { ...x, target: e.target.value } : x)) })} />
              <Button variant="ghost" size="sm" onClick={() => update({ kpis: kpis.filter((_, j) => j !== i) })}>
                Remove
              </Button>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-4">
          <Button
            variant="outline" size="sm"
            onClick={() => update({ kpis: [...kpis, { metric: "", baseline: "", target: "", noBaseline: false }] })}
          >
            Add metric
          </Button>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Checkbox
              checked={d.noBaselineExists ?? false}
              onCheckedChange={(c) => update({ noBaselineExists: c === true })}
            />
            No meaningful baseline exists today
          </label>
        </div>
      </div>

      {portfolio ? (
        <Field label="What value does this create?">
          <div className="space-y-3">
            <CheckboxGrid
              options={VALUE_LEVER_OPTIONS}
              selected={value.levers}
              onChange={(levers) => update({ valueCreation: { ...value, levers } })}
            />
            <Textarea rows={2} placeholder="How, specifically?"
              value={value.explanation ?? ""}
              onChange={(e) => update({ valueCreation: { ...value, explanation: e.target.value } })} />
          </div>
        </Field>
      ) : (
        <Field
          label="Which Specialist workflow changes, and how would improvement be observed?"
        >
          <Textarea rows={3}
            value={value.explanation ?? ""}
            onChange={(e) => update({ valueCreation: { levers: [], explanation: e.target.value } })} />
        </Field>
      )}

      <Field
        label="Requester effort estimate"
        helper="Your rough sense — triage will make the final call."
      >
        <RadioGroup
          value={d.effortEstimate ?? ""}
          onValueChange={(v) => update({ effortEstimate: v as DraftData["effortEstimate"] })}
          className="space-y-2"
        >
          {EFFORT_OPTIONS.map((o) => (
            <label key={o.value} className="flex items-start gap-3 rounded-md border p-3 text-sm has-[[data-state=checked]]:border-foreground/40">
              <RadioGroupItem value={o.value} className="mt-0.5" />
              <span>
                <span className="font-medium">{o.label}</span>
                <span className="block text-muted-foreground">{o.description}</span>
              </span>
            </label>
          ))}
        </RadioGroup>
      </Field>
    </div>
  );
}

function StepFeasibility({
  d, update, systems,
}: { d: DraftData; update: (p: DraftData) => void; systems: Option[] }) {
  const sources = d.dataSources ?? [];
  const sel = d.systems ?? [];
  const otherEntry = sel.find((s) => s.startsWith("other:"));
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label className="text-sm font-medium">What data would this solution require?</Label>
        <p className="text-xs text-muted-foreground">
          Best guesses are fine — &ldquo;Unknown&rdquo; is a valid and useful answer.
        </p>
        <div className="space-y-2">
          {sources.map((s, i) => (
            <div key={i} className="grid gap-2 rounded-md border p-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
              <Input placeholder="System / source" value={s.system}
                onChange={(e) => update({ dataSources: sources.map((x, j) => (j === i ? { ...x, system: e.target.value } : x)) })} />
              <Input placeholder="Data type" value={s.dataType ?? ""}
                onChange={(e) => update({ dataSources: sources.map((x, j) => (j === i ? { ...x, dataType: e.target.value } : x)) })} />
              <Select value={s.accessStatus}
                onValueChange={(v) => update({ dataSources: sources.map((x, j) => (j === i ? { ...x, accessStatus: v as typeof s.accessStatus } : x)) })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ACCESS_STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="ghost" size="sm"
                onClick={() => update({ dataSources: sources.filter((_, j) => j !== i) })}>
                Remove
              </Button>
            </div>
          ))}
        </div>
        <Button variant="outline" size="sm"
          onClick={() => update({ dataSources: [...sources, { system: "", dataType: "", owner: "", accessStatus: "UNKNOWN", notes: "" }] })}>
          Add data source
        </Button>
      </div>

      <Field label="What systems are involved?">
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
            {systems.map((s) => (
              <label key={s.id} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={sel.includes(s.id)}
                  onCheckedChange={(c) =>
                    update({ systems: c ? [...sel, s.id] : sel.filter((x) => x !== s.id) })
                  }
                />
                {s.label}
              </label>
            ))}
          </div>
          <Input
            placeholder="Other system(s)…"
            value={otherEntry ? otherEntry.slice(6) : ""}
            onChange={(e) => {
              const rest = sel.filter((s) => !s.startsWith("other:"));
              update({ systems: e.target.value ? [...rest, `other:${e.target.value}`] : rest });
            }}
          />
        </div>
      </Field>

      <Field label="Has this been attempted before?">
        <Select value={d.priorAttempts ?? ""} onValueChange={(v) => update({ priorAttempts: v as DraftData["priorAttempts"] })}>
          <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
          <SelectContent>
            {PRIOR_ATTEMPT_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      {d.priorAttempts && d.priorAttempts !== "NO" && d.priorAttempts !== "UNKNOWN" ? (
        <Field label="What happened, and is anything reusable?">
          <Textarea rows={3} value={d.priorAttemptsDetail ?? ""}
            onChange={(e) => update({ priorAttemptsDetail: e.target.value })} />
        </Field>
      ) : null}

      <Field label="How quickly could a useful artifact realistically be produced?" helper={TTA_HELPER}>
        <div className="flex items-center gap-2">
          <Input
            type="number" min={1} className="w-24"
            value={d.timeToArtifactValue ?? ""}
            onChange={(e) => update({ timeToArtifactValue: e.target.value ? Number(e.target.value) : null })}
          />
          <Select value={d.timeToArtifactUnit ?? ""} onValueChange={(v) => update({ timeToArtifactUnit: v as DraftData["timeToArtifactUnit"] })}>
            <SelectTrigger className="w-32"><SelectValue placeholder="Unit" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="DAYS">Days</SelectItem>
              <SelectItem value="WEEKS">Weeks</SelectItem>
              <SelectItem value="MONTHS">Months</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Field>
    </div>
  );
}

function StepPriority({ d, update }: { d: DraftData; update: (p: DraftData) => void }) {
  return (
    <div className="space-y-5">
      <Field label="If you could fund only one AI initiative this quarter, would this be it?">
        <RadioGroup
          value={d.onlyOneAnswer ?? ""}
          onValueChange={(v) => update({ onlyOneAnswer: v as DraftData["onlyOneAnswer"] })}
          className="flex gap-6"
        >
          {(["YES", "NO", "UNSURE"] as const).map((v) => (
            <label key={v} className="flex items-center gap-2 text-sm">
              <RadioGroupItem value={v} />
              {v === "YES" ? "Yes" : v === "NO" ? "No" : "Unsure"}
            </label>
          ))}
        </RadioGroup>
      </Field>
      <Field label="Why?">
        <Textarea rows={2} value={d.onlyOneWhy ?? ""} onChange={(e) => update({ onlyOneWhy: e.target.value })} />
      </Field>

      <Field label="Is there a deadline or forcing event?" optional>
        <div className="grid gap-2 sm:grid-cols-[10rem_1fr]">
          <Input type="date" value={d.forcingEventDate ?? ""}
            onChange={(e) => update({ forcingEventDate: e.target.value || null })} />
          <Input placeholder="Event (e.g. board meeting, contract renewal)"
            value={d.forcingEvent ?? ""} onChange={(e) => update({ forcingEvent: e.target.value })} />
        </div>
        {d.forcingEvent || d.forcingEventDate ? (
          <Textarea rows={2} className="mt-2" placeholder="Consequence of missing it"
            value={d.forcingConsequence ?? ""} onChange={(e) => update({ forcingConsequence: e.target.value })} />
        ) : null}
      </Field>

      <Field label="Who owns the business outcome?">
        <div className="grid gap-2 sm:grid-cols-2">
          <Input placeholder="Name" value={d.outcomeOwnerName ?? ""}
            onChange={(e) => update({ outcomeOwnerName: e.target.value })} />
          <Input placeholder="Title" value={d.outcomeOwnerTitle ?? ""}
            onChange={(e) => update({ outcomeOwnerTitle: e.target.value })} />
        </div>
      </Field>

      <Field label="Anything else we should understand?" optional>
        <Textarea rows={3} value={d.finalContext ?? ""} onChange={(e) => update({ finalContext: e.target.value })} />
      </Field>
    </div>
  );
}

function StepReview({
  d, missing, portfolio, companies, functions, goTo,
}: {
  d: DraftData; missing: string[]; portfolio: boolean;
  companies: Option[]; functions: Option[]; goTo: (i: number) => void;
}) {
  const company = companies.find((c) => c.id === d.portfolioCompanyId)?.label;
  const fn = functions.find((f) => f.id === d.functionId)?.label;
  const rows: [string, string | null | undefined, number][] = [
    ["Initiative", d.name, 0],
    portfolio ? ["Company", company, 0] : ["Specialist workflow", d.specialistWorkflow, 0],
    portfolio ? ["Function", fn, 0] : ["", null, 0],
    ["Sponsor", d.sponsorName, 0],
    ["Business problem", d.businessProblem, 1],
    ["AI task", d.aiTask, 2],
    ["90-day success", d.successDefinition, 2],
    ["Effort estimate", d.effortEstimate ?? null, 2],
    [
      "Time-to-Artifact",
      d.timeToArtifactValue ? `${d.timeToArtifactValue} ${d.timeToArtifactUnit?.toLowerCase()}` : null,
      3,
    ],
    ["Outcome owner", d.outcomeOwnerName, 4],
  ];
  return (
    <div className="space-y-5">
      {missing.length > 0 ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm">
          <div className="font-medium text-destructive">Before you can submit:</div>
          <ul className="mt-1 list-disc pl-5 text-destructive/90">
            {missing.map((m) => <li key={m}>{m}</li>)}
          </ul>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Everything required is complete. Review below, then submit. After
          submission your answers become the permanent record and can&apos;t be
          edited unless the triage team requests more information.
        </p>
      )}
      <dl className="divide-y rounded-md border">
        {rows
          .filter(([label]) => label)
          .map(([label, value, stepIdx]) => (
            <div key={label} className="flex items-start justify-between gap-4 px-4 py-2.5 text-sm">
              <dt className="w-40 shrink-0 text-muted-foreground">{label}</dt>
              <dd className="min-w-0 flex-1 whitespace-pre-wrap">
                {value || <span className="italic text-muted-foreground">Not provided</span>}
              </dd>
              <button
                type="button"
                onClick={() => goTo(stepIdx)}
                className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
              >
                Edit
              </button>
            </div>
          ))}
      </dl>
    </div>
  );
}
