import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const hasAccessToken = Boolean(request.cookies.get("vaada_access")?.value);
  const hasRefreshToken = Boolean(request.cookies.get("vaada_refresh")?.value);
  const hasAuth = hasAccessToken || hasRefreshToken;

  const isProtectedPath =
    pathname.startsWith("/queue") ||
    pathname.startsWith("/cases") ||
    pathname.startsWith("/analytics") ||
    pathname.startsWith("/cfo") ||
    pathname.startsWith("/audit") ||
    pathname.startsWith("/razorpay-taxonomy") ||
    pathname.startsWith("/settings");

  // Unauthenticated user trying to access a protected workspace route
  if (isProtectedPath && !hasAuth) {
    const nextDestination = encodeURIComponent(pathname + search);
    const loginUrl = new URL(`/login?next=${nextDestination}`, request.url);
    return NextResponse.redirect(loginUrl);
  }

  // Already authenticated user visiting the login page
  if (pathname === "/login" && hasAuth) {
    return NextResponse.redirect(new URL("/queue", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/queue/:path*",
    "/cases/:path*",
    "/analytics/:path*",
    "/cfo/:path*",
    "/audit/:path*",
    "/razorpay-taxonomy/:path*",
    "/settings/:path*",
    "/login",
  ],
};
