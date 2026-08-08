import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

export type LeagueMembership = {
  leagueId: string;
  role: "admin" | "member";
  teamId?: string;
  claimToken?: string;
};

export type AppSession = {
  memberships: LeagueMembership[];
};

const COOKIE = "stf_session";

function secretKey() {
  const secret = process.env.AUTH_SECRET || "dev-secret-change-me-in-production";
  return new TextEncoder().encode(secret);
}

export async function getSession(): Promise<AppSession> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return { memberships: [] };
  try {
    const { payload } = await jwtVerify(token, secretKey());
    const memberships = (payload.memberships as LeagueMembership[]) || [];
    return { memberships };
  } catch {
    return { memberships: [] };
  }
}

export async function saveSession(session: AppSession) {
  const token = await new SignJWT({ memberships: session.memberships })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("90d")
    .sign(secretKey());

  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 90,
  });
}

export async function clearSession() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export function getMembership(session: AppSession, leagueId: string) {
  return session.memberships.find((m) => m.leagueId === leagueId);
}

export async function upsertMembership(membership: LeagueMembership) {
  const session = await getSession();
  const rest = session.memberships.filter((m) => m.leagueId !== membership.leagueId);
  await saveSession({ memberships: [...rest, membership] });
}

export async function removeMembership(leagueId: string) {
  const session = await getSession();
  await saveSession({
    memberships: session.memberships.filter((m) => m.leagueId !== leagueId),
  });
}

export function randomCode(bytes = 6) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}
