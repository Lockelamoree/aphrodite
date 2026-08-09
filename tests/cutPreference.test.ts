import { describe, expect, it } from "vitest";

import { GARMENT_CATALOG, garmentMatchesCut, findGarment } from "@/lib/concierge/catalog";
import { pickGarment, refineLead } from "@/lib/concierge/deterministic";

/**
 * Regression guard for the mis-gender class of bug.
 *
 * History: review cycles 3–5 recorded this cluster as closed, but the fix was
 * gated on `track === "grooming"`. On the DEFAULT styling track no cut filter ran
 * at all, and cycle 3's unconditional "lean away from suits" tie-breaker pushed
 * the other way — so the bundled masculine "Wedding · full-body" sample was
 * rendered in the Scarlet A-Line Gown, with statement earrings and heels in the
 * basket. That is the first thing a judge clicks.
 */
describe("garmentMatchesCut", () => {
  it("passes everything when the shopper hasn't stated a preference", () => {
    expect(GARMENT_CATALOG.every((g) => garmentMatchesCut(g, "any"))).toBe(true);
    expect(GARMENT_CATALOG.every((g) => garmentMatchesCut(g))).toBe(true);
  });

  it("lets neutral cuts through on both sides — that is what makes them neutral", () => {
    const tee = findGarment("crisp-white-tee")!;
    expect(tee.cut).toBe("neutral");
    expect(garmentMatchesCut(tee, "masculine")).toBe(true);
    expect(garmentMatchesCut(tee, "feminine")).toBe(true);
  });

  it("rejects the opposite cut", () => {
    expect(garmentMatchesCut(findGarment("scarlet-gown")!, "masculine")).toBe(false);
    expect(garmentMatchesCut(findGarment("slate-suit")!, "feminine")).toBe(false);
  });
});

describe("pickGarment honours the cut preference on the DEFAULT styling track", () => {
  // The exact configuration of the bundled "Wedding · full-body" sample: a
  // masculine-presenting person, warm undertone, formal occasion, no wardrobe
  // preference. This is the case that shipped broken.
  const SAMPLE = { preference: "surprise" as const, track: "style" as const };

  it("never returns a feminine cut for a masculine-cut shopper", () => {
    const g = pickGarment("wedding", "warm", { ...SAMPLE, cut: "masculine" });
    expect(g).toBeDefined();
    expect(g!.cut).not.toBe("feminine");
  });

  it("specifically does not put the masculine wedding sample in the Scarlet Gown", () => {
    const g = pickGarment("wedding", "warm", { ...SAMPLE, cut: "masculine" });
    expect(g!.id).not.toBe("scarlet-gown");
  });

  it("holds across every occasion and undertone, not just the wedding sample", () => {
    for (const occ of ["wedding", "interview", "date", "gala", "party"] as const) {
      for (const tone of ["warm", "cool", undefined]) {
        const g = pickGarment(occ, tone, { ...SAMPLE, cut: "masculine" });
        expect(g, `${occ}/${tone}`).toBeDefined();
        expect(g!.cut, `${occ}/${tone} picked ${g!.id}`).not.toBe("feminine");
      }
    }
  });

  it("still honours a feminine preference", () => {
    const g = pickGarment("wedding", "warm", { ...SAMPLE, cut: "feminine" });
    expect(g!.cut).not.toBe("masculine");
  });

  it("keeps the grooming track masculine even with no cut stated", () => {
    const g = pickGarment("wedding", undefined, { preference: "surprise", track: "grooming" });
    expect(g!.cut).toBe("masculine");
  });

  it("does not let a wardrobe preference override the stated cut", () => {
    // "Dresses" plus masculine cuts is contradictory. The cut wins, because
    // wearing the wrong presentation is the worse failure.
    const g = pickGarment("wedding", "warm", {
      preference: "dresses",
      track: "style",
      cut: "masculine",
    });
    expect(g!.cut).not.toBe("feminine");
  });
});

describe("the tie-breaker no longer guesses presentation", () => {
  it("only leans away from suits when the shopper asked for feminine cuts", () => {
    // Cycle 3's lean was unconditional. If it were still unconditional, a
    // masculine shopper whose undertone matches nothing would be pushed off the
    // suit purely by the lean. With the lean gated on "feminine", a masculine
    // shopper with no undertone read lands on the menswear suit.
    const g = pickGarment("wedding", undefined, {
      preference: "surprise",
      track: "style",
      cut: "masculine",
    });
    expect(g!.wardrobe).toBe("suits");
  });
});

describe("the catalog gap this fix exposes", () => {
  // 9 feminine : 1 masculine : 1 neutral, of 11 garments.
  // Documented as a test so it cannot be forgotten: the filter can only pick
  // from what exists, and what exists is lopsided. This test asserts the CURRENT
  // shape so that widening the catalog trips it and forces the numbers in
  // HACKATHON.md to be updated with it.
  it("records that the wardrobe is overwhelmingly feminine", () => {
    const byCut = GARMENT_CATALOG.reduce<Record<string, number>>((acc, g) => {
      acc[g.cut] = (acc[g.cut] ?? 0) + 1;
      return acc;
    }, {});
    expect(byCut).toEqual({ feminine: 9, masculine: 1, neutral: 1 });
  });

  it("has no masculine option below formal, so a casual masculine look falls back to neutral", () => {
    const masc = GARMENT_CATALOG.filter((g) => g.cut === "masculine");
    expect(masc).toHaveLength(1);
    expect(masc[0].formality).toBe("formal");
  });
});

describe("refineLead — a tone refine may not claim a shift it did not make", () => {
  // Panel finding, 2026-08-09: pressing "Cooler" narrated "Shifting to cooler
  // tones" unconditionally, including when the wardrobe had nothing cooler and the
  // replacement was warm. The claim was made before the result was checked.
  it("claims the shift only when the garment really flatters the requested tone", () => {
    expect(refineLead("cooler", findGarment("sky-wrap-maxi"))).toMatch(/cooler tones/i);
    expect(refineLead("warmer", findGarment("scarlet-gown"))).toMatch(/warmer tones/i);
  });

  it("allows a neutral garment to satisfy either direction", () => {
    const neutral = findGarment("champagne-slip")!;
    expect(neutral.flatters).toBe("neutral");
    expect(refineLead("cooler", neutral)).toMatch(/cooler tones/i);
  });

  it("says so honestly when the wardrobe cannot honour the direction", () => {
    // A warm garment cannot be the result of a successful "cooler" shift.
    const said = refineLead("cooler", findGarment("scarlet-gown"));
    expect(said).not.toMatch(/shifting to cooler/i);
    expect(said).toMatch(/don't have anything cooler/i);
  });

  it("says so honestly when no garment came back at all", () => {
    expect(refineLead("warmer", undefined)).toMatch(/don't have anything warmer/i);
  });

  it("leaves the non-tone leads untouched", () => {
    expect(refineLead("less_formal", findGarment("scarlet-gown"))).toMatch(/dialing it back/i);
    expect(refineLead("more_formal", undefined)).toMatch(/taking it up/i);
    expect(refineLead("reroll", undefined)).toMatch(/different direction/i);
  });
});
