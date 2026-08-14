"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { upsertUserAction } from "@/server/admin/more-actions";

const ROLES = [
  { value: "REQUESTER", label: "Requester" },
  { value: "TRIAGE", label: "Triage" },
  { value: "GOVERNANCE", label: "Governance" },
  { value: "DELIVERY", label: "Delivery" },
  { value: "ADMIN", label: "Administrator" },
] as const;

type UserData = {
  id: string; name: string; email: string; title: string | null;
  roles: string[]; isActive: boolean;
};

export function UserForm({ user }: { user?: UserData }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [title, setTitle] = useState(user?.title ?? "");
  const [roles, setRoles] = useState<string[]>(user?.roles ?? ["REQUESTER"]);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isActive, setIsActive] = useState(user?.isActive ?? true);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  function save() {
    setError(null);
    start(async () => {
      try {
        const result = await upsertUserAction(user?.id ?? null, {
          name: name.trim(),
          email: email.trim(),
          title: title.trim() || null,
          roles,
          password: password || undefined,
          isActive,
        });
        if (result && !result.ok) {
          setError(result.error);
          return;
        }
        setOpen(false);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Save failed");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {user ? <Button size="sm" variant="ghost">Edit</Button> : <Button size="sm">Add user</Button>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">{user ? `Edit ${user.name}` : "Add user"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          <Input placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input placeholder="Title (optional)" value={title} onChange={(e) => setTitle(e.target.value)} />
          <div className="space-y-1.5">
            <div className="text-sm font-medium">Roles</div>
            <div className="grid grid-cols-2 gap-1.5">
              {ROLES.map((r) => (
                <label key={r.value} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={roles.includes(r.value)}
                    onCheckedChange={(c) =>
                      setRoles(c ? [...roles, r.value] : roles.filter((x) => x !== r.value))
                    }
                  />
                  {r.label}
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between">
              <div className="text-sm font-medium">
                {user ? "Reset password" : "Initial password"}
                {user ? <span className="ml-1 font-normal text-muted-foreground">(leave blank to keep)</span> : null}
              </div>
              <button
                type="button"
                className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                onClick={() => setShowPassword((v) => !v)}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
            <Input type={showPassword ? "text" : "password"} autoComplete="new-password" value={password}
              onChange={(e) => setPassword(e.target.value)} placeholder="10+ characters" />
            <Input type={showPassword ? "text" : "password"} autoComplete="new-password" value={confirm}
              onChange={(e) => setConfirm(e.target.value)} placeholder="Type it again to confirm" />
            {password && confirm && password !== confirm ? (
              <p className="text-xs text-destructive">The passwords don&apos;t match yet.</p>
            ) : null}
          </div>
          {user ? (
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={isActive} onCheckedChange={(c) => setIsActive(c === true)} />
              Active (can sign in)
            </label>
          ) : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button disabled={busy || !name.trim() || !email.trim() || roles.length === 0 || password !== confirm} onClick={save}>
              {busy ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
