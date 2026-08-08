import { SignJWT, jwtVerify } from "jose";
import type { AppSession, LeagueMembership } from "./session";

const PROOF_TYP = "stf_device_v1";

function secretKey() {
  const secret = process.env.AUTH_SECRET || "dev-secret-change-me-in-production";
  return new TextEncoder().encode(secret);
}

export type DeviceProofPayload = {
  memberships: LeagueMembership[];
  sleeperUsername?: string;
};

/** Long-lived signed grant saved on the phone/browser — not an account. */
export async function createDeviceProof(
  session: AppSession,
  opts?: { sleeperUsername?: string },
): Promise<string> {
  return new SignJWT({
    typ: PROOF_TYP,
    memberships: session.memberships,
    sleeperUsername: opts?.sleeperUsername,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("180d")
    .sign(secretKey());
}

export async function verifyDeviceProof(
  token: string,
): Promise<DeviceProofPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (payload.typ !== PROOF_TYP) return null;
    const memberships = (payload.memberships as LeagueMembership[]) || [];
    if (!Array.isArray(memberships) || memberships.length === 0) return null;
    return {
      memberships,
      sleeperUsername:
        typeof payload.sleeperUsername === "string"
          ? payload.sleeperUsername
          : undefined,
    };
  } catch {
    return null;
  }
}
