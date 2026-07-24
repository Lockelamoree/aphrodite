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
