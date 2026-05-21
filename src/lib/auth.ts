import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { mongoClientPromise } from "@/lib/mongodb";

type Role = "admin" | "member";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const username = credentials?.username?.trim();
        const password = credentials?.password;
        if (!username || !password) return null;

        const client = await mongoClientPromise();
        const db = client.db();
        const user = await db.collection("users").findOne<{
          _id: unknown;
          username: string;
          passwordHash: string;
          role?: Role;
        }>({ username });
        if (!user) return null;

        const ok = await compare(password, user.passwordHash);
        if (!ok) return null;

        // next-auth expects an id string
        return { id: String(user._id), name: user.username, role: user.role ?? "member" };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      if (user?.name) token.name = user.name;
      if ((user as { role?: Role } | undefined)?.role) token.role = (user as { role?: Role }).role;
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) session.user.id = token.sub;
      if (session.user && token.role) session.user.role = token.role as Role;
      return session;
    },
  },
};
