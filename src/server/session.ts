import { cookies, headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";

import { type UserRole } from "@/domain/constants";
import { canCreateOrganization } from "@/domain/permissions";
import { isUserRole } from "@/domain/membership";
import { organizationPath } from "@/domain/organization";
import { prisma } from "@/server/db";

export const SESSION_COOKIE = "mira_session";
const ACTIVE_MEMBERSHIP = "ACTIVE";
const SESSION_ISSUER = "property-finance";
const SESSION_AUDIENCE = "property-finance";
const PRIVATE_RESPONSE = { "X-Content-Type-Options": "nosniff", "Cache-Control": "no-store" };

export type Session = {
  userId: string;
  tenantId: string;
  organizationId: string;
  organizationSlug: string;
  role: UserRole;
  name: string;
  email: string;
};

export type AuthenticatedUser = {
  userId: string;
  name: string;
  email: string;
  organizationId: string | null;
};

type TokenPayload = {
  userId: string;
  organizationId: string | null;
};

function authSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET must be at least 32 characters.");
  }
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(payload: TokenPayload): Promise<string> {
  const claims: Record<string, string> = {};
  if (payload.organizationId) {
    claims.organizationId = payload.organizationId;
  }
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.userId)
    .setIssuer(SESSION_ISSUER)
    .setAudience(SESSION_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(authSecret());
}

export async function writeSessionCookie(token: string): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

async function readToken(): Promise<TokenPayload | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) {
    return null;
  }
  try {
    const verified = await jwtVerify(token, authSecret(), { issuer: SESSION_ISSUER, audience: SESSION_AUDIENCE });
    const userId = verified.payload.sub;
    const organizationId = verified.payload.organizationId;
    if (typeof userId !== "string") {
      return null;
    }
    return {
      userId,
      organizationId: typeof organizationId === "string" ? organizationId : null,
    };
  } catch {
    return null;
  }
}

export async function getAuthenticatedUser(): Promise<AuthenticatedUser | null> {
  const token = await readToken();
  if (!token) {
    return null;
  }
  const user = await prisma.user.findFirst({ where: { id: token.userId, isActive: true } });
  if (!user) {
    return null;
  }
  return {
    userId: user.id,
    name: user.name,
    email: user.email,
    organizationId: token.organizationId,
  };
}

async function sessionForMembership(userId: string, organizationId: string): Promise<Session | null> {
  const membership = await prisma.organizationMembership.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
    include: { user: true, organization: true },
  });
  if (!membership || membership.status !== ACTIVE_MEMBERSHIP || !membership.user.isActive || !isUserRole(membership.role)) {
    return null;
  }
  return {
    userId: membership.user.id,
    tenantId: membership.organization.tenantId,
    organizationId: membership.organization.id,
    organizationSlug: membership.organization.slug,
    role: membership.role,
    name: membership.user.name,
    email: membership.user.email,
  };
}

export async function getSession(): Promise<Session | null> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return null;
  }
  const headerStore = await headers();
  const slug = headerStore.get("x-org-slug");
  if (slug) {
    const organization = await prisma.organization.findUnique({ where: { slug } });
    if (!organization) {
      return null;
    }
    return sessionForMembership(user.userId, organization.id);
  }
  if (!user.organizationId) {
    return null;
  }
  return sessionForMembership(user.userId, user.organizationId);
}

export async function getSessionForSlug(slug: string | null): Promise<Session | null> {
  if (!slug) {
    return getSession();
  }
  const user = await getAuthenticatedUser();
  if (!user) {
    return null;
  }
  const organization = await prisma.organization.findUnique({ where: { slug } });
  if (!organization) {
    return null;
  }
  return sessionForMembership(user.userId, organization.id);
}

export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (session) {
    return session;
  }
  const user = await getAuthenticatedUser();
  if (!user) {
    redirect("/login");
  }
  redirect("/organisations");
}

export async function requireOrganization(slug: string): Promise<Session> {
  const user = await getAuthenticatedUser();
  if (!user) {
    redirect("/login");
  }
  const organization = await prisma.organization.findUnique({ where: { slug } });
  if (!organization) {
    notFound();
  }
  const session = await sessionForMembership(user.userId, organization.id);
  if (!session) {
    notFound();
  }
  return session;
}

export async function landingPathForUser(userId: string): Promise<string> {
  const memberships = await prisma.organizationMembership.findMany({
    where: { userId, status: ACTIVE_MEMBERSHIP },
    include: { organization: true },
    orderBy: { organization: { tradingName: "asc" } },
  });
  const only = memberships[0];
  if (memberships.length === 1 && only) {
    return organizationPath(only.organization.slug);
  }
  return "/organisations";
}

export async function userCanCreateOrganization(userId: string): Promise<boolean> {
  const memberships = await prisma.organizationMembership.findMany({
    where: { userId, status: ACTIVE_MEMBERSHIP },
    select: { role: true },
  });
  return memberships.some((membership) => isUserRole(membership.role) && canCreateOrganization(membership.role));
}

export async function requireApiSession(slug: string | null): Promise<Session | Response> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return new Response("Sign in required.", { status: 401, headers: PRIVATE_RESPONSE });
  }
  const session = await getSessionForSlug(slug);
  if (!session) {
    return new Response("Not found.", { status: 404, headers: PRIVATE_RESPONSE });
  }
  return session;
}

export function isSession(value: Session | Response): value is Session {
  return !(value instanceof Response);
}

export function organizationScope(session: Session): { tenantId: string; organizationId: string } {
  return { tenantId: session.tenantId, organizationId: session.organizationId };
}
