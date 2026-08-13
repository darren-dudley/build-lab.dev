import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { auth, signIn } from "@/server/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (session?.user) redirect("/home");
  const { error } = await searchParams;

  async function login(formData: FormData) {
    "use server";
    try {
      await signIn("credentials", {
        email: formData.get("email"),
        password: formData.get("password"),
        redirectTo: "/home",
      });
    } catch (e) {
      if (e instanceof AuthError) redirect("/login?error=1");
      throw e; // NEXT_REDIRECT passes through
    }
  }

  return (
    <main className="flex min-h-screen">
      {/* Brand panel */}
      <div className="hidden flex-col justify-between bg-sidebar p-10 text-sidebar-foreground lg:flex lg:w-[44%]">
        <div className="flex items-baseline gap-2.5">
          <span className="rounded-sm bg-sidebar-primary px-2 py-1 text-sm font-bold tracking-wide text-sidebar-primary-foreground">
            BCP
          </span>
          <span className="text-lg font-semibold tracking-tight text-white">Build Lab</span>
        </div>
        <div className="space-y-4">
          <p className="max-w-md text-2xl font-semibold leading-snug tracking-tight text-white">
            From idea to measured value.
          </p>
          <p className="max-w-sm text-sm leading-relaxed text-sidebar-foreground/70">
            A shared home for AI ideas. Capture them, evaluate them the same
            way every time, and follow what gets built.
          </p>
        </div>
        <p className="text-xs text-sidebar-foreground/50">
          Data informs. Scoring creates consistency. Humans decide.
        </p>
      </div>

      {/* Form panel */}
      <div className="flex flex-1 items-center justify-center bg-background px-6">
        <div className="w-full max-w-sm space-y-6">
          <div className="space-y-1 lg:hidden">
            <div className="flex items-baseline gap-2">
              <span className="rounded-sm bg-primary px-1.5 py-0.5 text-[11px] font-bold tracking-wide text-primary-foreground">
                BCP
              </span>
              <span className="text-base font-semibold tracking-tight">Build Lab</span>
            </div>
          </div>
          <div className="space-y-1">
            <h1 className="text-xl font-semibold tracking-tight">Sign in</h1>
            <p className="text-sm text-muted-foreground">
              Use your BCP Build Lab credentials.
            </p>
          </div>
          <form action={login} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" autoComplete="email" required autoFocus />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" autoComplete="current-password" required />
            </div>
            {error ? (
              <p className="text-sm text-destructive" role="alert">
                That email and password don&apos;t match. Try again.
              </p>
            ) : null}
            <Button type="submit" className="w-full">
              Sign in
            </Button>
          </form>
          <p className="text-xs text-muted-foreground">
            Access is by invitation — contact your administrator.
          </p>
        </div>
      </div>
    </main>
  );
}
