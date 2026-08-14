import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { z } from "zod";
import type { RoleType } from "@prisma/client";
import { db } from "@/server/db";
import { clearFailures, isLockedOut, recordFailure } from "./rate-limit";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      roles: RoleType[];
    } & DefaultSession["user"];
  }
  interface User {
    roles?: RoleType[];
  }
}

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;

        // Durable brute-force throttle. Locked accounts fail generically so
        // this never reveals whether an email exists.
        if (await isLockedOut(email)) return null;

        const user = await db.user.findUnique({
          where: { email: email.toLowerCase() },
          include: { roles: true },
        });
        if (!user || !user.isActive || user.deletedAt) {
          await recordFailure(email);
          return null;
        }

        const valid = await compare(password, user.passwordHash);
        if (!valid) {
          await recordFailure(email);
          return null;
        }

        await clearFailures(email);
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          roles: user.roles.map((r) => r.role),
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.roles = user.roles ?? [];
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id as string;
      session.user.roles = (token.roles as RoleType[]) ?? [];
      return session;
    },
  },
});
