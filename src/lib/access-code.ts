import { prisma } from "./prisma";
import { normalizeAccessCode } from "./session";

function codeCandidates(entered: string): string[] {
  const raw = entered.trim().toLowerCase();
  const norm = normalizeAccessCode(entered);
  const out = new Set<string>([raw, norm]);
  if (norm.length === 8) out.add(`${norm.slice(0, 4)}-${norm.slice(4)}`);
  if (norm.length === 12) {
    // legacy 6-byte hex sometimes shown grouped
    out.add(norm);
  }
  return [...out].filter(Boolean);
}

export async function findLeagueByAdminCode(entered: string) {
  const candidates = codeCandidates(entered);
  return prisma.league.findFirst({
    where: { OR: candidates.map((adminCode) => ({ adminCode })) },
  });
}

export async function findLeagueByInviteCode(entered: string) {
  const candidates = codeCandidates(entered);
  return prisma.league.findFirst({
    where: { OR: candidates.map((inviteCode) => ({ inviteCode })) },
  });
}
