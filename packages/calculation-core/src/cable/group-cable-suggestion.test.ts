import { afterEach, describe, expect, it, vi } from "vitest";

import type { CableRulerSelection } from "./ruler.js";
import * as ruler from "./ruler.js";
import { suggestGroupCableSections } from "./group-cable-suggestion.js";

describe("suggestGroupCableSections", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns entries for both ambients", () => {
    const result = suggestGroupCableSections({ groupTotalCurrentA: 30 });

    expect(result.toprak_20C?.sectionMm2).toBeGreaterThan(0);
    expect(result.hava_30C?.sectionMm2).toBeGreaterThan(0);
    expect(result.toprak_20C?.ampacityA).toBeGreaterThanOrEqual(30);
    expect(result.hava_30C?.ampacityA).toBeGreaterThanOrEqual(30);
  });

  it("includes standardHintMm2 = 2.5 when currentA < 25 and rulerSection <= 4", () => {
    const result = suggestGroupCableSections({ groupTotalCurrentA: 10 });

    expect(result.hava_30C?.standardHintMm2).toBe(2.5);
    expect(result.toprak_20C?.standardHintMm2).toBe(2.5);
  });

  it("includes standardHintMm2 = 4 when currentA >= 25 and rulerSection <= 4", () => {
    const result = suggestGroupCableSections({ groupTotalCurrentA: 28 });

    for (const ambient of ["toprak_20C", "hava_30C"] as const) {
      if ((result[ambient]?.sectionMm2 ?? 0) <= 4) {
        expect(result[ambient]?.standardHintMm2).toBe(4);
      }
    }
  });

  it("omits standardHintMm2 when ruler section > 4", () => {
    const result = suggestGroupCableSections({ groupTotalCurrentA: 120 });

    expect(result.hava_30C?.sectionMm2).toBeGreaterThan(4);
    expect(result.hava_30C?.standardHintMm2).toBeUndefined();
  });

  it("returns null ambients when currentA is 0", () => {
    const result = suggestGroupCableSections({ groupTotalCurrentA: 0 });

    expect(result.toprak_20C).toBeNull();
    expect(result.hava_30C).toBeNull();
  });

  it("still returns the other ambient when one ruler lookup fails", () => {
    vi.spyOn(ruler, "selectCableSectionFromRuler").mockImplementation(({ ambient }) => {
      if (ambient === "toprak_20C") {
        throw new RangeError("toprak unavailable");
      }

      return {
        selected: {
          nominal_kesit_mm2: "2,5",
          sectionMm2: 2.5,
        },
        selectedAmpacityA: 24,
        dataVersion: "test-data",
      } as CableRulerSelection;
    });

    const result = suggestGroupCableSections({ groupTotalCurrentA: 20 });

    expect(result.toprak_20C).toBeNull();
    expect(result.hava_30C).toMatchObject({
      sectionMm2: 2.5,
      ambient: "hava_30C",
      ampacityA: 24,
    });
  });
});
