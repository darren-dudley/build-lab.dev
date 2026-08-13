// Public intake — intentionally outside the authenticated (app) group.
export default function SubmitLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex h-12 max-w-4xl items-center px-6 text-sm font-semibold tracking-tight">
          AI Initiative Intake
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-6 py-8">{children}</main>
    </div>
  );
}
