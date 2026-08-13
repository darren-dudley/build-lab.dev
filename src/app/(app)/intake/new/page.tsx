import type { RequestType } from "@prisma/client";
import { createDraftAction } from "@/server/intake/actions";
import { REQUEST_TYPES } from "@/lib/intake-schema";
import { auth } from "@/server/auth";
import { redirect } from "next/navigation";
import { db } from "@/server/db";

export const metadata = { title: "Submit Initiative" };

/*
 * UX (docs/02 §55): Goal — start a submission with zero friction.
 * Primary action — pick a request type; everything branches from it.
 * Empty/error states N/A (static choice). Draft resume handled via My Initiatives.
 */
export default async function NewIntakePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  // Resume hint: most recent draft, if any
  const draft = await db.initiative.findFirst({
    where: { requesterId: session.user.id, status: "DRAFT", deletedAt: null },
    orderBy: { updatedAt: "desc" },
    select: { id: true, name: true, updatedAt: true },
  });

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="space-y-1">
        <h1 className="text-lg font-semibold tracking-tight">Submit an AI initiative</h1>
        <p className="text-sm text-muted-foreground">
          Takes about 5–7 minutes if you know the opportunity well. Your answers
          save automatically — you can leave and come back anytime.
        </p>
      </div>

      {draft ? (
        <div className="rounded-md border bg-muted/40 px-4 py-3 text-sm">
          You have a draft in progress
          {draft.name !== "Untitled initiative" ? (
            <> — <span className="font-medium">{draft.name}</span></>
          ) : null}
          .{" "}
          <a className="font-medium underline underline-offset-2" href={`/intake/${draft.id}`}>
            Resume it
          </a>{" "}
          or start a new one below.
        </div>
      ) : null}

      <div className="space-y-3">
        <div className="text-sm font-medium">What kind of request is this?</div>
        {REQUEST_TYPES.map((t) => (
          <form key={t.value} action={createDraftAction.bind(null, t.value as RequestType)}>
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
