import { describe, expect, it } from "vitest";

import { selectCableSectionFromRuler } from "./ruler.js";

describe("selectCableSectionFromRuler", () => {
  it("returns the smallest section where akim_hava_30C_A >= 20 A", () => {
    const result = selectCableSectionFromRuler({
      designCurrentA: 20,
      ambient: "hava_30C",
    });

    expect(result.selected.nominal_kesit_mm2).toBe("1*");
    expect(result.selected.sectionMm2).toBe(1);
    expect(result.selectedAmpacityA).toBe(20);
  });

  it("picks 1,5 mm2 for 24 A in hava", () => {
    const result = selectCableSectionFromRuler({
      designCurrentA: 24,
      ambient: "hava_30C",
    });

    expect(result.selected.sectionMm2).toBe(1.5);
  });

  it("picks the next valid step for 21 A in hava", () => {
    const result = selectCableSectionFromRuler({
      designCurrentA: 21,
      ambient: "hava_30C",
    });

    expect(result.selected.sectionMm2).toBe(1.5);
    expect(result.selectedAmpacityA).toBe(24);
  });

  it("skips rows with null toprak ampacity and picks the first numeric hit", () => {
    const result = selectCableSectionFromRuler({
      designCurrentA: 10,
      ambient: "toprak_20C",
    });

    expect(result.selected.sectionMm2).toBe(1);
    expect(result.selectedAmpacityA).toBe(11);
  });

  it("throws when no row satisfies the current", () => {
    expect(() =>
      selectCableSectionFromRuler({
        designCurrentA: 500,
        ambient: "toprak_20C",
      }),
    ).toThrow(/no cable ruler row/i);
  });

  it("rejects non-positive current", () => {
    expect(() =>
      selectCableSectionFromRuler({
        designCurrentA: 0,
        ambient: "hava_30C",
      }),
    ).toThrow(/positive/i);
  });
});
