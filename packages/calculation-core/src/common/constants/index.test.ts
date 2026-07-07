import { describe, expect, it } from "vitest";

import { HP_TO_KW, X_AC_FALLBACK_OHM_PER_KM } from "./index.js";

describe("calculation-core bootstrap", () => {
  it("exposes locked common constants", () => {
    expect(HP_TO_KW).toBe(0.7457);
    expect(X_AC_FALLBACK_OHM_PER_KM).toBe(0.08);
  });
});
