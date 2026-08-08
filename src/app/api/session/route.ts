import { NextResponse } from "next/server";
import { clearSessionOnResponse, getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  return NextResponse.json(session);
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  clearSessionOnResponse(res);
  return res;
}
