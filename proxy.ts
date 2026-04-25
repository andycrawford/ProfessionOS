import { auth } from "@/auth";
import { NextResponse } from "next/server";
import type { NextFetchEvent, NextProxy } from "next/server";
import type { NextAuthRequest } from "next-auth";

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
 * NextAuth v5's `auth(callback)` returns a NextMiddleware when the callback
 * is typed as NextAuthMiddleware. Explicit parameter types guide TS to the
 * correct overload; the result is assignable to NextProxy (= NextMiddleware).
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const proxy: NextProxy = auth((req: NextAuthRequest, _event: NextFetchEvent) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;

  const isDashboard = pathname.startsWith("/dashboard");
  const isApi = pathname.startsWith("/api"); // /api/auth/* excluded by matcher

  if ((isDashboard || isApi) && !session) {
    if (isApi) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const signInUrl = new URL("/sign-in", req.url);
    signInUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(signInUrl);
  }

  // Already signed in — skip the sign-in page
  if (pathname === "/sign-in" && session) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }
});

export const config = {
  matcher: [
    "/dashboard/:path*",
    // /api/* but NOT /api/auth/* (NextAuth's own endpoints must stay open)
    "/api/((?!auth/).*)",
    "/sign-in",
  ],
};
