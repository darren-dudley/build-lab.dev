"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { importCompaniesAction } from "@/server/admin/actions";

export function ImportCompaniesDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, start] = useTransition();

  function run() {
    setResult(null);
    setErrors([]);
    start(async () => {
      const r = await importCompaniesAction(text);
      if (!r.ok) {
        setErrors(r.errors);
        return;
      }
      setResult(`Imported: ${r.created} new, ${r.updated} updated.`);
      setErrors(r.errors);
      setText("");
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">Import</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base">Import portfolio companies</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Paste rows copied from a spreadsheet or PDF table — one company per
            line: <span className="font-medium text-foreground">Name, Fund, Equity Check, Value</span>{" "}
            (tab- or comma-separated; $ and commas in numbers are fine).
          </p>
          <Textarea
            rows={8}
            placeholder={"Acme Health\tFund XIV\t$250,000,000\t$600,000,000"}
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="font-mono text-xs"
          />
          <p className="text-xs text-muted-foreground">
            Existing companies (matched by name) are updated. Companies with
            financials get a BC Investment Priority reference derived from
            portfolio quintiles + fund vintage — review it under Investment
            Priority and override as needed.
          </p>
          {result ? <p className="text-sm text-green-700 dark:text-green-400">{result}</p> : null}
          {errors.length > 0 ? (
            <ul className="list-disc pl-5 text-xs text-destructive">
              {errors.map((e) => <li key={e}>{e}</li>)}
            </ul>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>Close</Button>
            <Button disabled={busy || !text.trim()} onClick={run}>
              {busy ? "Importing…" : "Import"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
