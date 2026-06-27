"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Mode = "signin" | "register";

export function AuthForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  function oauth(provider: "google" | "github") {
    setOauthLoading(provider);
    void signIn(provider, { callbackUrl: "/" });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (mode === "register") {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, password }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          setError(data?.error ?? "Could not create account");
          return;
        }
      }

      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError(
          mode === "register"
            ? "Account created, but sign-in failed. Try signing in."
            : "Invalid email or password",
        );
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4 text-left">
      <div className="grid grid-cols-1 gap-2">
        <Button
          variant="outline"
          size="lg"
          className="w-full"
          disabled={!!oauthLoading}
          onClick={() => oauth("google")}
        >
          {oauthLoading === "google" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <GoogleIcon />
          )}
          Continue with Google
        </Button>
        <Button
          variant="outline"
          size="lg"
          className="w-full"
          disabled={!!oauthLoading}
          onClick={() => oauth("github")}
        >
          {oauthLoading === "github" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <GitHubIcon />
          )}
          Continue with GitHub
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">or</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={onSubmit} className="space-y-3">
        {mode === "register" ? (
          <div className="space-y-1.5">
            <Label htmlFor="auth-name">Name</Label>
            <Input
              id="auth-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              autoComplete="name"
            />
          </div>
        ) : null}

        <div className="space-y-1.5">
          <Label htmlFor="auth-email">Email</Label>
          <Input
            id="auth-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="auth-password">Password</Label>
          <Input
            id="auth-password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={mode === "register" ? "At least 8 characters" : "••••••••"}
            autoComplete={mode === "register" ? "new-password" : "current-password"}
          />
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <Button type="submit" size="lg" className="w-full" disabled={submitting}>
          {submitting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : null}
          {mode === "register" ? "Create account" : "Sign in"}
        </Button>
      </form>

      <p className="text-center text-xs text-muted-foreground">
        {mode === "register" ? "Already have an account?" : "New to Mosaic?"}{" "}
        <button
          type="button"
          className="font-medium text-foreground underline-offset-4 hover:underline"
          onClick={() => {
            setMode((m) => (m === "register" ? "signin" : "register"));
            setError(null);
          }}
        >
          {mode === "register" ? "Sign in" : "Create an account"}
        </button>
      </p>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M21.35 11.1H12v2.92h5.35a4.58 4.58 0 0 1-1.98 3v2.5h3.2c1.87-1.73 2.96-4.28 2.96-7.32 0-.7-.06-1.37-.18-2.02z"
        opacity="0.9"
      />
      <path
        fill="currentColor"
        d="M12 21c2.67 0 4.9-.88 6.54-2.39l-3.2-2.5c-.89.6-2.03.95-3.34.95-2.57 0-4.75-1.74-5.53-4.07H3.16v2.56A9 9 0 0 0 12 21z"
        opacity="0.5"
      />
      <path
        fill="currentColor"
        d="M6.47 12.99a5.4 5.4 0 0 1 0-3.45V6.98H3.16a9 9 0 0 0 0 8.07l3.31-2.06z"
        opacity="0.7"
      />
      <path
        fill="currentColor"
        d="M12 5.5c1.45 0 2.76.5 3.79 1.48l2.84-2.84A9 9 0 0 0 3.16 6.98l3.31 2.56C7.25 7.24 9.43 5.5 12 5.5z"
      />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 2C6.48 2 2 6.58 2 12.25c0 4.53 2.87 8.37 6.84 9.73.5.1.68-.22.68-.49 0-.24-.01-.88-.01-1.73-2.78.62-3.37-1.37-3.37-1.37-.45-1.18-1.11-1.5-1.11-1.5-.91-.64.07-.62.07-.62 1 .07 1.53 1.06 1.53 1.06.89 1.56 2.34 1.11 2.91.85.09-.66.35-1.11.63-1.37-2.22-.26-4.56-1.14-4.56-5.07 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.71 0 0 .84-.28 2.75 1.05a9.3 9.3 0 0 1 5 0c1.91-1.33 2.75-1.05 2.75-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.94-2.34 4.81-4.57 5.06.36.32.68.94.68 1.9 0 1.37-.01 2.48-.01 2.82 0 .27.18.6.69.49A10.26 10.26 0 0 0 22 12.25C22 6.58 17.52 2 12 2z"
      />
    </svg>
  );
}
