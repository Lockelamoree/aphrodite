import { describe, expect, it } from "vitest";

import { parseConciergeRequest } from "@/lib/concierge/request-schema";

const IMG = "https://images.example.com/selfie.jpg";

describe("parseConciergeRequest", () => {
  it("accepts a valid request", () => {
    const r = parseConciergeRequest({
      occasion: "An evening wedding in 3 weeks",
      personImage: IMG,
      skinGoal: "glow",
      track: "style",
      garmentPreference: "dresses",
    });
    expect(r.ok).toBe(true);
    expect(r.data?.occasion).toBe("An evening wedding in 3 weeks");
  });

  it("accepts a small jpeg data URL", () => {
    const dataUrl = "data:image/jpeg;base64," + Buffer.from("hello-image").toString("base64");
    expect(parseConciergeRequest({ occasion: "a gala", personImage: dataUrl }).ok).toBe(true);
  });

  it("rejects a bad enum value", () => {
    const r = parseConciergeRequest({ occasion: "a gala", personImage: IMG, skinGoal: "nope" });
    expect(r.ok).toBe(false);
  });

  it("rejects an over-long occasion", () => {
    const r = parseConciergeRequest({ occasion: "x".repeat(400), personImage: IMG });
    expect(r.ok).toBe(false);
  });

  it("rejects a non-image personImage", () => {
    expect(parseConciergeRequest({ occasion: "a gala", personImage: "javascript:alert(1)" }).ok).toBe(false);
  });

  it("rejects a missing personImage", () => {
    expect(parseConciergeRequest({ occasion: "a gala" }).ok).toBe(false);
  });

  it("validates the refine sub-object", () => {
    const bad = parseConciergeRequest({
      occasion: "a gala",
      personImage: IMG,
      refine: { adjust: "sideways" },
    });
    expect(bad.ok).toBe(false);
    const good = parseConciergeRequest({
      occasion: "a gala",
      personImage: IMG,
      refine: { adjust: "cooler", currentGarmentId: "scarlet-gown" },
    });
    expect(good.ok).toBe(true);
  });
});
