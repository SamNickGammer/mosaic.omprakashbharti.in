import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { SignInButton } from "@/components/auth/sign-in-button";
import { Logo } from "@/components/brand/logo";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/");

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-6">
      {/* Brand glow backdrop */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/2 size-[480px] -translate-x-1/2 rounded-full bg-gradient-brand opacity-20 blur-3xl"
      />

      <div className="relative w-full max-w-sm space-y-8 text-center">
        <div className="flex flex-col items-center space-y-5">
          <Logo width={184} />
          <div className="space-y-2">
            <h1 className="text-2xl font-bold leading-tight tracking-tight">
              One workspace for every{" "}
              <span className="text-gradient-brand">client, project, and AI agent</span>
            </h1>
            <p className="text-sm leading-normal text-muted-foreground">
              Send one task. The right agents collaborate behind the scenes and
              return one merged answer. Pieces come together.
            </p>
          </div>
        </div>

        <SignInButton />

        <p className="text-xs leading-normal text-muted-foreground">
          API keys are encrypted at rest with AES-256-GCM. Your credentials stay
          yours.
        </p>
      </div>
    </main>
  );
}
