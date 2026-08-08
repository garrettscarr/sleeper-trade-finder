/** Public Sleeper CDN assets (no auth). */

export function sleeperPlayerPhotoUrl(
  sleeperPlayerId: string | null | undefined,
  size: "thumb" | "full" = "thumb",
): string | null {
  if (!sleeperPlayerId) return null;
  // Draft pick / custom IDs aren't photo keys
  if (!/^\d+$/.test(sleeperPlayerId)) return null;
  if (size === "full") {
    return `https://sleepercdn.com/content/nfl/players/${sleeperPlayerId}.jpg`;
  }
  return `https://sleepercdn.com/content/nfl/players/thumb/${sleeperPlayerId}.jpg`;
}

export function sleeperTeamLogoUrl(nflTeam: string | null | undefined): string | null {
  if (!nflTeam) return null;
  const abbr = nflTeam.toUpperCase();
  return `https://sleepercdn.com/images/team_logos/nfl/${abbr.toLowerCase()}.png`;
}

export function sleeperUserAvatarUrl(avatar: string | null | undefined): string | null {
  if (!avatar) return null;
  return `https://sleepercdn.com/avatars/thumbs/${avatar}`;
}
