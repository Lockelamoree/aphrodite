import { describe, expect, it } from "vitest";

import { sanitizeEvent } from "@/lib/concierge/sanitize";
import type { ConciergeEvent } from "@/lib/concierge/types";

describe("sanitizeEvent", () => {
  it("strips raw from a skin event", () => {
    const ev: ConciergeEvent = {
      type: "skin",
      analysis: { concerns: [{ name: "pore", score: 74 }], raw: { secret: "token" } },
    };
    const out = sanitizeEvent(ev);
    // raw must not survive serialization to the client.
    expect(JSON.parse(JSON.stringify(out))).not.toHaveProperty("analysis.raw");
    expect(JSON.stringify(out)).not.toContain("secret");
    if (out.type === "skin") expect(out.analysis.concerns).toHaveLength(1);
  });

  it("strips raw from a color event", () => {
    const ev: ConciergeEvent = {
      type: "color",
      profile: { undertone: "warm", paletteHex: ["#fff"], raw: { provider: "x" } },
    };
    const out = sanitizeEvent(ev);
    expect(JSON.stringify(out)).not.toContain("provider");
  });

  it("passes other events through unchanged", () => {
    const ev: ConciergeEvent = { type: "narration", text: "hi" };
    expect(sanitizeEvent(ev)).toEqual(ev);
  });
});
