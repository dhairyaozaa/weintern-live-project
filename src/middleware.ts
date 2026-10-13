import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

const COOKIE = "tf_session";
const secret = () =>
  new TextEncoder().encode(process.env.JWT_SECRET || "dev-secret-change-me");

async function roleFromToken(token?: string): Promise<string | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return String(payload.role ?? "");
  } catch {
    return null;
  }
}

const ROUTES: { prefix: string; roles: string[] }[] = [
  { prefix: "/organizer", roles: ["ORGANIZER", "ADMIN"] },
  { prefix: "/admin", roles: ["ADMIN"] },
  { prefix: "/checkout", roles: ["CUSTOMER", "ORGANIZER", "ADMIN"] },
  { prefix: "/bookings", roles: ["CUSTOMER", "ORGANIZER", "ADMIN"] },
  { prefix: "/notifications", roles: ["CUSTOMER", "ORGANIZER", "ADMIN"] },
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  // Onboarding is how a CUSTOMER becomes an organizer — allow it through.
  if (pathname === "/organizer/onboarding" || pathname.startsWith("/organizer/onboarding/")) {
    const role = await roleFromToken(req.cookies.get(COOKIE)?.value);
    if (!role) {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }
  const rule = ROUTES.find((r) => pathname === r.prefix || pathname.startsWith(r.prefix + "/"));
  if (!rule) return NextResponse.next();

  const role = await roleFromToken(req.cookies.get(COOKIE)?.value);
  if (!role) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  if (!rule.roles.includes(role)) {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/organizer/:path*", "/admin/:path*", "/checkout/:path*", "/bookings/:path*", "/notifications/:path*"],
};
