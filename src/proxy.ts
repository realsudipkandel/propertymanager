import { NextResponse, type NextRequest } from "next/server";

const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "DENY",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Content-Security-Policy": "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'",
};

function organizationSlugFromPath(pathname: string): string | null {
  const slugMatch = /^\/org\/([^/]+)/.exec(pathname);
  const rawSlug = slugMatch?.[1];
  if (!rawSlug) {
    return null;
  }
  try {
    return decodeURIComponent(rawSlug);
  } catch {
    return null;
  }
}

export function proxy(request: NextRequest): NextResponse {
  const headers = new Headers(request.headers);
  headers.delete("x-org-slug");
  headers.delete("x-pathname");
  headers.set("x-pathname", request.nextUrl.pathname);
  const organizationSlug = organizationSlugFromPath(request.nextUrl.pathname);
  if (organizationSlug) {
    headers.set("x-org-slug", organizationSlug);
  }
  const response = NextResponse.next({ request: { headers } });
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(name, value);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|brand/|icon.png).*)"],
};
