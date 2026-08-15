import { describe, expect, it } from "vitest";

import { parseOccasion } from "@/lib/concierge/occasion";

const NOW = new Date("2026-07-24T12:00:00Z"); // a Friday

describe("parseOccasion", () => {
  it("detects the occasion type and a horizon", () => {
    const r = parseOccasion("An evening wedding in 3 weeks", NOW);
    expect(r.type).toBe("wedding");
    expect(r.daysUntil).toBeGreaterThanOrEqual(18);
    expect(r.daysUntil).toBeLessThanOrEqual(23);
  });

  it("maps interview / gala / date / brunch", () => {
    expect(parseOccasion("a job interview on Monday", NOW).type).toBe("interview");
    expect(parseOccasion("a black-tie gala next month", NOW).type).toBe("gala");
    expect(parseOccasion("a first date on Friday", NOW).type).toBe("date");
    expect(parseOccasion("sunday brunch", NOW).type).toBe("brunch");
  });

  it("maps 'networking' to work (explicit alias) but respects word boundaries", () => {
    expect(parseOccasion("a networking mixer", NOW).type).toBe("work");
    // 'workshop' contains 'work' but must NOT match \bwork\b.
    expect(parseOccasion("a pottery workshop", NOW).type).not.toBe("work");
  });

  it("returns an undefined horizon when no date is expressed", () => {
    const r = parseOccasion("a wedding", NOW);
    expect(r.type).toBe("wedding");
    expect(r.daysUntil).toBeUndefined();
  });
});

/**
 * Calendar dates — the flaw review 003 named, and the one two judges called fatal.
 *
 * The pitch is "tell it the event and the date". Before 2026-08-15 the parser knew
 * relative phrases only, so a stated date produced a default three-week countdown and
 * a prompt asking for the date that had just been given.
 */
describe("parseOccasion — calendar dates", () => {
  const NOW_2 = new Date(2026, 7, 15, 12, 0, 0); // 15 Aug 2026, local

  it("reads an ISO date", () => {
    expect(parseOccasion("vow renewal on the beach, 2026-08-16", NOW_2).daysUntil).toBe(1);
    expect(parseOccasion("wedding 2026/09/04", NOW_2).daysUntil).toBe(20);
  });

  it("reads a named month, either order, with or without a year", () => {
    expect(parseOccasion("a gala on 20 August", NOW_2).daysUntil).toBe(5);
    expect(parseOccasion("interview on August 20th", NOW_2).daysUntil).toBe(5);
    expect(parseOccasion("a wedding on the 4th of September 2026", NOW_2).daysUntil).toBe(20);
    expect(parseOccasion("date on Aug 16, 2026", NOW_2).daysUntil).toBe(1);
  });

  it("rolls a bare day/month forward to the next occurrence rather than backwards", () => {
    // 1 August is in the past on 15 August, so it means next year — not -14 days.
    expect(parseOccasion("a wedding on 1 August", NOW_2).daysUntil).toBe(351);
  });

  it("returns undefined for a date in the past when the year is explicit", () => {
    expect(parseOccasion("a wedding on 2026-08-01", NOW_2).daysUntil).toBeUndefined();
  });

  it("refuses a date that does not exist instead of rolling into the next month", () => {
    expect(parseOccasion("gala on 2026-02-31", NOW_2).daysUntil).toBeUndefined();
  });

  it("reads day-first numeric only when the first number cannot be a month", () => {
    expect(parseOccasion("wedding 16/08", NOW_2).daysUntil).toBe(1);
    // Genuinely ambiguous (08/09) — left to the unambiguous forms, not guessed.
    expect(parseOccasion("wedding 08/09", NOW_2).daysUntil).toBeUndefined();
  });

  it("still honours relative phrasing, and a stated date wins over it", () => {
    expect(parseOccasion("An evening wedding in 3 weeks", NOW_2).daysUntil).toBe(21);
    expect(parseOccasion("wedding in 3 weeks, on 2026-08-16", NOW_2).daysUntil).toBe(1);
  });
});
