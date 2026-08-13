"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { upsertCompanyAction } from "@/server/admin/actions";

export function CompanyForm({
  company,
}: {
  company?: {
    id: string; name: string; sector: string | null; fundNumber: string | null;
    equityCheckUsd: number | null; valueUsd: number | null; isActive: boolean; exited: boolean;
  };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(company?.name ?? "");
  const [sector, setSector] = useState(company?.sector ?? "");
  const [fundNumber, setFundNumber] = useState(company?.fundNumber ?? "");
  const [equityCheck, setEquityCheck] = useState(company?.equityCheckUsd != null ? String(company.equityCheckUsd) : "");
  const [value, setValue] = useState(company?.valueUsd != null ? String(company.valueUsd) : "");
  const [isActive, setIsActive] = useState(company?.isActive ?? true);
  const [exited, setExited] = useState(company?.exited ?? false);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  function save() {
    setError(null);
    start(async () => {
      try {
        const money = (v: string) => {
          const n = Number(v.replace(/[$,\s]/g, ""));
          return v.trim() && Number.isFinite(n) && n >= 0 ? n : null;
        };
        await upsertCompanyAction(company?.id ?? null, {
          name: name.trim(),
          sector: sector.trim() || null,
          fundNumber: fundNumber.trim() || null,
          equityCheckUsd: money(equityCheck),
          valueUsd: money(value),
          isActive,
          exited,
        });
        setOpen(false);
        if (!company) { setName(""); setSector(""); setFundNumber(""); }
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Save failed");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {company ? (
          <Button size="sm" variant="ghost">Edit</Button>
        ) : (
          <Button size="sm">Add company</Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">
            {company ? `Edit ${company.name}` : "Add portfolio company"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Field label="Company name">
            <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </Field>
          <Field label="Sector">
            <Input value={sector} onChange={(e) => setSector(e.target.value)} placeholder="e.g. Healthcare Services" />
          </Field>
          <Field label="Fund number">
            <Input value={fundNumber} onChange={(e) => setFundNumber(e.target.value)} placeholder="e.g. Fund XIV" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Equity check (USD)">
              <Input value={equityCheck} onChange={(e) => setEquityCheck(e.target.value)} placeholder="e.g. 250,000,000" />
            </Field>
            <Field label="Current value (USD)">
              <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder="e.g. 600,000,000" />
            </Field>
          </div>
          {company ? (
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={isActive} onCheckedChange={(c) => setIsActive(c === true)} />
                Active (available for new initiatives)
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={exited} onCheckedChange={(c) => setExited(c === true)} />
                Exited — position realized; hidden from intake, Investment
                Priority, and portfolio calculations (history remains)
              </label>
            </div>
          ) : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button disabled={busy || !name.trim()} onClick={save}>
              {busy ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="text-sm font-medium">{label}</div>
      {children}
    </div>
  );
}
