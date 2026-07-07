# ElektroPlan — MASTER EXECUTABLE PLAN (v2)

> Compact, implementation-oriented plan for an AI coding agent. Domain rules marked `[LOCKED]` must be preserved verbatim. **Greenfield project — no legacy code migration.**

---

## 0. PROJECT FRAME

- **Greenfield rewrite.** No code, data, or behavior carried over from any prior Python project. Legacy is not a reference, not a parity target, not a fixture source.
- Source authority for domain logic: this document (§2).
- Correctness reference: hand-computed worked examples + IEC 60364-5-52 standard examples (§7).

---

## 1. PURPOSE

- Build ElektroPlan as an Electron + Node + TypeScript desktop app.
- Single-source-of-truth calculation engine for motor current, cable sizing, voltage drop, protection.
- Hard 4-layer separation; data-driven rulesets; versioned and freezable engine.
- Deterministic, testable, table-driven core; zero formula duplication across UI/export/services.

---

## 2. LOCKED DOMAIN LOGIC

### 2.1 Physical constants `[LOCKED]` (single source: `calculation-core/common/constants/index.ts`)

```
RHO_COPPER_20   = 0.01724   // Ω·mm²/m
RHO_ALUMINUM_20 = 0.02826   // Ω·mm²/m
ALPHA_COPPER_20 = 0.00393   // 1/°C
ALPHA_ALUMINUM_20 = 0.00403 // 1/°C
SQRT3             = Math.sqrt(3)
X_AC_FALLBACK_OHM_PER_KM = 0.08
J_REF_COPPER     = 4        // A/mm² (preliminary only)
J_REF_ALUMINUM   = 2.5      // A/mm² (preliminary only)
HP_TO_KW         = 0.7457   // FROZEN
```

### 2.2 Motor current formulas `[LOCKED]`

```
Single-phase AC:      I = (1000·P_out) / (V · η · cosφ)
Three-phase AC (LL):  I = (1000·P_out) / (√3 · V_LL · η · cosφ)
Three-phase AC (LN):  I = (1000·P_out) / (3 · V_LN · η · cosφ)

P_in   = P_out / η
S_kVA  = P_in / cosφ
```

Invariants:
- `P_out` is shaft/output power.
- η and cosφ are **mandatory user inputs** (no silent defaults; see §2.7).
- LL and LN are distinct code paths; NEVER mixed in one formula.
- `formulaVariant ∈ {'single-phase','three-phase-LL','three-phase-LN'}`.

### 2.3 Voltage drop formulas `[LOCKED]`

```
ΔV (1ph AC, two-cond): 2 · I · (L/1000) · (R·cosφ + X·sinφ)
ΔV (DC, two-cond):     2 · I · (L/1000) · R
ΔV (3ph AC, LL):       √3 · I · (L/1000) · (R·cosφ + X·sinφ)
ΔV (3ph AC, LN):       1 · I · (L/1000) · (R·cosφ + X·sinφ)

R20 = ρ · 1000 / S
Rθ  = R20 · [1 + α · (θ − 20)]
sinφ = sqrt( max(0, 1 − cos²φ) )         // guard mandatory

ΔV_LN = ΔV_LL / √3                        // invariant, property-tested
deltaVPercent = 100 · deltaVVolts / baseVoltageV
```

Rules:
- Four separate formula functions; no branching trickery.
- `simplified` mode ⇒ X term = 0.
- `exact-ac` mode ⇒ X from input, else `X_AC_FALLBACK_OHM_PER_KM`; fallback MUST be recorded as assumption.
- Parallel conductors divide R and X: `R_eff = R / parallelConductors`.
- Temperature correction applied only when `conductorTempC` provided.

### 2.4 Cable sizing `[LOCKED]` — 11-step algorithm

```
Iz' = Iz · kT · kG · kH
Ib  ≤ Iz'
Iz_req = Ib / kTotal                      // kTotal = kT·kG·kH·…
S_prelim = Ib / (J_ref · kT · kG · …)     // PRELIMINARY HINT ONLY, never final
```

Algorithm (ascending candidate scan):
```
1. Validate inputs
2. Determine number of loaded conductors from phase + installation
3. Look up kT, kG, kH from calculation-data (NOT hardcoded)
4. kTotal = kT · kG · kH · (extras)
5. Iz_req = Ib / kTotal
6. Fetch ascending candidate cross-sections from ruleset
7. For each S ascending:
     a. thermalPass := Iz(S) ≥ Iz_req
     b. vdResult   := calculateVoltageDrop(S, …)
     c. vdPass     := vdResult.deltaVPercent ≤ limit
     d. if thermalPass && vdPass ⇒ accept, stop
     e. append to candidateTrace
8. Return {selectedSection, Iz, kT, kG, kH, kTotal, Iz', vdResult, candidateTrace}
```

Rules:
- `S = I/J` NEVER returned as final selection. Preliminary-only, typed distinctly.
- Installation method codes: **frozen set `{A1, A2, B1, B2, C, D, E}`** (IEC 60364-5-52). No other codes accepted.
- VD limit comes from `VoltageDropLimitProfile` data, not constant.

### 2.5 Result DTO `[LOCKED]`

```ts
interface CalculationResult<T> {
  value: T;
  warnings: WarningEntry[];
  assumptions: AssumptionEntry[];
  formulaVariant: string;
  dataVersion: string;
  engineVersion: string;
}
interface WarningEntry    { code: string; messageKey: string; detail?: string; }
interface AssumptionEntry { field: string; usedValue: number|string; source: 'user'|'estimated'|'default'; }
```

Rules:
- Rounding ONLY at presentation (`common/precision/roundForDisplay`). Core returns raw numbers.
- Every result stamps `engineVersion` + `dataVersion`.
- Persisted records store both versions for replay.
- Post-freeze: public API + DTO shape immutable; new behavior = new module.

### 2.6 `[LOCKED DATASET - MOTOR TABLE]` — Motor Ruler (mandatory, non-derivable)

First-class locked project asset. Powers a selectable **Motor Table Mode** in the motor-current calculator. Values MUST be consumed directly from the stored dataset file. NEVER regenerated, interpolated, approximated, or substituted with formula output. Missing values (`—`) MUST remain explicitly `null`.

Column semantics (from source catalog):
- `kW` — motor rated shaft output (nameplate)
- `PS` — rated output in metric horsepower
- `cosPhi` — nameplate power factor
- `efficiencyPercent` — nameplate efficiency
- `currentA_220V` — motor rated current at 220 V connection
- `currentA_380V` — motor rated current at 380 V connection (three-phase); `null` for 90/110/132 kW rows
- `cableSpec` — catalog-recommended NYY/NYCY cable spec string, preserved verbatim

**Canonical source:**

| kW   | PS   | Cosφ | % Verim | 220V Akım (A) | 380V Akım (A) | İrtibat Kablosu NYY/NYCY mm² |
| ---- | ---- | ---- | ------- | ------------- | ------------- | ---------------------------- |
| 0,25 | 0,34 | 0,7  | 62      | 1,4           | 0,8           | 4 x 2,5      |
| 0,37 | 0,5  | 0,72 | 64      | 2,1           | 1,6           | 4 x 2,5      |
| 0,55 | 0,75 | 0,75 | 69      | 2,7           | 1,6           | 4 x 2,5      |
| 0,75 | 1    | 0,8  | 74      | 3,4           | 2             | 4 x 2,5      |
| 1,1  | 1,5  | 0,8  | 77      | 4,4           | 2,6           | 4 x 2,5      |
| 1,5  | 2    | 0,83 | 78      | 6             | 3,5           | 4 x 2,5      |
| 2,2  | 3    | 0,84 | 81      | 8,7           | 5             | 4 x 2,5      |
| 3    | 4    | 0,84 | 81      | 11,5          | 6,5           | 4 x 2,5      |
| 4    | 5,4  | 0,84 | 82      | 14,7          | 8,5           | 4 x 2,5      |
| 5,5  | 7,5  | 0,85 | 83      | 19,8          | 11,5          | 4 x 2,5      |
| 7,5  | 10   | 0,86 | 85      | 26,5          | 15,5          | 4 x 4        |
| 11   | 15   | 0,86 | 87      | 39            | 22,5          | 4 x 6        |
| 15   | 20   | 0,86 | 87      | 52            | 30            | 4 x 6        |
| 18,5 | 25   | 0,86 | 88      | 62            | 36            | 4 x 10       |
| 22   | 30   | 0,87 | 89      | 74            | 43            | 4 x 10       |
| 30   | 40   | 0,87 | 90      | 98            | 57            | 4 x 16       |
| 37   | 50   | 0,87 | 90      | 124           | 72            | 3 x 25 + 16  |
| 45   | 61   | 0,88 | 91      | 147           | 85            | 3 x 35 + 16  |
| 55   | 75   | 0,88 | 91      | 180           | 104           | 3 x 50 + 25  |
| 75   | 100  | 0,88 | 91      | 246           | 142           | 3 x 70 + 35  |
| 90   | 123  | 0,88 | 92      | 169           | —             | 3 x 95 + 50  |
| 110  | 150  | 0,88 | 92      | 204           | —             | 3 x 120 + 70 |
| 132  | 180  | 0,88 | 92      | 243           | —             | 3 x 120 + 70 |

**Row count: 23. This count is a test invariant.**

**Canonical storage location:** `packages/calculation-data/src/iec/motor-ruler/standard-motors.json`

```json
{
  "metadata": {
    "id": "motor-ruler-standard-v1",
    "standard": "ElektroPlan Standard Motor Table",
    "revision": "v1",
    "source": "locked project dataset (master plan §2.6)",
    "validFrom": "2026-04-19",
    "notes": "23 rows. '—' values preserved as JSON null. Do NOT interpolate."
  },
  "columns": ["kW", "PS", "cosPhi", "efficiencyPercent", "currentA_220V", "currentA_380V", "cableSpec"],
  "entries": [
    { "kW": 0.25, "PS": 0.34, "cosPhi": 0.70, "efficiencyPercent": 62, "currentA_220V": 1.4,  "currentA_380V": 0.8,  "cableSpec": "4 x 2,5" },
    { "kW": 0.37, "PS": 0.50, "cosPhi": 0.72, "efficiencyPercent": 64, "currentA_220V": 2.1,  "currentA_380V": 1.6,  "cableSpec": "4 x 2,5" },
    { "kW": 0.55, "PS": 0.75, "cosPhi": 0.75, "efficiencyPercent": 69, "currentA_220V": 2.7,  "currentA_380V": 1.6,  "cableSpec": "4 x 2,5" },
    { "kW": 0.75, "PS": 1.00, "cosPhi": 0.80, "efficiencyPercent": 74, "currentA_220V": 3.4,  "currentA_380V": 2.0,  "cableSpec": "4 x 2,5" },
    { "kW": 1.10, "PS": 1.50, "cosPhi": 0.80, "efficiencyPercent": 77, "currentA_220V": 4.4,  "currentA_380V": 2.6,  "cableSpec": "4 x 2,5" },
    { "kW": 1.50, "PS": 2.00, "cosPhi": 0.83, "efficiencyPercent": 78, "currentA_220V": 6.0,  "currentA_380V": 3.5,  "cableSpec": "4 x 2,5" },
    { "kW": 2.20, "PS": 3.00, "cosPhi": 0.84, "efficiencyPercent": 81, "currentA_220V": 8.7,  "currentA_380V": 5.0,  "cableSpec": "4 x 2,5" },
    { "kW": 3.00, "PS": 4.00, "cosPhi": 0.84, "efficiencyPercent": 81, "currentA_220V": 11.5, "currentA_380V": 6.5,  "cableSpec": "4 x 2,5" },
    { "kW": 4.00, "PS": 5.40, "cosPhi": 0.84, "efficiencyPercent": 82, "currentA_220V": 14.7, "currentA_380V": 8.5,  "cableSpec": "4 x 2,5" },
    { "kW": 5.50, "PS": 7.50, "cosPhi": 0.85, "efficiencyPercent": 83, "currentA_220V": 19.8, "currentA_380V": 11.5, "cableSpec": "4 x 2,5" },
    { "kW": 7.50, "PS": 10.0, "cosPhi": 0.86, "efficiencyPercent": 85, "currentA_220V": 26.5, "currentA_380V": 15.5, "cableSpec": "4 x 4" },
    { "kW": 11.0, "PS": 15.0, "cosPhi": 0.86, "efficiencyPercent": 87, "currentA_220V": 39,   "currentA_380V": 22.5, "cableSpec": "4 x 6" },
    { "kW": 15.0, "PS": 20.0, "cosPhi": 0.86, "efficiencyPercent": 87, "currentA_220V": 52,   "currentA_380V": 30,   "cableSpec": "4 x 6" },
    { "kW": 18.5, "PS": 25.0, "cosPhi": 0.86, "efficiencyPercent": 88, "currentA_220V": 62,   "currentA_380V": 36,   "cableSpec": "4 x 10" },
    { "kW": 22.0, "PS": 30.0, "cosPhi": 0.87, "efficiencyPercent": 89, "currentA_220V": 74,   "currentA_380V": 43,   "cableSpec": "4 x 10" },
    { "kW": 30.0, "PS": 40.0, "cosPhi": 0.87, "efficiencyPercent": 90, "currentA_220V": 98,   "currentA_380V": 57,   "cableSpec": "4 x 16" },
    { "kW": 37.0, "PS": 50.0, "cosPhi": 0.87, "efficiencyPercent": 90, "currentA_220V": 124,  "currentA_380V": 72,   "cableSpec": "3 x 25 + 16" },
    { "kW": 45.0, "PS": 61.0, "cosPhi": 0.88, "efficiencyPercent": 91, "currentA_220V": 147,  "currentA_380V": 85,   "cableSpec": "3 x 35 + 16" },
    { "kW": 55.0, "PS": 75.0, "cosPhi": 0.88, "efficiencyPercent": 91, "currentA_220V": 180,  "currentA_380V": 104,  "cableSpec": "3 x 50 + 25" },
    { "kW": 75.0, "PS": 100,  "cosPhi": 0.88, "efficiencyPercent": 91, "currentA_220V": 246,  "currentA_380V": 142,  "cableSpec": "3 x 70 + 35" },
    { "kW": 90.0, "PS": 123,  "cosPhi": 0.88, "efficiencyPercent": 92, "currentA_220V": 169,  "currentA_380V": null, "cableSpec": "3 x 95 + 50" },
    { "kW": 110,  "PS": 150,  "cosPhi": 0.88, "efficiencyPercent": 92, "currentA_220V": 204,  "currentA_380V": null, "cableSpec": "3 x 120 + 70" },
    { "kW": 132,  "PS": 180,  "cosPhi": 0.88, "efficiencyPercent": 92, "currentA_220V": 243,  "currentA_380V": null, "cableSpec": "3 x 120 + 70" }
  ]
}
```

Locked behavior:
- Display layer MAY render decimals with Turkish comma (`0,25`); storage and core use dot. Numeric equality verified in tests.
- `cableSpec` is a raw string preserved exactly (`"4 x 2,5"`, `"3 x 25 + 16"`). Parsing it for cable-sizing reuse is OUT OF SCOPE of Table Mode.
- `currentA_380V = null` for rows 90/110/132 kW. UI MUST render `—` and disable 380 V selection for those rows. Core returns `null`, never a computed substitute.
- Dataset is immutable once shipped at v1. Changes require `revision` bump and new JSON file; old file retained for replay of historical records.

### 2.7 Mandatory input policy `[LOCKED]`

Motor current Formula Mode requires the user to provide all physical inputs. There are **no silent defaults**. The UI displays **format hints** (placeholder text or helper labels) showing the expected format.

Required inputs and display hints:

| Field | Hint shown in UI | Validation |
|-------|------------------|------------|
| `P_out` (kW) | `örn. 7.5` | > 0 |
| `voltage` (V) | `örn. 380` | > 0 |
| `cosPhi` | `örn. 0.85` | 0 < cosφ ≤ 1 |
| `efficiencyPercent` | `örn. 80` | 0 < η ≤ 100 |
| `phase` | dropdown: `1-phase` / `3-phase` | — |
| `voltageMode` (if 3-phase) | dropdown: `LL` / `LN` | — |

Rules:
- Empty field ⇒ form rejected at validation layer; core never receives partial input.
- Hints MUST be placeholder text, not pre-filled values (otherwise user accidentally submits the hint).
- No `AssumptionEntry` with `source: 'default'` or `source: 'estimated'` is emitted by motor current Formula Mode. All entries are `source: 'user'`.
- `source: 'estimated'` / `'default'` remain available for other modules (e.g. VD X fallback).

---

## 3. SYSTEM MODULES

| # | Package | Role |
|---|---------|------|
| 1 | `packages/calculation-core` | Pure formulas, validation, constants, DTO. No Electron/React/DB. |
| 2 | `packages/calculation-data` | Versioned JSON rulesets + typed accessors (ampacity, kT, kG, kH, **locked motor-ruler table §2.6**, protection catalog, VD profiles). |
| 3 | `packages/contracts` | Zod-validated IPC + DTO contracts shared by shell & renderer. |
| 4 | `packages/storage` | SQLite schema, repositories, migrations. Persists `engineVersion`/`dataVersion`. |
| 5 | `packages/exporters` | JSON / Excel / PDF exporters. Consume core results; no formulas. |
| 6 | `apps/desktop/main` + `preload` | Electron main process, IPC handlers, services, typed preload bridge. |
| 7 | `apps/desktop/renderer` | React UI. Calls core only via preload. |
| 8 | `tests/{property,e2e}` | fast-check property tests, Playwright E2E. |

**Monorepo tooling `[LOCKED]`:** `turborepo` + `pnpm workspaces`. Root `turbo.json` defines `build`, `test`, `lint`, `typecheck` pipelines with proper `dependsOn` graph. TypeScript project references enabled across packages.

**Standards scope `[LOCKED]`:** IEC 60364 only. No TS, ETY, TEDAŞ, or manufacturer-catalog overlays in v1. If a value is ambiguous between IEC and Turkish practice, IEC wins.

---

## 4. IMPLEMENTATION ORDER

```
M0 Repo bootstrap (turborepo + pnpm + package skeletons + CI)
 └─ M1.P1 Core bootstrap (constants, types, DTO)
     ├─ M1.P2 Motor current (formula + table modes)
     │   └─ M1.P3 Motor derived outputs (isolated)
     ├─ M1.P4 Voltage drop
     │   └─ M2.P1..P4 Data: methods, ampacity, correction factors
     │       └─ M1.P5 Cable sizing
     │           ├─ M2.P7 + M1.P6 Protection (recommendation-only)
     │           └─ M8.P1 Worked-example fixtures (IEC + hand-calc)
     │               └─ M1.P7 Engine freeze (version + public surface)
M3 Contracts
 └─ M4 Storage + M5 Exporters
     └─ M6 Desktop shell (P1 bootstrap → P2 IPC → P3 services)
         └─ M7 Renderer UI (P1..P7 sequential)
             └─ M8.P2..P4 Property + E2E
```

---

## 5. PHASE TASKS

### M0 — Repo bootstrap
Goal: executable skeleton. No business logic.
- P1: init `pnpm` workspace + `turborepo` + `package.json` root + `pnpm-workspace.yaml`.
- P2: create empty packages per §3 with `package.json`, `tsconfig.json` (references), minimal `src/index.ts` exporting nothing.
- P3: shared `tsconfig.base.json` (strict, noUncheckedIndexedAccess, exactOptionalPropertyTypes).
- P4: shared ESLint + Prettier config.
- P5: `turbo.json` with `build`, `test`, `typecheck`, `lint` pipelines.
- P6: GitHub Actions CI: `pnpm install` → `pnpm turbo run typecheck test lint`.
- P7: `decisions.md` at repo root capturing frozen choices from §2.1, §2.4, §2.7, §3, §6.

### M1.P1 — Core bootstrap
Goal: TS package skeleton; no business logic yet.
- `common/constants/index.ts` with all §2.1 constants (HP_TO_KW = 0.7457 frozen).
- `common/units/normalize.ts` (`hpToKw`).
- `common/precision/index.ts` (`roundForDisplay`); NO rounding anywhere else.
- `common/validation/guards.ts` (`assertPositive`, `assertInRange`, `assertOneOf`).
- `common/types/result.ts` — DTO from §2.5 `[LOCKED]`.
- `common/types/estimation.ts` — `EstimationStatus`.
- Vitest set up; smoke test passes.

### M1.P2 — Motor current  `[LOCKED]`
Goal: pure motor current function. Supports TWO mutually exclusive modes — **Formula Mode** (§2.2, §2.7) and **Table Mode** (§2.6). Modes are separate code paths; never mixed.
- `motor/types.ts` — `MotorCurrentInput`/`MotorCurrentOutput`; add discriminant `mode: 'formula' | 'table'` and `TableModeInput { kW: number; voltage: 220 | 380 }`.
- `motor/validate.ts` — Formula mode: reject if P/V/cosφ/η missing or ≤0 (§2.7 mandatory policy); require `voltageMode` when `phase===3`. Table mode: reject if `kW` not exact match; reject if `voltage=380` selected for row with `currentA_380V === null`.
- `motor/formulas.ts` — three formulas + `calcInputPower` + `calcApparentPower` exactly per §2.2.
- `motor/table-mode.ts` — `calculateMotorFromTable(input)` reads row via `calculation-data` accessor, returns `{ kW, PS, cosPhi, efficiencyPercent, currentA, cableSpec }` verbatim. NO formula fallback, NO interpolation. `formulaVariant = 'table-mode-220V' | 'table-mode-380V'`. `source = 'table'` in assumptions.
- `motor/index.ts` — `calculateMotorCurrent` routes by `mode`.
- Unit tests: hand-worked 1ph, 3ph-LL, 3ph-LN; `V_LL = √3·V_LN` ⇒ equal I; rejection paths for missing inputs (§2.7); table-mode row fidelity (all 23 rows); 380 V rejected for 90/110/132 kW rows.

### M1.P3 — Motor derived outputs
Goal: torque/slip/speed sub-module, isolated.
- Sub-module never imported by cable sizing.
- Mandatory inputs only (per §2.7 policy extended to this module): `P_out`, `phase`, `voltage`, `cosPhi`, `efficiencyPercent`, `polesOrRpm`, `frequency`. All user-provided; no defaults.
- Unit tests.

### M1.P4 — Voltage drop  `[LOCKED]`
Goal: VD module with four system formulas.
- `voltage-drop/types.ts` — `VoltageDropSystemType`, modes, input/output.
- `voltage-drop/resistance.ts` — `calcR20`, `calcRTheta`.
- `voltage-drop/formulas.ts` — four functions exactly per §2.3.
- `voltage-drop/sinphi.ts` — guarded `sqrt(max(0,1−cos²φ))`.
- `voltage-drop/index.ts` — routes by systemType, applies parallel conductors, temp correction, X fallback → assumption (`source: 'estimated'`).
- `voltage-drop/power-to-current.ts` — power-mode adapter.
- Unit + property tests (monotonicity S, L, I; `ΔV_LN = ΔV_LL/√3`).

### M1.P5 — Cable sizing  `[LOCKED]`
Goal: 11-step selection algorithm.
- `cable/types.ts` — `CableSizingInput`/`Output`/`CandidateStep`; `installationMethod: 'A1'|'A2'|'B1'|'B2'|'C'|'D'|'E'` (frozen set per §2.4).
- `cable/correction-factors.ts` — `lookupTempFactor`, `lookupGroupingFactor`, `lookupHarmonicFactor` (read from calculation-data).
- `cable/algorithm.ts` — §2.4 exactly; ascending scan; full `candidateTrace`.
- `cable/preliminary-estimate.ts` — J-based hint; distinct type; never final.
- `cable/index.ts` — `calculateCableSizing` composition.
- Unit tests incl. VD-gate upsize, monotonicity in Ib and kTotal, never-return-I/J, rejection of invalid method codes.

### M1.P6 — Protection (recommendation-only)
Goal: lookup-only module.
- `protection/types.ts`, `protection/lookup.ts`, `protection/index.ts`.
- Catalog lookup from `calculation-data`; **no sizing gate, no cable-sizing integration**.
- Returns candidate devices with ratings; user selects.
- Top-of-file scope comment forbidding sizing gate additions.

### M1.P7 — Engine freeze
Goal: lock public surface + versioning.
- `src/version.ts` — `ENGINE_VERSION = '1.0.0'`.
- `src/index.ts` — explicit named re-exports only.
- `package.json.exports` points to compiled `src/index.ts`.
- Property tests green → tag `engineVersion=1.0.0`.
- `FREEZE_CHECKLIST.md` at package root.

### M2 — Calculation-data (data package)
Goal: externalize tables; each file has `DatasetMetadata`.
- P1 bootstrap: folder tree (`iec/{ampacity,temperature-factors,grouping-factors,harmonic-factors,motor-ruler,protection-catalog}`, `profiles/{voltage-drop-limits,default-assumptions}`), typed JSON loader.
- P2 install-method mapping: `INSTALLATION_METHOD_MAP` over frozen set `{A1, A2, B1, B2, C, D, E}` per §2.4. Unknown-code guard throws.
- P3 ampacity: `iec-60364-5-52.json` + `getAmpacity` + `getStandardCrossSections` (ascending). Covers methods A1, A2, B1, B2, C, D, E for copper and aluminum.
- P4 correction factors: `temperature-factors/data.json`, `grouping-factors/data.json`, `harmonic-factors/data.json` + typed accessors. Source: IEC 60364-5-52 tables B.52.14–B.52.17.
- P5 motor ruler `[LOCKED §2.6]`: ship `motor-ruler/standard-motors.json` (23 rows verbatim). Accessors: `getMotorTableEntries`, `getMotorTableEntryByKW`, `isVoltageAvailable`. Loader validates row count = 23 at startup.
- P6 VD profiles: `voltage-drop-limits/profiles.json`. **Ship the following profiles:**
  - `lighting-3pct` (%3) — aydınlatma devreleri
  - `power-5pct` (%5) — güç devreleri — **DEFAULT**
  - `motor-feeder-5pct` (%5) — motor besleme
  - `total-installation-4pct` (%4) — tesis geneli
  - Accessor `getVoltageDropProfiles()` returns full list; `getDefaultProfile()` returns `power-5pct`. UI renders as dropdown (§M7.P4).
- P7 protection catalog: `protection-catalog/data.json` + `lookupProtectionDevice` (recommendation only).

### M3 — Contracts
Goal: Zod-validated IPC + DTO contracts.
- Per-calculator request/response schemas mirroring core types.
- Record/group/export DTOs including `engineVersion`/`dataVersion`.
- Installation method enum exactly `['A1','A2','B1','B2','C','D','E']`.
- Exposed via `contracts/index.ts`.

### M4 — Storage
Goal: SQLite persistence with version replay.
- P1 schema: groups, records (input JSON, output JSON, `engineVersion`, `dataVersion`, timestamps), settings.
- P2 repositories (`better-sqlite3`) with typed APIs; migrations in-repo.

### M5 — Exporters
Goal: JSON / Excel / PDF, no formulas.
- P1 JSON: serialize `CalculationResult<T>` + metadata verbatim.
- P2 Excel: sheet per calculator; inputs/outputs/assumptions/warnings.
- P3 PDF: presentation-only; uses pre-rounded display values.

### M6 — Desktop shell
Goal: Electron main + preload bridge.
- P1 bootstrap: window, dev/prod paths, context-isolation on, nodeIntegration off.
- P2 IPC handlers: validate payloads with Zod contracts before dispatch to core.
- P3 services: calculate-service, records-service, export-service, settings-service; wired to storage + exporters + core.
- Preload exposes only typed `window.elektroPlan.*` API.

### M7 — Renderer UI
Goal: React feature screens; zero direct fs/sqlite access.
- P1 bootstrap: router, theme, shared form/ui kit.
- P2 Motor current screen with **mode selector: Formula / Table**.
  - Formula Mode: all inputs required (§2.7); placeholder hints (`örn. 7.5`, `örn. 0.85`, `örn. 80`); submit disabled while any required field empty.
  - Table Mode: kW dropdown from `getMotorTableEntries()`; voltage selector (220 V / 380 V) with 380 V disabled when `isVoltageAvailable(entry, 380) === false`; result panel shows PS, Cosφ, % Verim, selected-voltage current, Kablo (mm²) verbatim. Renderer MUST NOT recompute.
  - Turkish comma in display; dot in storage.
- P3 Cable sizing screen. Installation method dropdown shows only `{A1, A2, B1, B2, C, D, E}`.
- P4 Voltage drop screen. **VD limit is a dropdown** populated from `getVoltageDropProfiles()`; default selection `power-5pct`.
- P5 History & Groups screen (needs M4).
- P6 Settings screen (firm name, units, locale, default VD profile override).
- P7 Motion & polish (animations, empty/error/loading states).

### M8 — Testing
Goal: correctness, properties, E2E.
- P1 worked-example fixtures: hand-computed canonical scenarios + IEC 60364-5-52 standard examples. Stored as `{input, expectedOutput, source, rationale}` JSONs in `tests/worked-examples/fixtures/`. Each fixture cites its source (IEC clause number or hand-calc spreadsheet). Runner in `tests/worked-examples/runner.ts` with per-field tolerances (±0.01% current, ±0.1% VD%, exact for table-mode).
- P2 execution: 100% pass required before M1.P7 engine freeze.
- P3 property tests (fast-check, ≥1000 samples): monotonicity in S, Ib, kTotal; determinism; `ΔV_LN = ΔV_LL/√3`.
- P4 Playwright/Electron E2E: motor/cable/VD happy paths, record save, group create, history open, export dialog, settings persistence.

---

## 6. DATA / RULESET INTEGRATION

| Dataset | Location | Accessor |
|---------|----------|----------|
| Installation-method mapping (frozen `{A1,A2,B1,B2,C,D,E}`) | `calculation-data/src/iec/installation-methods/mapping.ts` | `INSTALLATION_METHOD_MAP` + guard |
| Cable ampacity (IEC 60364-5-52) | `calculation-data/src/iec/ampacity/*.json` | `getAmpacity`, `getStandardCrossSections` |
| Temperature correction kT | `…/iec/temperature-factors/data.json` | `getTempFactor` |
| Grouping correction kG | `…/iec/grouping-factors/data.json` | `getGroupingFactor` |
| Harmonic correction kH | `…/iec/harmonic-factors/data.json` | `getHarmonicFactor` |
| **Motor ruler `[LOCKED §2.6]`** | `…/iec/motor-ruler/standard-motors.json` (23 rows, verbatim, `null` for missing 380 V) | `getMotorTableEntries`, `getMotorTableEntryByKW`, `isVoltageAvailable` |
| Protection catalog | `…/iec/protection-catalog/data.json` | `lookupProtectionDevice` |
| VD limit profiles (4 shipped, default `power-5pct`) | `…/profiles/voltage-drop-limits/profiles.json` | `getVoltageDropProfiles`, `getDefaultProfile`, `getProfileById` |

Rules:
- Every dataset file carries `DatasetMetadata { id, standard, revision, source, validFrom, notes }`.
- Loader rejects files missing `id` or `standard`.
- Core modules NEVER hardcode a table; always call accessors.
- Bumping a ruleset bumps `dataVersion` independently of `engineVersion`.

---

## 7. VALIDATION / TESTING

Formula parity (unit):
- Motor 1ph / 3ph-LL / 3ph-LN hand-worked checks.
- VD four system types; R20, Rθ; guarded sinφ at cosφ = 1.
- Cable selection: correct S for method C copper; VD gate forces upsize.

Motor Table Mode `[LOCKED §2.6]` — mandatory tests (all MUST pass):
- **Row count invariant:** `getMotorTableEntries().length === 23`.
- **Exact-value fidelity:** for each of the 23 kW rows, assert all seven columns equal §2.6 values exactly (numeric `===` / string `===`). Inline fixture array in test file.
- **Missing-value fidelity:** `currentA_380V === null` for rows 90, 110, 132 kW; `isVoltageAvailable(entry, 380) === false` for those; table-mode calculation with `voltage=380` on those rows throws/rejects.
- **No interpolation:** `getMotorTableEntryByKW(7.2)` returns `undefined`.
- **No formula substitution:** table-mode result strictly equals row values; not formula-derived.
- **Decimal fidelity:** JSON loader returns `kW=0.25` exact; display formatter → `"0,25"`; round-trip lossless.
- **Cable spec preserved:** 37 kW → `"3 x 25 + 16"`, 75 kW → `"3 x 70 + 35"`, etc.
- **Dataset-source assertion:** static CI check — no `.ts` file under `packages/calculation-data/src/iec/motor-ruler/` contains a numeric literal from the table (other than JSON parse).

Mandatory-input policy tests (§2.7):
- Motor Formula Mode rejects submission with missing `cosPhi` / `efficiencyPercent` / `P_out` / `voltage`.
- No `AssumptionEntry` with `source === 'default'` emitted by Formula Mode under any input.
- UI placeholder hints present on every required field; never pre-filled as values.

Worked-example fixtures (IEC + hand-calc):
- `motor-{1phase,3phase-LL,3phase-LN}-standard.json` — hand-calculated.
- `motor-table-mode-001.json` — low-kW row, both voltages.
- `motor-table-mode-380V-only.json` — 22 kW, 380 V, expected `I=43 A`.
- `motor-table-mode-220V-disabled.json` — 110 kW, 380 V rejected, 220 V returns 204 A.
- `cable-method-C-copper.json`, `cable-method-B2-aluminum.json` — IEC 60364-5-52 Annex worked examples.
- `vdrop-single-phase-within-limit.json`, `vdrop-three-phase-over-limit.json` — hand-calc.
- `cable-vdrop-gate-triggered.json` — hand-calc.
- Each fixture has `source` field citing IEC clause or hand-calc reference.
- Tolerances: ±0.01% current, ±0.1% VD%. Table-mode exact. 100% pass required before M1.P7.

Property tests (fast-check, ≥1000 samples):
- `∀ S1<S2 ⇒ VD(S1) ≥ VD(S2)`
- `∀ Ib1<Ib2 ⇒ selectedSection(Ib1) ≤ selectedSection(Ib2)`
- `∀ kTotal1<kTotal2 ⇒ selectedSection(kTotal1) ≥ selectedSection(kTotal2)`
- Determinism: `calculate(x) === calculate(x)`
- Balanced 3ph: `ΔV_LN = ΔV_LL/√3`

E2E (Playwright+Electron):
- Motor/Cable/VD form → result → save record.
- **Motor Formula Mode missing-input flow:** user leaves cosφ empty → submit disabled → placeholder `örn. 0.85` visible.
- **Motor Table Mode flow:** user switches to Table Mode → selects `22 kW` → selects 380 V → result shows `PS=30, Cosφ=0,87, %Verim=89, Akım=43 A, Kablo=4 x 10`.
- **Motor Table Mode 380 V disabled:** user selects `110 kW` → 380 V disabled; 220 V returns `204 A`, `Kablo=3 x 120 + 70`.
- **VD profile dropdown:** default `power-5pct` selected; user can switch to `lighting-3pct`.
- **Cable method dropdown:** shows exactly `{A1, A2, B1, B2, C, D, E}`.
- Group create; save to group; open from history.
- PDF export dialog (mocked) completes.
- Settings persist across restart.

Determinism guard:
- Core has no `Date.now()`, `Math.random()`, global state, or I/O. CI grep check.

---

## 8. FROZEN DECISIONS (was: open questions)

All decisions committed to `decisions.md` at repo root. No further gates block implementation.

| # | Decision | Value |
|---|----------|-------|
| D-1 | HP→kW constant | `0.7457` |
| D-2 | Installation method set | `{A1, A2, B1, B2, C, D, E}` (IEC 60364-5-52) |
| D-3 | VD limit profiles | 4 shipped: `lighting-3pct`, `power-5pct` (default), `motor-feeder-5pct`, `total-installation-4pct`. UI dropdown. |
| D-4 | Motor ruler | Locked by §2.6 (23 rows, verbatim) |
| D-5 | Motor input policy | All inputs mandatory; placeholder hints only; no silent defaults (§2.7) |
| D-6 | Protection scope | Recommendation-only; no sizing gate |
| D-7 | Monorepo tooling | `turborepo` + `pnpm workspaces` |
| D-8 | Standards scope | IEC 60364 only; no TS/ETY/manufacturer overlays in v1 |
| D-9 | Legacy migration | None. Greenfield rewrite. No Python reference, no parity target. |

---

## 9. CODING AGENT RULES

- DO NOT modify any block marked `[LOCKED]`. Formulas, constants, DTO shape, and the 11-step algorithm are frozen.
- DO NOT duplicate any formula. One implementation lives in `calculation-core`; UI/exporters/services consume results only.
- DO NOT let `calculation-core` import `electron`, `react`, `better-sqlite3`, fs, or any renderer code.
- DO NOT let the renderer call fs, SQLite, or Electron APIs directly. Everything flows through typed preload → IPC → main services.
- DO NOT round inside core. Only `common/precision/roundForDisplay` at presentation edges.
- DO NOT hardcode tables (ampacity, kT, kG, kH, motor ruler, protection catalog, VD profiles). Always read via `calculation-data` accessors.
- DO NOT mix LL and LN voltage paths. Separate functions, separate `formulaVariant` tags.
- DO NOT silently default η or cosφ in motor Formula Mode (§2.7). Reject missing inputs at validation.
- DO NOT pre-fill required fields with example values in the UI. Use placeholder hints only.
- DO NOT return `S = Ib/J` as final cable selection. Only as `preliminary-only` typed hint.
- DO NOT accept installation method codes outside `{A1, A2, B1, B2, C, D, E}`.
- DO NOT reference, import, or port any legacy Python code, data, or behavior. This is a greenfield project.
- DO NOT advance a phase while its listed dependencies are unmet (see §4).
- DO implement phase-by-phase; a phase is done only when its unit tests pass.
- DO stamp every `CalculationResult` with `engineVersion` + `dataVersion`, and persist both on records.
- DO validate every IPC payload with Zod `contracts` schemas before passing to core.
- DO add new behavior as a new module/feature; never mutate a frozen one.
- DO NOT regenerate, approximate, interpolate, round, re-derive, or otherwise reconstruct the Motor Table in §2.6. Read from `standard-motors.json` only.
- DO NOT embed motor-table values in any `.ts`/`.tsx` source other than the single dedicated test fixture.
- DO NOT substitute formula output for table-mode results. If the requested voltage is `null` for a row, reject — no fallback.
- DO preserve `—` (missing) as JSON `null` in storage and as `"—"` in display.
- DO implement Motor Table Mode as a mandatory, shipped feature in M1.P2 + M2.P5 + M7.P2.
