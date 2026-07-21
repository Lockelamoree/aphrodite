/**
 * Rule-based occasion parsing for the deterministic (no-Claude) mode.
 * Best-effort: extracts an occasion "type" (for garment selection) and the
 * number of days until the event (for pacing the countdown).
 */

/** Occasion types we recognize; aligned with the garment catalog's `occasions`. */
export const OCCASION_TYPES = [
  "wedding",
  "interview",
  "gala",
  "party",
  "brunch",
  "date",
  "work",
] as const;

export type OccasionType = (typeof OCCASION_TYPES)[number];

/**
 * Synonyms per type, matched on WORD BOUNDARIES (so "networking" no longer
 * matches "work", "update" no longer matches "date"). Order of OCCASION_TYPES
 * is the tie-break priority when a phrase hits more than one type.
 */
const TYPE_ALIASES: Record<OccasionType, string[]> = {
  wedding: ["wedding", "reception", "engagement"],
  interview: ["interview"],
  gala: ["gala", "ball", "black tie", "black-tie", "red carpet", "premiere"],
  party: ["party", "birthday", "celebration", "anniversary", "reunion", "graduation", "cocktail", "prom"],
  brunch: ["brunch"],
  date: ["date", "dinner", "valentine"],
  work: ["work", "office", "meeting", "networking", "conference", "presentation", "photoshoot", "headshot", "photo shoot"],
};

const WEEKDAYS: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

export interface ParsedOccasion {
  type?: OccasionType;
  daysUntil?: number;
}

function wordRegex(alias: string): RegExp {
  // Escape regex metachars, allow the space/hyphen in multiword aliases to match either.
  const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/[\s-]+/g, "[\\s-]+");
  return new RegExp(`\\b${escaped}\\b`, "i");
}

export function parseOccasion(text: string, now: Date = new Date()): ParsedOccasion {
  const t = text.toLowerCase();

  let type: OccasionType | undefined;
  for (const candidate of OCCASION_TYPES) {
    if (TYPE_ALIASES[candidate].some((a) => wordRegex(a).test(t))) {
      type = candidate;
      break;
    }
  }

  const daysUntil = parseDays(t, now);
  return { type, daysUntil };
}

function parseDays(t: string, now: Date): number | undefined {
  const rel = t.match(/\bin\s+(\d+)\s+(day|week|month)s?\b/);
  if (rel) {
    const n = Number(rel[1]);
    const unit = rel[2];
    return n * (unit === "day" ? 1 : unit === "week" ? 7 : 30);
  }
  if (/\b(tonight|today)\b/.test(t)) return 0;
  if (/\btomorrow\b/.test(t)) return 1;
  if (/\bin\s+a\s+fortnight\b|\bin\s+two\s+weeks\b/.test(t)) return 14;
  if (/\bin\s+a\s+week\b|\bnext\s+week\b/.test(t)) return 7;
  if (/\bin\s+a\s+month\b|\bnext\s+month\b/.test(t)) return 30;
  if (/\bthis\s+weekend\b/.test(t)) return daysUntilWeekday(6, now, false);
  if (/\bnext\s+weekend\b/.test(t)) return daysUntilWeekday(6, now, false) + 7;
  for (const [name, dow] of Object.entries(WEEKDAYS)) {
    if (wordRegex(name).test(t)) return daysUntilWeekday(dow, now, true);
  }
  return undefined;
}

/**
 * Days from `now` to the next occurrence of weekday `target`.
 * `bumpSameDay` returns 7 when today IS the target ("on Monday" said on a
 * Monday → next Monday); weekend phrasing keeps 0 (this Saturday can be today).
 */
function daysUntilWeekday(target: number, now: Date, bumpSameDay: boolean): number {
  const diff = (target - now.getDay() + 7) % 7;
  return diff === 0 && bumpSameDay ? 7 : diff;
}
