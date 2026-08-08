import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import type { NextResponse } from "next/server";

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

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    // Vercel is always HTTPS; NODE_ENV alone is not enough in every runtime.
    secure: process.env.VERCEL === "1" || process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 90,
  };
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

export async function createSessionToken(session: AppSession): Promise<string> {
  return new SignJWT({ memberships: session.memberships })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("90d")
    .sign(secretKey());
}

/** Prefer this in Route Handlers so Set-Cookie is attached to the JSON response. */
export async function writeSession(res: NextResponse, session: AppSession) {
  const token = await createSessionToken(session);
  res.cookies.set(COOKIE, token, cookieOptions());
}

export async function saveSession(session: AppSession) {
  const token = await createSessionToken(session);
  const jar = await cookies();
  jar.set(COOKIE, token, cookieOptions());
}

export async function clearSession() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export function clearSessionOnResponse(res: NextResponse) {
  res.cookies.set(COOKIE, "", { ...cookieOptions(), maxAge: 0 });
}

export function getMembership(session: AppSession, leagueId: string) {
  return session.memberships.find((m) => m.leagueId === leagueId);
}

export async function mergeMembership(
  session: AppSession,
  membership: LeagueMembership,
): Promise<AppSession> {
  const rest = session.memberships.filter((m) => m.leagueId !== membership.leagueId);
  return { memberships: [...rest, membership] };
}

export async function upsertMembership(membership: LeagueMembership) {
  const session = await getSession();
  await saveSession(await mergeMembership(session, membership));
}

/** Upsert membership and attach cookie to this response (Route Handlers). */
export async function upsertMembershipOnResponse(
  res: NextResponse,
  membership: LeagueMembership,
) {
  const session = await getSession();
  await writeSession(res, await mergeMembership(session, membership));
}

export async function removeMembership(leagueId: string) {
  const session = await getSession();
  await saveSession({
    memberships: session.memberships.filter((m) => m.leagueId !== leagueId),
  });
}

/** Legacy hex codes (still accepted). Prefer randomAccessCode for new leagues. */
export function randomCode(bytes = 6) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Short invite/admin codes: `abcd-efgh` (32-char alphabet, ~40 bits). */
export function randomAccessCode(length = 8): string {
  const alphabet = "23456789abcdefghjkmnpqrstuvwxyz";
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  let out = "";
  for (const b of arr) out += alphabet[b % alphabet.length];
  if (length >= 8) return `${out.slice(0, 4)}-${out.slice(4, 8)}`;
  return out;
}

/** Normalize user-entered codes for lookup (strip dashes/spaces). */
export function normalizeAccessCode(code: string): string {
  return code.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** DB may store dashed or undashed — compare normalized. */
export function codesMatch(stored: string, entered: string): boolean {
  return normalizeAccessCode(stored) === normalizeAccessCode(entered);
}
