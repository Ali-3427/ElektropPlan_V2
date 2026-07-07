import assert from "node:assert/strict";

import {
  ampacityDatasets,
  cableRulerDataset,
  getAmpacity,
  getAmpacityForAmbient,
  getCableRulerDataVersion,
  getCableRulerEntries,
  getGroupingFactor,
  getHarmonicFactor,
  lookupProtectionDevice,
  getStandardCrossSections,
  getTempFactor,
  groupingFactorDataset,
  harmonicFactorDataset,
  protectionCatalogDataset,
  temperatureFactorDataset,
  getVoltageDropProfiles,
  getDefaultProfile,
  getProfileById,
} from "../dist/index.js";

assert.equal(ampacityDatasets.copper.metadata.standard, "IEC 60364-5-52");
assert.equal(ampacityDatasets.copper.metadata.revision, "v1");
assert.equal(ampacityDatasets.copper.metadata.validFrom, "2026-04-19");
assert.equal(ampacityDatasets.aluminum.metadata.standard, "IEC 60364-5-52");
assert.equal(ampacityDatasets.aluminum.metadata.revision, "v1");
assert.equal(ampacityDatasets.aluminum.metadata.validFrom, "2026-04-19");

assert.deepEqual(getStandardCrossSections("copper"), [
  1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120,
]);
assert.deepEqual(getStandardCrossSections("aluminum"), [
  1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120,
]);

assert.equal(cableRulerDataset.metadata.id, "cable-ruler-standard-v1");
assert.equal(
  cableRulerDataset.metadata.standard,
  "ElektroPlan Cable Ruler (nominal section vs. ampacity)",
);
assert.equal(cableRulerDataset.metadata.revision, "v1");
assert.equal(cableRulerDataset.metadata.validFrom, "2026-04-21");
assert.equal(
  getCableRulerDataVersion(),
  "cable-ruler-standard-v1:v1",
);
assert.equal(getCableRulerEntries().length, 18);

const cableRulerEntries = getCableRulerEntries();
const section15 = cableRulerEntries.find((entry) => entry.nominal_kesit_mm2 === "1,5");
assert.equal(section15?.sectionMm2, 1.5);
const section05 = cableRulerEntries.find((entry) => entry.nominal_kesit_mm2 === "0,5*");
assert.equal(section05?.sectionMm2, 0.5);
assert.equal(section05?.akim_toprak_20C_A, null);
assert.equal(getAmpacityForAmbient(section05, "hava_30C"), 11);

const section240 = cableRulerEntries.find((entry) => entry.nominal_kesit_mm2 === "240");
assert.equal(section240?.sectionMm2, 240);
assert.equal(getAmpacityForAmbient(section240, "hava_30C"), 528);
assert.equal(getAmpacityForAmbient(section240, "toprak_20C"), null);

assert.equal(
  getAmpacity({ material: "aluminum", crossSectionMm2: 4, method: "C" }),
  null,
);
assert.equal(
  getAmpacity({ material: "aluminum", crossSectionMm2: 10, method: "E" }),
  null,
);
assert.equal(
  getAmpacity({ material: "copper", crossSectionMm2: 35, method: "D" }),
  113,
);
assert.equal(
  getAmpacity({ material: "copper", crossSectionMm2: 999, method: "C" }),
  undefined,
);

assert.equal(temperatureFactorDataset.metadata.standard, "IEC 60364-5-52");
assert.equal(temperatureFactorDataset.metadata.revision, "v1");
assert.equal(temperatureFactorDataset.metadata.validFrom, "2026-04-19");
assert.equal(
  getTempFactor({
    method: "C",
    temperatureC: 40,
    insulation: "XLPE_EPR_90C",
  }),
  0.91,
);
assert.equal(
  getTempFactor({
    method: "D",
    temperatureC: 40,
    insulation: "XLPE_EPR_90C",
  }),
  0.85,
);
assert.equal(
  getTempFactor({
    method: "D",
    temperatureC: 30,
    insulation: "PVC_70C",
  }),
  0.89,
);
assert.equal(
  getTempFactor({
    method: "A1",
    temperatureC: 25,
    insulation: "XLPE_EPR_90C",
  }),
  undefined,
);

assert.equal(groupingFactorDataset.metadata.standard, "IEC 60364-5-52");
assert.equal(groupingFactorDataset.metadata.revision, "v1");
assert.equal(groupingFactorDataset.metadata.validFrom, "2026-04-19");
assert.equal(getGroupingFactor(1), 1);
assert.equal(getGroupingFactor(4), 0.77);
assert.equal(getGroupingFactor(5), undefined);
assert.equal(getGroupingFactor(6), 0.73);

assert.equal(harmonicFactorDataset.metadata.standard, "IEC 60364-5-52");
assert.equal(harmonicFactorDataset.metadata.revision, "v1");
assert.equal(harmonicFactorDataset.metadata.validFrom, "2026-04-19");
assert.deepEqual(getHarmonicFactor(15), {
  thirdHarmonicPercent: 15,
  factor: 1,
  appliedTo: "phase",
  sizingCurrentBasis: "phase",
  phaseFactor: 1,
  neutralFactor: null,
  neutralCurrentMultiplier: null,
});
assert.deepEqual(getHarmonicFactor(33), {
  thirdHarmonicPercent: 33,
  factor: 0.86,
  appliedTo: "phase",
  sizingCurrentBasis: "phase",
  phaseFactor: 0.86,
  neutralFactor: null,
  neutralCurrentMultiplier: null,
});
assert.deepEqual(getHarmonicFactor(45), {
  thirdHarmonicPercent: 45,
  factor: 0.86,
  appliedTo: "neutral",
  sizingCurrentBasis: "neutral",
  phaseFactor: null,
  neutralFactor: 0.86,
  neutralCurrentMultiplier: 1.35,
});
assert.deepEqual(getHarmonicFactor(60), {
  thirdHarmonicPercent: 60,
  factor: 1,
  appliedTo: "neutral",
  sizingCurrentBasis: "neutral",
  phaseFactor: null,
  neutralFactor: 1,
  neutralCurrentMultiplier: 1.8,
});

assert.equal(protectionCatalogDataset.metadata.standard, "project-seed-catalog");
assert.equal(protectionCatalogDataset.metadata.revision, "v1");
assert.equal(protectionCatalogDataset.metadata.validFrom, "2026-04-19");
assert.equal(protectionCatalogDataset.entries.length, 20);
assert.deepEqual(
  lookupProtectionDevice({
    minimumNominalCurrentA: 18,
    families: ["MCB"],
    poles: 3,
    voltageV: 400,
    limit: 2,
  }).map((entry) => entry.id),
  ["mcb-3p-c-20a-10ka", "mcb-3p-c-25a-10ka"],
);
assert.deepEqual(
  lookupProtectionDevice({
    minimumNominalCurrentA: 16,
    families: ["RCBO"],
    poles: 2,
    voltageV: 230,
    residualCurrentMa: 30,
  }).map((entry) => entry.id),
  [
    "rcbo-2p-c-16a-30ma-6ka",
    "rcbo-2p-c-20a-30ma-6ka",
    "rcbo-2p-c-32a-30ma-6ka",
  ],
);
assert.deepEqual(
  lookupProtectionDevice({
    minimumNominalCurrentA: 70,
    families: ["MCCB"],
    poles: 3,
    voltageV: 400,
  }).map((entry) => entry.id),
  ["mccb-3p-80a-25ka"],
);

const vdProfiles = getVoltageDropProfiles();
assert.equal(vdProfiles.length, 4);
assert.deepEqual(
  vdProfiles.map((p) => p.id),
  ["lighting-3pct", "power-5pct", "motor-feeder-5pct", "total-installation-4pct"],
);
assert.equal(getDefaultProfile().id, "power-5pct");
assert.equal(getProfileById("lighting-3pct").limitPercent, 3);
assert.equal(getProfileById("power-5pct").limitPercent, 5);
assert.equal(getProfileById("motor-feeder-5pct").limitPercent, 5);
assert.equal(getProfileById("total-installation-4pct").limitPercent, 4);
assert.equal(getProfileById("nonexistent"), undefined);

console.log("IEC dataset assertions passed.");
