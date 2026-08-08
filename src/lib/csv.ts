import Papa from "papaparse";
import type { CsvRow } from "./player-match";

const NAME_KEYS = ["name", "player", "player_name", "playername", "full_name"];
const VALUE_KEYS = ["value", "ktc", "ktc_value", "trade_value", "sf_value", "one_qb_value", "1qb_value"];
const POS_KEYS = ["pos", "position"];
const ID_KEYS = ["sleeper_id", "sleeperid", "player_id", "id"];

function pick(row: Record<string, string>, keys: string[]): string | undefined {
  const entries = Object.entries(row);
  for (const key of keys) {
    const found = entries.find(([k]) => k.trim().toLowerCase() === key);
    if (found && found[1]?.trim()) return found[1].trim();
  }
  return undefined;
}

export function parseBaselineCsv(
  text: string,
  preferredValueColumn?: string,
): { rows: CsvRow[]; errors: string[] } {
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  const errors: string[] = [];
  if (parsed.errors.length) {
    errors.push(...parsed.errors.slice(0, 5).map((e) => e.message));
  }

  const valueKeys = preferredValueColumn
    ? [preferredValueColumn.toLowerCase(), ...VALUE_KEYS]
    : VALUE_KEYS;

  const rows: CsvRow[] = [];
  for (const [i, raw] of (parsed.data ?? []).entries()) {
    const name = pick(raw, NAME_KEYS);
    const valueRaw = pick(raw, valueKeys);
    if (!name || !valueRaw) {
      if (name || valueRaw) errors.push(`Row ${i + 2}: missing name or value`);
      continue;
    }
    const value = Number(String(valueRaw).replace(/,/g, ""));
    if (!Number.isFinite(value)) {
      errors.push(`Row ${i + 2}: invalid value "${valueRaw}"`);
      continue;
    }
    rows.push({
      name,
      value,
      position: pick(raw, POS_KEYS),
      sleeperId: pick(raw, ID_KEYS),
    });
  }

  return { rows, errors };
}
