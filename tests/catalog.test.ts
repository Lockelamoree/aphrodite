import { describe, expect, it } from "vitest";

import {
  completeTheLook,
  findGarment,
  GARMENT_CATALOG,
  garmentMatchesPreference,
} from "@/lib/concierge/catalog";

describe("catalog invariants", () => {
  it("has unique garment ids", () => {
    const ids = GARMENT_CATALOG.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("covers every wardrobe type", () => {
    const wardrobes = new Set(GARMENT_CATALOG.map((g) => g.wardrobe));
    expect(wardrobes).toEqual(new Set(["dresses", "suits", "separates"]));
  });

  it("interview has a non-suit (dress/separates) option — no one is forced into a men's suit", () => {
    const interview = GARMENT_CATALOG.filter((g) => g.occasions.includes("interview"));
    expect(interview.length).toBeGreaterThan(1);
    expect(interview.some((g) => g.wardrobe !== "suits")).toBe(true);
  });

  it("a wedding has a cool-flattering option and a warm one", () => {
    const wedding = GARMENT_CATALOG.filter((g) => g.occasions.includes("wedding"));
    expect(wedding.some((g) => g.flatters === "cool")).toBe(true);
    expect(wedding.some((g) => g.flatters === "warm")).toBe(true);
  });
});

describe("garmentMatchesPreference", () => {
  const dress = findGarment("scarlet-gown")!;
  it('"surprise" matches everything', () => {
    expect(GARMENT_CATALOG.every((g) => garmentMatchesPreference(g, "surprise"))).toBe(true);
  });
  it("filters by wardrobe otherwise", () => {
    expect(garmentMatchesPreference(dress, "dresses")).toBe(true);
    expect(garmentMatchesPreference(dress, "suits")).toBe(false);
  });
});

describe("completeTheLook is wardrobe-coherent (no menswear on a dress)", () => {
  const dress = findGarment("scarlet-gown")!;
  const suit = findGarment("slate-suit")!;

  it("a dress gets jewellery + makeup, never watch/loafers", () => {
    const cats = completeTheLook(dress, "style").map((a) => a.category);
    expect(cats).toContain("Occasion Makeup Edit");
    expect(cats.some((c) => /earrings|heels/i.test(c))).toBe(true);
    expect(cats.some((c) => /watch|loafers/i.test(c))).toBe(false);
  });

  it("a suit gets gender-neutral tailoring, never earrings/heels", () => {
    const cats = completeTheLook(suit, "style").map((a) => a.category);
    expect(cats.some((c) => /watch/i.test(c))).toBe(true);
    expect(cats.some((c) => /earrings|heels/i.test(c))).toBe(false);
  });

  it("the grooming track swaps to a grooming kit + watch", () => {
    const cats = completeTheLook(dress, "grooming").map((a) => a.category);
    expect(cats.some((c) => /grooming kit/i.test(c))).toBe(true);
    expect(cats.some((c) => /makeup|earrings/i.test(c))).toBe(false);
  });
});
