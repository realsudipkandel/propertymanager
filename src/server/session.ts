import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";

import { USER_ROLE, type UserRole } from "@/domain/constants";
import { prisma } from "@/server/db";

export const SESSION_COOKIE = "mira_session";

export type Session = {
  userId: string;
  tenantId: string;
  companyId: string;
  role: UserRole;
  name: string;
  email: string;
};

type TokenPayload = {
  userId: string;
  tenantId: string;
  companyId: string;
};

function authSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET must be at least 32 characters.");
  }
  return new TextEncoder().encode(secret);
}

function isUserRole(value: string): value is UserRole {
  return Object.values(USER_ROLE).includes(value as UserRole);
}

export async function createSessionToken(payload: TokenPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.userId)
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

export async function getSession(): Promise<Session | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) {
    return null;
  }
  try {
    const verified = await jwtVerify(token, authSecret());
    const userId = verified.payload.sub;
    const tenantId = verified.payload.tenantId;
    const companyId = verified.payload.companyId;
    if (typeof userId !== "string" || typeof tenantId !== "string" || typeof companyId !== "string") {
      return null;
    }
    const user = await prisma.user.findFirst({
      where: { id: userId, tenantId, companyId, isActive: true },
    });
    if (!user || !isUserRole(user.role)) {
      return null;
    }
    return {
      userId: user.id,
      tenantId: user.tenantId,
      companyId: user.companyId,
      role: user.role,
      name: user.name,
      email: user.email,
    };
  } catch {
    return null;
  }
}

export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  return session;
}

export function companyScope(session: Session): { tenantId: string; companyId: string } {
  return { tenantId: session.tenantId, companyId: session.companyId };
}
