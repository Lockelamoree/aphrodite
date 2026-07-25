import { describe, expect, it } from "vitest";

import {
  completeTheLook,
  findGarment,
  GARMENT_CATALOG,
  garmentMatchesPreference,
  garmentSuitsTrack,
} from "@/lib/concierge/catalog";
import { pickGarment } from "@/lib/concierge/deterministic";
import { OCCASION_TYPES } from "@/lib/concierge/occasion";

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

describe("garmentSuitsTrack (grooming is masculine-presenting)", () => {
  it("grooming excludes feminine cuts, keeps masculine/neutral", () => {
    expect(garmentSuitsTrack(findGarment("slate-suit")!, "grooming")).toBe(true);
    expect(garmentSuitsTrack(findGarment("ivory-pantsuit")!, "grooming")).toBe(false);
    expect(garmentSuitsTrack(findGarment("crisp-white-tee")!, "grooming")).toBe(true);
  });

  it("the default style track accepts every garment", () => {
    expect(GARMENT_CATALOG.every((g) => garmentSuitsTrack(g, "style"))).toBe(true);
  });

  it("the suits wardrobe has a masculine-cut, menswear-sized option", () => {
    const menswear = GARMENT_CATALOG.filter((g) => g.wardrobe === "suits" && g.cut === "masculine");
    expect(menswear.length).toBeGreaterThan(0);
    // Menswear suits use numeric jacket sizing (36–44), not XS–XL or women's 0–12.
    expect(menswear.every((g) => g.sizes.some((s) => /^(3[6-9]|4[0-9])$/.test(s)))).toBe(true);
  });
});

describe("grooming track selects a menswear suit, never a women's pantsuit", () => {
  it("grooming + interview picks the menswear-sized slate suit (not the ivory pantsuit)", () => {
    // Grooming skips color analysis, so undertone is undefined — the exact path
    // where the +0.5 neutral-undertone bonus used to float the women's pantsuit.
    const g = pickGarment("interview", undefined, { track: "grooming" });
    expect(g?.id).toBe("slate-suit");
    expect(g?.wardrobe).toBe("suits");
    expect(g?.cut).toBe("masculine");
    expect(g?.sizes).toContain("40"); // menswear numeric sizing, not 0–12
    expect(g?.id).not.toBe("ivory-pantsuit");
  });

  it("grooming never returns a feminine-cut garment for any occasion", () => {
    for (const occ of [...OCCASION_TYPES, undefined]) {
      const g = pickGarment(occ, undefined, { track: "grooming" });
      expect(g, `occasion ${occ}`).toBeDefined();
      expect(g!.cut, `occasion ${occ}`).not.toBe("feminine");
    }
  });

  it("grooming overrides a conflicting wardrobe preference (still a menswear suit)", () => {
    // Even if the shopper's stored preference says "dresses", grooming wins.
    const g = pickGarment("wedding", undefined, { track: "grooming", preference: "dresses" });
    expect(g?.cut).toBe("masculine");
    expect(g?.wardrobe).toBe("suits");
  });
});
