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

const LINK_TYP = "stf_device_link_v1";

/** Short-lived link that copies this device's sign-in to another phone/computer. */
export async function createDeviceLinkToken(
  session: AppSession,
  opts?: { sleeperUsername?: string },
): Promise<string> {
  return new SignJWT({
    typ: LINK_TYP,
    memberships: session.memberships,
    sleeperUsername: opts?.sleeperUsername,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(secretKey());
}

export async function verifyDeviceLinkToken(token: string) {
  return verifyTyped(token, LINK_TYP);
}

export async function verifyDeviceProof(token: string) {
  return verifyTyped(token, PROOF_TYP);
}

async function verifyTyped(
  token: string,
  typ: string,
): Promise<DeviceProofPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (payload.typ !== typ) return null;
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
