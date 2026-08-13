// Public intake — intentionally outside the authenticated (app) group.
export default function SubmitLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-sidebar">
        <div className="mx-auto flex h-12 max-w-4xl items-center gap-2.5 px-6">
          <span className="rounded-sm bg-sidebar-primary px-1.5 py-0.5 text-[11px] font-bold tracking-wide text-sidebar-primary-foreground">
            BCP
          </span>
          <span className="text-sm font-semibold tracking-tight text-white">Build Lab</span>
          <span className="text-sm text-sidebar-foreground/60">· AI Initiative Intake</span>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-6 py-8">{children}</main>
    </div>
  );
}
