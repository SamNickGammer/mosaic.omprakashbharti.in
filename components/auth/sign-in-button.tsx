"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

import { Button } from "@/components/ui/button";

export function SignInButton() {
  const [loading, setLoading] = useState(false);

  return (
    <Button
      size="lg"
      className="w-full"
      disabled={loading}
      onClick={() => {
        setLoading(true);
        void signIn("google", { callbackUrl: "/" });
      }}
    >
      <GoogleIcon />
      {loading ? "Redirecting…" : "Continue with Google"}
    </Button>
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
