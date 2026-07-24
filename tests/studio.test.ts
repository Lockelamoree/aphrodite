import { describe, expect, it } from "vitest";

import { hairPresetFor } from "@/lib/concierge/studio";
import { endpointsFor, youcamConfig } from "@/lib/youcam/config";

describe("studio hair-color preset flatters the undertone", () => {
  it("maps warm / cool / neutral to distinct presets", () => {
    expect(hairPresetFor("warm")).toBe("Copper Red");
    expect(hairPresetFor("Warm Spring")).toBe("Copper Red");
    expect(hairPresetFor("cool")).toBe("Ash Gray");
    expect(hairPresetFor("Cool Summer")).toBe("Ash Gray");
    expect(hairPresetFor(undefined)).toBe("Chocolate Brown");
    expect(hairPresetFor("neutral")).toBe("Chocolate Brown");
  });
});

describe("studio feature endpoints are registered", () => {
  it("has file endpoints for hair color, makeup, and hairstyle", () => {
    expect(youcamConfig.fileEndpoints.hairColor).toBe("/s2s/v2.0/file/hair-color");
    expect(youcamConfig.fileEndpoints.makeup).toContain("/file/");
    expect(youcamConfig.fileEndpoints.hairstyle).toContain("/file/");
  });

  it("derives the run-task endpoint by swapping /file/ → /task/", () => {
    const { file, task } = endpointsFor("hairColor");
    expect(file).toBe("/s2s/v2.0/file/hair-color");
    expect(task).toBe("/s2s/v2.0/task/hair-color");
  });
});
