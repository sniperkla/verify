import { withAuth } from "next-auth/middleware";

export default withAuth;

export const config = {
  matcher: [
    "/((?!login|register|api/auth|api/register|_next/static|_next/image|favicon\\.ico|public).*)",
  ],
};
