import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { compare } from "bcryptjs";
import { mongoClientPromise } from "@/lib/mongodb";

type Role = "admin" | "member";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    // ─── Google OAuth ───────────────────────────────────────────────────────
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),

    // ─── Username / Password ─────────────────────────────────────────────
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

        return { id: String(user._id), name: user.username, role: user.role ?? "member" };
      },
    }),
  ],

  callbacks: {
    // Auto-create / upsert Google users in MongoDB on first sign-in
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        try {
          const client = await mongoClientPromise();
          const db = client.db();
          await db.collection("users").updateOne(
            { email: user.email },
            {
              $setOnInsert: {
                email: user.email,
                name: user.name,
                image: user.image,
                role: "member" as Role,
                provider: "google",
                createdAt: new Date(),
              },
            },
            { upsert: true }
          );
        } catch {
          return false;
        }
      }
      return true;
    },

    async jwt({ token, user, account }) {
      // Credentials login — user object is populated on first sign-in
      if (user?.id) token.sub = user.id;
      if (user?.name) token.name = user.name;
      if ((user as { role?: Role } | undefined)?.role) {
        token.role = (user as { role?: Role }).role;
      }

      // Google login — fetch the role from MongoDB
      if (account?.provider === "google" && token.email) {
        try {
          const client = await mongoClientPromise();
          const db = client.db();
          const dbUser = await db
            .collection("users")
            .findOne<{ _id: unknown; role?: Role }>({ email: token.email });
          if (dbUser) {
            token.sub = String(dbUser._id);
            token.role = dbUser.role ?? "member";
          }
        } catch {
          /* ignore */
        }
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user && token.sub) session.user.id = token.sub;
      if (session.user && token.role) session.user.role = token.role as Role;
      return session;
    },
  },
};
