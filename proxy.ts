import { safeAuth } from "@/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Profession OS — Auth Proxy
 *
 * Next.js 16 renamed `middleware.ts` → `proxy.ts` (see proxy.md).
 * The exported function must be named `proxy` (or default export).
 *
 * Protection rules:
 *   /dashboard/*  — unauthenticated → redirect to /sign-in?callbackUrl=<path>
 *   /api/*        — unauthenticated → 401 JSON (except /api/auth/* which is
 *                   excluded from the matcher entirely)
 *   /sign-in      — authenticated → redirect to /dashboard
 *
 * Uses safeAuth() instead of the auth(callback) HOC so that deployments
 * without DATABASE_URL (e.g. demo.professionos.com) can return null safely
 * rather than crashing. The auth(callback) overload from an async NextAuth
 * factory does not satisfy Next.js 16's proxy function requirement.
 */
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Demo mode: no DATABASE_URL means this is a public demo deployment.
  // Pass all requests through — individual route handlers use safeAuth() and
  // return demo data (empty arrays, simulated streams) for unauthenticated users.
  if (!process.env.DATABASE_URL) {
    return NextResponse.next();
  }

  const isDashboard = pathname.startsWith("/dashboard");
  const isApi = pathname.startsWith("/api"); // /api/auth/* excluded by matcher

  // Call safeAuth — returns null if auth throws (e.g. no DATABASE_URL on demo).
  const session = await safeAuth();

  if ((isDashboard || isApi) && !session?.user?.id) {
    if (isApi) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const signInUrl = new URL("/sign-in", req.url);
    signInUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(signInUrl);
  }

  // Already signed in — skip the sign-in page
  if (pathname === "/sign-in" && session?.user?.id) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    // /api/* but NOT /api/auth/* (NextAuth's own endpoints must stay open)
    "/api/((?!auth/).*)",
    "/sign-in",
  ],
};
