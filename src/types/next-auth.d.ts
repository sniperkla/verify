import "next-auth";
import "next-auth/jwt";

type Role = "admin" | "member";

declare module "next-auth" {
  interface User {
    role?: Role;
  }

  interface Session {
    user?: {
      id: string;
      role?: Role;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: Role;
  }
}
