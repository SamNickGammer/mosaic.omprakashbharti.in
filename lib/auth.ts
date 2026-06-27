import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";
import Credentials from "next-auth/providers/credentials";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { verifyPassword } from "@/lib/password";

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.NEXTAUTH_SECRET,
  // Trust the deployment host (Vercel sets this automatically; required for
  // self-hosting / `next start` behind a known host).
  trustHost: true,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
    }),
    Credentials({
      name: "Email & Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(creds) {
        const email = String(creds?.email ?? "")
          .trim()
          .toLowerCase();
        const password = String(creds?.password ?? "");
        if (!email || !password) return null;

        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, email))
          .limit(1);

        // No account, or an OAuth-only account without a password set.
        if (!user || !user.passwordHash) return null;
        if (!verifyPassword(password, user.passwordHash)) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
  ],
  callbacks: {
    /**
     * Stash our internal user id on the JWT so every request can scope queries.
     * Credentials sign-in already returns a DB user; OAuth sign-in upserts.
     */
    async jwt({ token, user, account }) {
      if (user) {
        if (account?.provider === "credentials") {
          token.uid = user.id;
        } else if (user.email) {
          const [row] = await db
            .insert(users)
            .values({
              email: user.email,
              name: user.name ?? null,
              image: user.image ?? null,
            })
            .onConflictDoUpdate({
              target: users.email,
              set: { name: user.name ?? null, image: user.image ?? null },
            })
            .returning({ id: users.id });
          if (row) token.uid = row.id;
        }
      }

      // Backfill on existing sessions issued before uid was stored.
      if (!token.uid && token.email) {
        const [row] = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.email, token.email))
          .limit(1);
        if (row) token.uid = row.id;
      }

      return token;
    },
    async session({ session, token }) {
      if (token.uid && session.user) {
        session.user.id = token.uid as string;
      }
      return session;
    },
  },
});
