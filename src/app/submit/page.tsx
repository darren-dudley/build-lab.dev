import type { RequestType } from "@prisma/client";
import { createPublicDraftAction } from "@/server/intake/public-actions";
import { REQUEST_TYPES } from "@/lib/intake-schema";

export const metadata = { title: "Submit an AI Initiative" };

/*
 * Public entry point — no login required (product decision 2026-08-13).
 * Same branching intake as the internal flow; requester identifies themselves
 * inside the form.
 */
export default function PublicSubmitPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="space-y-1">
        <h1 className="text-lg font-semibold tracking-tight">Submit an AI initiative</h1>
        <p className="text-sm text-muted-foreground">
          Takes about 5–7 minutes if you know the opportunity well. Your answers
          save automatically — keep this page&apos;s link if you want to finish later.
        </p>
      </div>
      <div className="space-y-3">
        <div className="text-sm font-medium">What kind of request is this?</div>
        {REQUEST_TYPES.map((t) => (
          <form key={t.value} action={createPublicDraftAction.bind(null, t.value as RequestType)}>
            <button
              type="submit"
              className="w-full rounded-lg border p-4 text-left transition-colors hover:border-foreground/30 hover:bg-accent/40 focus-visible:outline-2 focus-visible:outline-ring"
            >
              <div className="text-sm font-medium">{t.label}</div>
              <div className="mt-0.5 text-sm text-muted-foreground">{t.description}</div>
            </button>
          </form>
        ))}
      </div>
    </div>
  );
}
