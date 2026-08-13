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
    <main className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-6 px-6">
        <div className="space-y-1">
          <h1 className="text-lg font-semibold tracking-tight">Sign in</h1>
          <p className="text-sm text-muted-foreground">
            AI Initiative Portfolio
          </p>
        </div>
        <form action={login} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </div>
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              Invalid email or password.
            </p>
          ) : null}
          <Button type="submit" className="w-full">
            Sign in
          </Button>
        </form>
        <p className="text-xs text-muted-foreground">
          Access is by invitation. Contact your administrator.
        </p>
      </div>
    </main>
  );
}
