/** Client-only durable grants (not secrets on the server). */

const PROOF_KEY = "stf_device_proof";
const CODES_KEY = "stf_league_codes";
const USER_KEY = "stf_sleeper_username";

export type SavedLeagueCodes = {
  inviteCode: string;
  adminCode: string;
  leagueId: string;
  name: string;
  recovered?: boolean;
};

export function getDeviceProof(): string | null {
  try {
    return localStorage.getItem(PROOF_KEY);
  } catch {
    return null;
  }
}

export function setDeviceProof(token: string) {
  try {
    localStorage.setItem(PROOF_KEY, token);
  } catch {
    // ignore
  }
}

export function clearDeviceProof() {
  try {
    localStorage.removeItem(PROOF_KEY);
  } catch {
    // ignore
  }
}

export function getSavedUsername(): string {
  try {
    return localStorage.getItem(USER_KEY) || "";
  } catch {
    return "";
  }
}

export function setSavedUsername(username: string) {
  try {
    if (username) localStorage.setItem(USER_KEY, username);
  } catch {
    // ignore
  }
}

export function getSavedCodes(): SavedLeagueCodes[] {
  try {
    const raw = localStorage.getItem(CODES_KEY);
    return raw ? (JSON.parse(raw) as SavedLeagueCodes[]) : [];
  } catch {
    return [];
  }
}

export function saveLeagueCodes(codes: SavedLeagueCodes) {
  try {
    const prev = getSavedCodes();
    const next = [codes, ...prev.filter((c) => c.leagueId !== codes.leagueId)].slice(
      0,
      8,
    );
    localStorage.setItem(CODES_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

export function forgetThisDevice() {
  clearDeviceProof();
  try {
    localStorage.removeItem(CODES_KEY);
    localStorage.removeItem(USER_KEY);
  } catch {
    // ignore
  }
}
