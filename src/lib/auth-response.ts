import { NextResponse } from "next/server";
import { createDeviceProof } from "./device-proof";
import {
  getSession,
  mergeMembership,
  writeSession,
  type AppSession,
  type LeagueMembership,
} from "./session";

/** Set session cookie + return JSON that includes a refreshable deviceProof. */
export async function jsonWithMembership(
  body: Record<string, unknown>,
  membership: LeagueMembership,
  opts?: { sleeperUsername?: string },
) {
  const session = await mergeMembership(await getSession(), membership);
  return jsonWithSession(body, session, opts);
}

export async function jsonWithSession(
  body: Record<string, unknown>,
  session: AppSession,
  opts?: { sleeperUsername?: string },
) {
  const deviceProof = await createDeviceProof(session, {
    sleeperUsername: opts?.sleeperUsername,
  });
  const res = NextResponse.json({ ...body, deviceProof });
  await writeSession(res, session);
  return res;
}
