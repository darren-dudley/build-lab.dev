"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { markCompanyExitedAction } from "@/server/admin/actions";

export function MarkExitedButton({
  companyId,
  companyName,
}: {
  companyId: string;
  companyName: string;
}) {
  const router = useRouter();
  const [busy, start] = useTransition();

  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={busy}
      className="text-muted-foreground hover:text-destructive"
      onClick={() => {
        if (!window.confirm(`Mark ${companyName} as exited? It disappears from intake and portfolio calculations; history remains, and you can undo from Portfolio Companies → Show exited.`)) return;
        start(async () => {
          await markCompanyExitedAction(companyId, true);
          router.refresh();
        });
      }}
    >
      {busy ? "…" : "Mark exited"}
    </Button>
  );
}
