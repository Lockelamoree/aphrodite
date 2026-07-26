import { describe, expect, it } from "vitest";

import { pickGarment } from "@/lib/concierge/deterministic";

describe("pickGarment — never mis-genders on the default path", () => {
  it("a cool woman at a wedding on 'Surprise me' gets a dress, not the men's suit", () => {
    const g = pickGarment("wedding", "cool", { preference: "surprise" });
    expect(g?.wardrobe).toBe("dresses");
    expect(g?.id).not.toBe("slate-suit");
  });

  it("a cool woman at a gala on 'Surprise me' gets a dress", () => {
    expect(pickGarment("gala", "cool", { preference: "surprise" })?.wardrobe).toBe("dresses");
  });

  it("a cool woman at an interview on 'Surprise me' is never put in the men's suit", () => {
    const g = pickGarment("interview", "cool", { preference: "surprise" });
    expect(g?.wardrobe).not.toBe("suits");
    expect(g?.cut).not.toBe("masculine");
    expect(g?.id).not.toBe("slate-suit");
    // The interview pool has no cool dress, so the honest match is the cool
    // feminine-cut separates set (navy-blazer-set), not menswear.
    expect(["dresses", "separates"]).toContain(g?.wardrobe);
  });

  it("interview with no undertone read on 'Surprise me' still avoids the men's suit", () => {
    // Color analysis can be skipped/fail; the default must not fall back to slate-suit.
    const g = pickGarment("interview", undefined, { preference: "surprise" });
    expect(g?.wardrobe).not.toBe("suits");
  });

  it("a warm woman at a wedding still gets the warm gown", () => {
    expect(pickGarment("wedding", "warm", { preference: "surprise" })?.id).toBe("scarlet-gown");
  });

  it("the grooming path (no undertone, suits) resolves to the masculine suit, not the women's pantsuit", () => {
    const g = pickGarment("interview", undefined, { preference: "suits" });
    expect(g?.id).toBe("slate-suit");
    expect(g?.id).not.toBe("ivory-pantsuit");
  });

  it("respects an explicit preference", () => {
    expect(pickGarment("wedding", "warm", { preference: "suits" })?.wardrobe).toBe("suits");
    expect(pickGarment("interview", "cool", { preference: "dresses" })?.wardrobe).toBe("dresses");
  });

  it("a tone refine keeps the garment kind (a gown stays a dress on 'cooler')", () => {
    const g = pickGarment("wedding", "cool", { adjust: "cooler", keepWardrobe: "dresses" });
    expect(g?.wardrobe).toBe("dresses");
  });

  it("occasion formality still dominates — a casual date never gets a formal gown by default", () => {
    const g = pickGarment("date", "warm", { preference: "surprise" });
    expect(g?.formality).not.toBe("formal");
  });
});
