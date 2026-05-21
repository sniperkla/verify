export { default } from "next-auth/middleware";

export const config = {
  matcher: [
    /*
     * Protect every route EXCEPT:
     *  - /login
     *  - /api/auth/* (NextAuth endpoints)
     *  - _next/static, _next/image, favicon.ico, public files
     */
    "/((?!login|register|api/auth|api/register|_next/static|_next/image|favicon\\.ico).*)",
  ],
};
