import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { prisma } from "./prisma";

const COOKIE = "tf_session";
const secret = () =>
  new TextEncoder().encode(process.env.JWT_SECRET || "dev-secret-change-me");

export type Role = "CUSTOMER" | "ORGANIZER" | "ADMIN";
export type SessionUser = { id: string; email: string; name: string; role: Role };

export async function hashPassword(pw: string) {
  return bcrypt.hash(pw, 10);
}
export async function verifyPassword(pw: string, hash: string) {
  return bcrypt.compare(pw, hash);
}

export async function createSession(user: SessionUser) {
  const token = await new SignJWT({ ...user })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret());
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    secure: process.env.NODE_ENV === "production",
  });
}

export async function destroySession() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return {
      id: String(payload.id),
      email: String(payload.email),
      name: String(payload.name),
      role: payload.role as Role,
    };
  } catch {
    return null;
  }
}

/** Throws ApiError 401/403 unless the caller has one of the roles. */
export async function requireRole(...roles: Role[]): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new ApiError(401, "Please sign in to continue");
  if (roles.length && !roles.includes(user.role))
    throw new ApiError(403, "You do not have access to this resource");
  return user;
}

/** ApiError → ApiError mapping used by every route handler. */
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function requireOrganizerProfile(userId: string) {
  const profile = await prisma.organizerProfile.findUnique({
    where: { userId },
  });
  if (!profile) throw new ApiError(403, "Organizer profile not found");
  return profile;
}
