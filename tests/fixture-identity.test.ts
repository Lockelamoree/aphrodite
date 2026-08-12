import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { fixtureApparel, fixtureLighting } from "@/lib/youcam/fixtures";
import type { ImageInput } from "@/lib/youcam/types";

/**
 * A render is a claim about whose face is in it.
 *
 * Three of the four render fixtures used to depict three different people, keyed
 * only by garment kind, and served to whoever asked under "Your outfit" and "Your
 * finished look". Review 001 raised this as a P0 for uploads; the 2026-08-10 pass
 * closed it for the skin mask and left it open for the try-on and the relight.
 *
 * These tests pin the rule that closes it: a captured render is served only for
 * the person AND garment it was actually captured for, and every other case
 * refuses so the UI can show its honest empty state. If someone reintroduces a
 * fallback render, this file fails.
 */
function bytesOf(path: string): ImageInput {
  return { kind: "bytes", data: new Uint8Array(readFileSync(path)), contentType: "image/jpeg" };
}

const SAMPLE_A = bytesOf("public/samples/full-body.jpg");
const SAMPLE_SELFIE = bytesOf("public/samples/selfie.jpg");
const SAMPLE_B = bytesOf("public/samples/selfie-2.jpg");
/** A photo the fixtures have never seen — a judge uploading their own. */
const STRANGER: ImageInput = { kind: "bytes", data: new Uint8Array([1, 2, 3, 4, 5]), contentType: "image/jpeg" };

describe("captured try-on renders are keyed to the person and the garment", () => {
  it("serves the one captured pair: the wedding sample in the Slate Blue suit", async () => {
    const img = await fixtureApparel({ person: SAMPLE_A, garmentId: "slate-suit", renderHint: "suits" });
    expect(img.url).toBe("/fixtures/apparel-suit.jpg");
    expect((img.raw as { captured?: string }).captured).toMatch(/full-body\.jpg/);
  });

  it("refuses when the person matches but the garment does not", async () => {
    await expect(
      fixtureApparel({ person: SAMPLE_A, garmentId: "scarlet-gown", renderHint: "dresses" }),
    ).rejects.toThrow(/no captured try-on render/);
  });

  it("refuses for a photo it has never seen, whatever the garment", async () => {
    for (const garmentId of ["slate-suit", "scarlet-gown", "navy-blazer-set"]) {
      await expect(fixtureApparel({ person: STRANGER, garmentId })).rejects.toThrow(
        /no captured try-on render/,
      );
    }
  });

  it("refuses when no person is supplied at all — the old signature's blind spot", async () => {
    await expect(fixtureApparel({ garmentId: "slate-suit", renderHint: "suits" })).rejects.toThrow(
      /no captured try-on render/,
    );
  });

  it("never serves one sample's render to another sample", async () => {
    await expect(fixtureApparel({ person: SAMPLE_B, garmentId: "slate-suit" })).rejects.toThrow();
    await expect(fixtureApparel({ person: SAMPLE_SELFIE, garmentId: "slate-suit" })).rejects.toThrow();
    await expect(fixtureApparel({ person: SAMPLE_A, garmentId: "sky-wrap-maxi" })).rejects.toThrow();
  });

  it("serves the second face its own captured render — the tiebreaker pair", async () => {
    const img = await fixtureApparel({ person: SAMPLE_B, garmentId: "sky-wrap-maxi" });
    expect(img.url).toBe("/fixtures/apparel-sky-maxi.jpg");
    expect((img.raw as { captured?: string }).captured).toMatch(/selfie-2\.jpg/);
  });

  it("two faces yield two different garment renders", async () => {
    const a = await fixtureApparel({ person: SAMPLE_A, garmentId: "slate-suit" });
    const b = await fixtureApparel({ person: SAMPLE_B, garmentId: "sky-wrap-maxi" });
    expect(a.url).not.toBe(b.url);
  });
});

describe("captured relights are keyed to the person", () => {
  it("serves the real relight to the face it was captured from", async () => {
    const img = await fixtureLighting(SAMPLE_SELFIE);
    expect(img.url).toBe("/fixtures/finish-selfie.jpg");
    expect((img.raw as { captured?: string }).captured).toMatch(/selfie\.jpg/);
  });

  it("serves the flagship sample its own relight, captured 2026-08-12", async () => {
    const img = await fixtureLighting(SAMPLE_A);
    expect(img.url).toBe("/fixtures/finish-wedding.jpg");
    expect((img.raw as { captured?: string }).captured).toMatch(/full-body\.jpg/);
  });

  it("refuses for every face without one", async () => {
    await expect(fixtureLighting(SAMPLE_B)).rejects.toThrow(/no captured relight/);
    await expect(fixtureLighting(STRANGER)).rejects.toThrow(/no captured relight/);
    await expect(fixtureLighting(undefined)).rejects.toThrow(/no captured relight/);
  });
});

describe("the fixture assets on disk match what the tables claim", () => {
  /**
   * The tables name files; a deleted or renamed file would turn a refusal into a
   * broken image. And the three deleted stranger renders must stay deleted.
   */
  it("every referenced fixture exists", () => {
    for (const f of [
      "public/fixtures/apparel-suit.jpg",
      "public/fixtures/finish-selfie.jpg",
      "public/fixtures/finish-wedding.jpg",
      "public/fixtures/apparel-sky-maxi.jpg",
    ]) {
      expect(() => readFileSync(f)).not.toThrow();
    }
  });

  it("the renders of other people are gone and stay gone", () => {
    for (const f of [
      "public/fixtures/apparel-gown.jpg",
      "public/fixtures/apparel-top.jpg",
      "public/fixtures/finish.jpg",
      "public/fixtures/skin-overlay.jpg",
    ]) {
      expect(() => readFileSync(f), `${f} is back — it depicts someone who is not the visitor`).toThrow();
    }
  });

  it.each([
    ["public/fixtures/finish-selfie.jpg", "hackathon/receipts/001/photo_lighting.render.jpg"],
    ["public/fixtures/finish-wedding.jpg", "hackathon/receipts/002/photo_lighting.render.jpg"],
    ["public/fixtures/apparel-sky-maxi.jpg", "hackathon/receipts/003/apparel_vto.render.jpg"],
  ])("%s is byte-identical to the receipt it came from", (fixture, receipt) => {
    expect(Buffer.compare(readFileSync(fixture), readFileSync(receipt))).toBe(0);
  });
});
