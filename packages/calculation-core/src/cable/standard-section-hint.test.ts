import { describe, expect, it } from "vitest";

import { buildStandardSectionHint } from "./standard-section-hint.js";

describe("buildStandardSectionHint", () => {
  it("returns a 2.5 mm2 hint when the standardized section differs from the ruler pick", () => {
    expect(buildStandardSectionHint({ currentA: 24.9, rulerSectionMm2: 1.5 })).toEqual({
      standardHintMm2: 2.5,
    });
  });

  it("returns a 4 mm2 hint when the standardized section differs from the ruler pick", () => {
    expect(buildStandardSectionHint({ currentA: 25, rulerSectionMm2: 2.5 })).toEqual({
      standardHintMm2: 4,
    });
    expect(buildStandardSectionHint({ currentA: 60, rulerSectionMm2: 1.5 })).toEqual({
      standardHintMm2: 4,
    });
  });

  it("returns null when the ruler section already matches the standardized hint", () => {
    expect(buildStandardSectionHint({ currentA: 24.9, rulerSectionMm2: 2.5 })).toBeNull();
    expect(buildStandardSectionHint({ currentA: 25, rulerSectionMm2: 4 })).toBeNull();
  });

  it("returns null when ruler section > 4", () => {
    expect(buildStandardSectionHint({ currentA: 80, rulerSectionMm2: 6 })).toBeNull();
    expect(buildStandardSectionHint({ currentA: 300, rulerSectionMm2: 95 })).toBeNull();
  });

  it("returns null when inputs are not finite positive", () => {
    expect(buildStandardSectionHint({ currentA: 0, rulerSectionMm2: 2.5 })).toBeNull();
    expect(buildStandardSectionHint({ currentA: Number.NaN, rulerSectionMm2: 2.5 })).toBeNull();
  });
});
