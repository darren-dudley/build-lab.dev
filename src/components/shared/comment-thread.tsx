"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { EntityType } from "@prisma/client";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { addCommentAction } from "@/server/comments/actions";

export type CommentItem = {
  id: string;
  authorName: string;
  body: string;
  createdAt: string; // ISO
};

export function CommentThread({
  entityType,
  entityId,
  comments,
}: {
  entityType: EntityType;
  entityId: string;
  comments: CommentItem[];
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [busy, start] = useTransition();

  return (
    <div className="space-y-3">
      {comments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No discussion yet.</p>
      ) : (
        <ol className="space-y-3">
          {comments.map((c) => (
            <li key={c.id} className="rounded-md border px-3 py-2">
              <div className="mb-1 flex items-baseline justify-between gap-3 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{c.authorName}</span>
                <span>{formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}</span>
              </div>
              <p className="whitespace-pre-wrap text-sm">{c.body}</p>
            </li>
          ))}
        </ol>
      )}
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!body.trim()) return;
          start(async () => {
            await addCommentAction(entityType, entityId, body);
            setBody("");
            router.refresh();
          });
        }}
      >
        <Textarea
          rows={2}
          placeholder="Add a comment…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <div className="flex justify-end">
          <Button type="submit" size="sm" disabled={busy || !body.trim()}>
            {busy ? "Posting…" : "Comment"}
          </Button>
        </div>
      </form>
    </div>
  );
}
