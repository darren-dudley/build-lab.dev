"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type PortfolioRow = {
  id: string;
  name: string;
  company: string | null;
  functionLabel: string | null;
  scoreType: "Portfolio" | "Specialist";
  composite: number;
  opportunityQuality: number;
  bcPriority: number | null;
  tta: string;
  effort: string;
  status: string;
  statusLabel: string;
  decision: string | null;
  assignment: string | null;
  flagCount: number;
  sponsor: string | null;
};

type SortKey = "composite" | "opportunityQuality" | "bcPriority" | "name" | "company";
type GroupKey = "none" | "company" | "functionLabel" | "statusLabel" | "assignment";

export function PortfolioTable({ rows }: { rows: PortfolioRow[] }) {
  const router = useRouter();
  const [sortKey, setSortKey] = useState<SortKey>("composite");
  const [sortDir, setSortDir] = useState<1 | -1>(-1);
  const [group, setGroup] = useState<GroupKey>("none");
  const [fCompany, setFCompany] = useState("all");
  const [fFunction, setFFunction] = useState("all");
  const [fType, setFType] = useState("all");
  const [fStatus, setFStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);

  const companies = useMemo(() => [...new Set(rows.map((r) => r.company).filter(Boolean))] as string[], [rows]);
  const functions = useMemo(() => [...new Set(rows.map((r) => r.functionLabel).filter(Boolean))] as string[], [rows]);
  const statuses = useMemo(() => [...new Set(rows.map((r) => r.statusLabel))], [rows]);

  const filtered = useMemo(() => {
    let out = rows;
    if (fCompany !== "all") out = out.filter((r) => r.company === fCompany);
    if (fFunction !== "all") out = out.filter((r) => r.functionLabel === fFunction);
    if (fType !== "all") out = out.filter((r) => r.scoreType === fType);
    if (fStatus !== "all") out = out.filter((r) => r.statusLabel === fStatus);
    if (search) {
      const q = search.toLowerCase();
      out = out.filter((r) => r.name.toLowerCase().includes(q) || r.company?.toLowerCase().includes(q));
    }
    return [...out].sort((a, b) => {
      const av = a[sortKey] ?? -Infinity;
      const bv = b[sortKey] ?? -Infinity;
      return (av < bv ? -1 : av > bv ? 1 : 0) * sortDir;
    });
  }, [rows, fCompany, fFunction, fType, fStatus, search, sortKey, sortDir]);

  const groups = useMemo(() => {
    if (group === "none") return [{ label: null as string | null, rows: filtered }];
    const map = new Map<string, PortfolioRow[]>();
    for (const r of filtered) {
      const key = (r[group] as string | null) ?? "—";
      map.set(key, [...(map.get(key) ?? []), r]);
    }
    return [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([label, rows]) => ({ label, rows }));
  }, [filtered, group]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 1 ? -1 : 1));
    else {
      setSortKey(key);
      setSortDir(-1);
    }
  }

  function toggleSelect(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length < 5 ? [...s, id] : s));
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} className="h-8 w-44" />
        <FilterSelect value={fCompany} onChange={setFCompany} all="All companies" options={companies} />
        <FilterSelect value={fFunction} onChange={setFFunction} all="All functions" options={functions} />
        <FilterSelect value={fType} onChange={setFType} all="All score types" options={["Portfolio", "Specialist"]} />
        <FilterSelect value={fStatus} onChange={setFStatus} all="All statuses" options={statuses} />
        <Select value={group} onValueChange={(v) => setGroup(v as GroupKey)}>
          <SelectTrigger className="h-8 w-40 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No grouping</SelectItem>
            <SelectItem value="company">Group by company</SelectItem>
            <SelectItem value="functionLabel">Group by function</SelectItem>
            <SelectItem value="statusLabel">Group by status</SelectItem>
            <SelectItem value="assignment">Group by assignment</SelectItem>
          </SelectContent>
        </Select>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{filtered.length} initiatives</span>
          <Button
            size="sm"
            variant="outline"
            disabled={selected.length < 2}
            onClick={() => router.push(`/governance/compare?ids=${selected.join(",")}`)}
          >
            Compare{selected.length > 0 ? ` (${selected.length})` : ""}
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full min-w-[980px] text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
              <th className="w-8 px-2 py-2" />
              <SortTh label="Initiative" k="name" sortKey={sortKey} dir={sortDir} onSort={toggleSort} />
              <SortTh label="Company" k="company" sortKey={sortKey} dir={sortDir} onSort={toggleSort} />
              <th className="px-3 py-2 font-medium">Function</th>
              <th className="px-3 py-2 font-medium">Type</th>
              <SortTh label="Score" k="composite" sortKey={sortKey} dir={sortDir} onSort={toggleSort} right />
              <SortTh label="Opp. Quality" k="opportunityQuality" sortKey={sortKey} dir={sortDir} onSort={toggleSort} right />
              <SortTh label="BC Priority" k="bcPriority" sortKey={sortKey} dir={sortDir} onSort={toggleSort} right />
              <th className="px-3 py-2 font-medium">TTA</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Decision</th>
              <th className="px-3 py-2 font-medium">Assignment</th>
              <th className="px-3 py-2 text-right font-medium">Flags</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <GroupRows key={g.label ?? "__all"} group={g} selected={selected} onToggle={toggleSelect} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function GroupRows({
  group, selected, onToggle,
}: {
  group: { label: string | null; rows: PortfolioRow[] };
  selected: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <>
      {group.label !== null ? (
        <tr className="border-b bg-muted/60">
          <td colSpan={13} className="px-3 py-1.5 text-xs font-semibold">
            {group.label} <span className="font-normal text-muted-foreground">({group.rows.length})</span>
          </td>
        </tr>
      ) : null}
      {group.rows.map((r) => (
        <tr key={r.id} className="border-b transition-colors last:border-0 hover:bg-accent/40">
          <td className="px-2 py-2">
            <Checkbox
              checked={selected.includes(r.id)}
              onCheckedChange={() => onToggle(r.id)}
              aria-label={`Select ${r.name} for comparison`}
            />
          </td>
          <td className="px-3 py-2">
            <Link href={`/initiatives/${r.id}`} className="font-medium hover:underline">{r.name}</Link>
          </td>
          <td className="px-3 py-2">{r.company ?? "Specialist"}</td>
          <td className="px-3 py-2">{r.functionLabel ?? "—"}</td>
          <td className="px-3 py-2">
            <span className={cn(
              "rounded-full px-2 py-0.5 text-xs font-medium",
              r.scoreType === "Portfolio"
                ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                : "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300",
            )}>
              {r.scoreType}
            </span>
          </td>
          <td className="px-3 py-2 text-right font-semibold tabular-nums">{r.composite}</td>
          <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{r.opportunityQuality}</td>
          <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
            {r.bcPriority != null ? r.bcPriority.toFixed(2) : "—"}
          </td>
          <td className="px-3 py-2 whitespace-nowrap">{r.tta}</td>
          <td className="px-3 py-2 whitespace-nowrap text-xs">{r.statusLabel}</td>
          <td className="px-3 py-2 whitespace-nowrap text-xs">{r.decision ?? "—"}</td>
          <td className="px-3 py-2 whitespace-nowrap text-xs">{r.assignment ?? "—"}</td>
          <td className="px-3 py-2 text-right">
            {r.flagCount > 0 ? (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-100 px-1.5 text-xs font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                {r.flagCount}
              </span>
            ) : null}
          </td>
        </tr>
      ))}
    </>
  );
}

function FilterSelect({
  value, onChange, all, options,
}: {
  value: string; onChange: (v: string) => void; all: string; options: string[];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-8 w-40 text-xs"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{all}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o} value={o}>{o}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function SortTh({
  label, k, sortKey, dir, onSort, right,
}: {
  label: string; k: SortKey; sortKey: SortKey; dir: 1 | -1;
  onSort: (k: SortKey) => void; right?: boolean;
}) {
  return (
    <th className={cn("px-3 py-2 font-medium", right && "text-right")}>
      <button type="button" onClick={() => onSort(k)} className="inline-flex items-center gap-1 hover:text-foreground">
        {label}
        {sortKey === k ? <span>{dir === -1 ? "↓" : "↑"}</span> : null}
      </button>
    </th>
  );
}
