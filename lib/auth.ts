import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

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
  ],
  callbacks: {
    /**
     * On first sign-in, upsert the user into our own `users` table and stash
     * the internal user id on the JWT so every request can scope queries.
     */
    async jwt({ token, user }) {
      if (user?.email) {
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
