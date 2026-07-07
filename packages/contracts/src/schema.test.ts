import {
  cableRulerRequestSchema,
  cableRulerResponseSchema,
  cableResponseSchema,
  calculationsExportSchema,
  calculationRecordSchema,
  groupingMetadataSchema,
  installationMethodSchema,
  materialAssignmentSchema,
  materialCategorySchema,
  materialSchema,
  materialUnitSchema,
  motorFormulaOutputSchema,
  motorResponseSchema,
  motorSuggestedCableSectionSchema,
  protectionResponseSchema,
  voltageDropGroupRequestSchema,
  voltageDropGroupResponseSchema,
  voltageDropResponseSchema,
} from "./schemas.js";
import {
  PROJECT_MARKER_TAG,
  isProjectChildGroup,
  isProjectGroup,
} from "./index.js";

function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(message ?? `Expected ${String(expected)} but received ${String(actual)}.`);
  }
}

function assertThrows(fn: () => void, message?: string): void {
  let threw = false;

  try {
    fn();
  } catch {
    threw = true;
  }

  if (!threw) {
    throw new Error(message ?? "Expected function to throw.");
  }
}

installationMethodSchema.parse("A1");
installationMethodSchema.parse("E");

motorResponseSchema.parse({
  value: {
    mode: "formula",
    phase: 3,
    voltage: 400,
    cosPhi: 0.85,
    efficiencyPercent: 92,
    P_out: 15,
    inputPowerKW: 16.3,
    apparentPowerKVA: 19.2,
    currentA: 27.7,
    voltageMode: "LL",
  },
  warnings: [],
  assumptions: [],
  formulaVariant: "three-phase-ll",
  dataVersion: "motor-formula-v1",
  engineVersion: "1.0.0",
});

voltageDropResponseSchema.parse({
  value: {
    mode: "current",
    systemType: "three-phase-ac-ll",
    impedanceMode: "exact-ac",
    conductorMaterial: "copper",
    lengthM: 45,
    sectionMm2: 16,
    baseVoltageV: 400,
    currentA: 32,
    cosPhi: 0.9,
    sinPhi: 0.4358898944,
    parallelConductors: 1,
    conductorTempC: 70,
    resistance20OhmPerKm: 1.15,
    resistanceOhmPerKm: 1.38,
    reactanceOhmPerKm: 0.08,
    deltaVVolts: 4.5,
    deltaVPercent: 1.125,
  },
  warnings: [],
  assumptions: [],
  formulaVariant: "three-phase-ac-ll",
  dataVersion: "voltage-drop-formula-v1",
  engineVersion: "1.0.0",
});

voltageDropGroupRequestSchema.parse({
  segments: [
    {
      title: "Segment 1",
      localPowerKW: 1,
      lengthM: 20,
    },
    {
      title: "Segment 2",
      localPowerKW: 3,
      lengthM: 30,
    },
  ],
});

voltageDropGroupRequestSchema.parse({
  title: "A grubu",
  segments: [
    {
      id: "segment-1",
      title: "Segment 1",
      localPowerKW: 1,
      lengthM: 20,
      sectionMm2: 4,
      settings: {
        conductorMaterial: "copper",
        installationMethod: "C",
      },
    },
    {
      id: "segment-2",
      title: "Segment 2",
      localPowerKW: 70.25,
      lengthM: 150,
      sectionMm2: 95,
      settings: {
        conductorMaterial: "aluminum",
        installationMethod: "D",
      },
    },
  ],
  settings: {
    limitPercent: 3,
    phaseMode: "auto",
    singlePhaseVoltageV: 230,
    threePhaseVoltageV: 400,
    cosPhi: 0.8,
    efficiencyPercent: 100,
    conductorMaterial: "copper",
    installationMethod: "C",
    insulationRating: "XLPE_EPR_90C",
    ambientTemperatureC: 30,
    groupedCircuits: 1,
    thirdHarmonicPercent: 0,
    conductorTempC: 70,
    impedanceMode: "simplified",
    reactanceOhmPerKm: 0.08,
    terminalLossFactor: 1.015,
  },
});

voltageDropGroupResponseSchema.parse({
  value: {
    title: "A grubu",
    settings: {
      limitPercent: 3,
      phaseMode: "auto",
      systemType: "single-phase-ac-two-conductor",
      baseVoltageV: 230,
      cosPhi: 0.8,
      efficiencyPercent: 100,
      conductorMaterial: "copper",
      installationMethod: "C",
      insulationRating: "XLPE_EPR_90C",
      ambientTemperatureC: 30,
      groupedCircuits: 1,
      thirdHarmonicPercent: 0,
      conductorTempC: 70,
      impedanceMode: "simplified",
      reactanceOhmPerKm: 0.08,
      terminalLossFactor: 1.015,
    },
    totalLocalPowerKW: 4,
    maxCumulativeDeltaVPercent: 1.2,
    isCompliant: true,
    segments: [
      {
        id: "segment-1",
        title: "Segment 1",
        order: 0,
        localPowerKW: 1,
        flowPowerKW: 4,
        lengthM: 20,
        currentA: 24,
        selectedSectionMm2: 2.5,
        fixedSection: false,
        settings: {
          cosPhi: 0.8,
          efficiencyPercent: 100,
          conductorMaterial: "copper",
          installationMethod: "C",
          insulationRating: "XLPE_EPR_90C",
          ambientTemperatureC: 30,
          groupedCircuits: 1,
          thirdHarmonicPercent: 0,
          conductorTempC: 70,
          impedanceMode: "simplified",
          terminalLossFactor: 1.015,
        },
        baseAmpacityA: 36,
        correctedAmpacityA: 31.5,
        segmentDeltaVVolts: 1.6,
        segmentDeltaVPercent: 0.7,
        cumulativeDeltaVPercent: 0.7,
        thermalPass: true,
        voltageDropPass: true,
        compliant: true,
      },
    ],
    optimizationSteps: [],
  },
  warnings: [],
  assumptions: [],
  formulaVariant: "voltage-drop-group-radial-v1",
  dataVersion: "voltage-drop-group-radial-v1",
  engineVersion: "1.0.0",
});

calculationRecordSchema.parse({
  id: "vd-old",
  calculator: "voltage-drop",
  title: "Old VD",
  version: {
    contractVersion: "m3",
    engineVersion: "1.0.0",
    dataVersion: "voltage-drop-formula-v1",
  },
  input: {
    mode: "current",
    systemType: "three-phase-ac-ll",
    impedanceMode: "exact-ac",
    conductorMaterial: "copper",
    lengthM: 45,
    sectionMm2: 16,
    baseVoltageV: 400,
    currentA: 32,
    cosPhi: 0.9,
    parallelConductors: 1,
    conductorTempC: 70,
    reactanceOhmPerKm: 0.08,
  },
  output: {
    value: {
      mode: "current",
      systemType: "three-phase-ac-ll",
      impedanceMode: "exact-ac",
      conductorMaterial: "copper",
      lengthM: 45,
      sectionMm2: 16,
      baseVoltageV: 400,
      currentA: 32,
      cosPhi: 0.9,
      sinPhi: 0.4358898944,
      parallelConductors: 1,
      conductorTempC: 70,
      resistance20OhmPerKm: 1.15,
      resistanceOhmPerKm: 1.38,
      reactanceOhmPerKm: 0.08,
      deltaVVolts: 4.5,
      deltaVPercent: 1.125,
    },
    warnings: [],
    assumptions: [],
    formulaVariant: "three-phase-ac-ll",
    dataVersion: "voltage-drop-formula-v1",
    engineVersion: "1.0.0",
  },
});

calculationRecordSchema.parse({
  id: "vdg-1",
  calculator: "voltage-drop-group",
  title: "A grubu",
  version: {
    contractVersion: "m3",
    engineVersion: "1.0.0",
    dataVersion: "voltage-drop-group-radial-v1",
  },
  input: {
    title: "A grubu",
    segments: [
      {
        id: "segment-1",
        title: "Segment 1",
        localPowerKW: 1,
        lengthM: 20,
        sectionMm2: 4,
      },
      {
        id: "segment-2",
        title: "Segment 2",
        localPowerKW: 3,
        lengthM: 30,
        settings: {
          conductorMaterial: "aluminum",
          installationMethod: "D",
        },
      },
    ],
  },
  output: {
    value: {
      title: "A grubu",
      settings: {
        limitPercent: 3,
        phaseMode: "auto",
        systemType: "single-phase-ac-two-conductor",
        baseVoltageV: 230,
        cosPhi: 0.8,
        efficiencyPercent: 100,
        conductorMaterial: "copper",
        installationMethod: "C",
        insulationRating: "XLPE_EPR_90C",
        ambientTemperatureC: 30,
        groupedCircuits: 1,
        thirdHarmonicPercent: 0,
        conductorTempC: 70,
        impedanceMode: "simplified",
        terminalLossFactor: 1.015,
      },
      totalLocalPowerKW: 4,
      maxCumulativeDeltaVPercent: 1.2,
      isCompliant: true,
      segments: [],
      optimizationSteps: [],
    },
    warnings: [],
    assumptions: [],
    formulaVariant: "voltage-drop-group-radial-v1",
    dataVersion: "voltage-drop-group-radial-v1",
    engineVersion: "1.0.0",
  },
});

cableResponseSchema.parse({
  value: {
    selectedSectionMm2: 16,
    baseAmpacityA: 76,
    correctedAmpacityA: 58,
    designCurrentA: 50,
    sizingCurrentA: 50,
    loadedConductors: 3,
    harmonicSizingBasis: "design-current",
    kT: 0.91,
    kG: 0.8,
    kH: 1,
    kTotal: 0.728,
    izRequiredA: 68.69,
    voltageDropLimitPercent: 3,
    preliminaryEstimate: {
      kind: "preliminary-j-hint",
      referenceCurrentA: 68.69,
      currentDensityAperMm2: 6,
      correctionFactorProduct: 0.728,
      estimatedSectionMm2: 15.72,
    },
    vdResult: {
      value: {
        mode: "current",
        systemType: "three-phase-ac-ll",
        impedanceMode: "exact-ac",
        conductorMaterial: "copper",
        lengthM: 45,
        sectionMm2: 16,
        baseVoltageV: 400,
        currentA: 50,
        cosPhi: 0.9,
        sinPhi: 0.4358898944,
        parallelConductors: 1,
        resistance20OhmPerKm: 1.15,
        resistanceOhmPerKm: 1.38,
        reactanceOhmPerKm: 0.08,
        deltaVVolts: 7,
        deltaVPercent: 1.75,
      },
      warnings: [],
      assumptions: [],
      formulaVariant: "three-phase-ac-ll",
      dataVersion: "voltage-drop-formula-v1",
      engineVersion: "1.0.0",
    },
    candidateTrace: [],
  },
  warnings: [],
  assumptions: [],
  formulaVariant: "iec-cable-sizing-v1",
  dataVersion: "ampacity-copper-xlpe-90c-3loaded",
  engineVersion: "1.0.0",
});

cableRulerRequestSchema.parse({
  designCurrentA: 24,
  ambient: "hava_30C",
});

let invalidCableRulerAmbientRejected = false;

try {
  cableRulerRequestSchema.parse({
    designCurrentA: 24,
    ambient: "havasiz",
  });
} catch {
  invalidCableRulerAmbientRejected = true;
}

if (!invalidCableRulerAmbientRejected) {
  throw new Error("cableRulerRequestSchema should reject unknown ambient values.");
}

cableRulerResponseSchema.parse({
  value: {
    mode: "ruler",
    designCurrentA: 20,
    ambient: "hava_30C",
    selected: {
      nominal_kesit_mm2: "1*",
      sectionMm2: 1,
      dis_cap_mm: 2.5,
      net_agirlik_kg_km: 14,
      sevk_uzunlugu_m: 100,
      dc_direnc_ohm_km_20C: 19.5,
      akim_toprak_20C_A: 11,
      akim_hava_30C_A: 20,
    },
    selectedAmpacityA: 20,
  },
  warnings: [],
  assumptions: [],
  formulaVariant: "cable-ruler-hava_30C",
  dataVersion: "test",
  engineVersion: "test",
});

motorFormulaOutputSchema.parse({
  mode: "formula",
  phase: 3,
  voltage: 380,
  cosPhi: 0.85,
  efficiencyPercent: 85,
  P_out: 7.5,
  inputPowerKW: 8.82,
  apparentPowerKVA: 10.38,
  currentA: 15.8,
  suggestedCableSection: {
    sectionMm2: 1.5,
    label: "1,5",
    ambient: "hava_30C",
    ampacityA: 24,
  },
});

motorFormulaOutputSchema.parse({
  mode: "formula",
  phase: 1,
  voltage: 220,
  cosPhi: 0.8,
  efficiencyPercent: 80,
  P_out: 1,
  inputPowerKW: 1.25,
  apparentPowerKVA: 1.56,
  currentA: 7.1,
});

const parsedGroupingWithQuantity = groupingMetadataSchema.parse({
  groupId: "g1",
  quantity: 3,
});
assertEqual(parsedGroupingWithQuantity.quantity, 3);

const parsedGroupingWithoutQuantity = groupingMetadataSchema.parse({
  groupId: "g1",
});
assertEqual(parsedGroupingWithoutQuantity.quantity, undefined);

assertThrows(() =>
  groupingMetadataSchema.parse({
    groupId: "g1",
    quantity: 1.5,
  }),
);

assertThrows(() =>
  groupingMetadataSchema.parse({
    groupId: "g1",
    quantity: 0,
  }),
);

const motorSuggestedCableBase = {
  sectionMm2: 2.5,
  label: "2,5",
  ambient: "hava_30C" as const,
  ampacityA: 26,
};

assertEqual(
  motorSuggestedCableSectionSchema.parse({
    ...motorSuggestedCableBase,
    standardHintMm2: 2.5,
  }).standardHintMm2,
  2.5,
);

assertEqual(
  motorSuggestedCableSectionSchema.parse({
    ...motorSuggestedCableBase,
    standardHintMm2: 4,
  }).standardHintMm2,
  4,
);

assertThrows(() =>
  motorSuggestedCableSectionSchema.parse({
    ...motorSuggestedCableBase,
    standardHintMm2: 6,
  }),
);

assertEqual(
  motorSuggestedCableSectionSchema.parse(motorSuggestedCableBase).standardHintMm2,
  undefined,
);

assertEqual(PROJECT_MARKER_TAG, "project");

assertEqual(
  isProjectGroup({
    id: "p",
    title: "Project",
    tags: [PROJECT_MARKER_TAG],
    version: { contractVersion: "1" },
  }),
  true,
);

assertEqual(
  isProjectGroup({
    id: "p",
    title: "Project",
    version: { contractVersion: "1" },
  }),
  false,
);

assertEqual(
  isProjectChildGroup({
    id: "g",
    title: "Group",
    parentGroupId: "p",
    version: { contractVersion: "1" },
  }),
  true,
);

assertEqual(
  isProjectChildGroup({
    id: "g",
    title: "Group",
    version: { contractVersion: "1" },
  }),
  false,
);

protectionResponseSchema.parse([
  {
    id: "mcb-c16",
    family: "MCB",
    curve: "C",
    ratings: {
      nominalCurrentA: 16,
      breakingCapacityKa: 6,
      residualCurrentMa: null,
      voltageV: 400,
      poles: 3,
    },
    sourceNote: "catalog",
    device: {
      id: "mcb-c16",
      family: "MCB",
      poles: 3,
      nominalCurrentA: 16,
      breakingCapacityKa: 6,
      curve: "C",
      residualCurrentMa: null,
      voltageV: 400,
      sourceNote: "catalog",
    },
  },
]);

calculationsExportSchema.parse({
  version: {
    contractVersion: "m3",
  },
  exportedAt: "2026-04-19T20:00:00.000Z",
  groups: [
    {
      id: "feeders",
      title: "Feeders",
      order: 1,
      version: {
        contractVersion: "m3",
      },
    },
  ],
  records: [
    {
      id: "motor-1",
      calculator: "motor",
      title: "Pump motor",
      grouping: {
        groupId: "feeders",
        groupPath: ["Main Board", "Feeders"],
        groupTitle: "Feeders",
        order: 1,
        tags: ["pump"],
      },
      version: {
        contractVersion: "m3",
        engineVersion: "1.0.0",
        dataVersion: "motor-formula-v1",
      },
      input: {
        mode: "formula",
        phase: 3,
        P_out: 15,
        voltage: 400,
        cosPhi: 0.85,
        efficiencyPercent: 92,
        voltageMode: "LL",
      },
      output: {
        value: {
          mode: "formula",
          phase: 3,
          voltage: 400,
          cosPhi: 0.85,
          efficiencyPercent: 92,
          P_out: 15,
          inputPowerKW: 16.3,
          apparentPowerKVA: 19.2,
          currentA: 27.7,
          voltageMode: "LL",
        },
        warnings: [],
        assumptions: [],
        formulaVariant: "three-phase-ll",
        dataVersion: "motor-formula-v1",
        engineVersion: "1.0.0",
      },
    },
  ],
});

calculationRecordSchema.parse({
  id: "manual-1",
  calculator: "manual-current",
  title: "Priz hattı F3",
  grouping: { groupId: "g1", quantity: 2 },
  version: { contractVersion: "1" },
  input: { currentA: 16, label: "Priz hattı F3" },
  output: { value: { currentA: 16 } },
});

// Material category — minimal parse
{
  const result = materialCategorySchema.parse({
    id: "kontaktorler",
    title: "KONTAKTÖRLER",
  });
  assertEqual(result.id, "kontaktorler");
}

// Material category — rejects empty id
assertThrows(() =>
  materialCategorySchema.parse({
    id: "",
    title: "KONTAKTÖRLER",
  }),
);

// Material category — rejects unknown extra keys (strict)
assertThrows(() =>
  materialCategorySchema.parse({
    id: "kontaktorler",
    title: "KONTAKTÖRLER",
    extra: "nope",
  }),
);

// Material — full optionals
{
  const result = materialSchema.parse({
    id: "kontaktorler--af38",
    categoryId: "kontaktorler",
    name: "AF38",
    orderValue: 1,
    brand: "ABB",
    modelCode: "AF38-30-00-13",
    unit: "adet",
    unitPrice: 1450.5,
    stockQty: 0,
    notes: "",
    attributes: { coilV: 230 },
    source: "seed",
    seedDataVersion: "materials-2026-05-19",
  });
  assertEqual(result.source, "seed");
}

// Material — minimal with default source
{
  const result = materialSchema.parse({
    id: "c--m",
    categoryId: "c",
    name: "M",
  });
  assertEqual(result.source, "user");
}

// Material — negative price rejected
assertThrows(() => {
  materialSchema.parse({
    id: "x",
    categoryId: "c",
    name: "n",
    unitPrice: -1,
    source: "user",
  });
});

// Material — negative stockQty rejected
assertThrows(() => {
  materialSchema.parse({
    id: "x",
    categoryId: "c",
    name: "n",
    stockQty: -1,
    source: "user",
  });
});

// Material — non-integer stockQty rejected
assertThrows(() => {
  materialSchema.parse({
    id: "x",
    categoryId: "c",
    name: "n",
    stockQty: 1.5,
    source: "user",
  });
});

// Material — attributes accept string|number|boolean|null
{
  const result = materialSchema.parse({
    id: "c--m",
    categoryId: "c",
    name: "M",
    attributes: { s: "x", n: 1, b: true, nul: null },
  });
  assertEqual(result.attributes?.s, "x");
}

// Assignment — with snapshot fields
{
  const result = materialAssignmentSchema.parse({
    id: "asg_1",
    recordId: "rec_1",
    materialId: "kontaktorler--af38",
    quantity: 2,
    unit: "adet",
    snapshotName: "AF38",
    snapshotCategoryId: "kontaktorler",
    snapshotCategoryTitle: "KONTAKTÖRLER",
  });
  assertEqual(result.quantity, 2);
}

// Assignment — null materialId allowed (orphaned snapshot)
{
  const result = materialAssignmentSchema.parse({
    id: "asg_2",
    recordId: "rec_1",
    materialId: null,
    quantity: 1,
    snapshotName: "Custom item",
    snapshotCategoryId: "custom",
    snapshotCategoryTitle: "Özel",
  });
  assertEqual(result.materialId, null);
}

// Assignment — quantity must be positive
assertThrows(() =>
  materialAssignmentSchema.parse({
    id: "asg_3",
    recordId: "rec_1",
    materialId: "m",
    quantity: 0,
    snapshotName: "X",
    snapshotCategoryId: "c",
    snapshotCategoryTitle: "C",
  }),
);

// Assignment — snapshotAttributes accept arbitrary unknowns
{
  const result = materialAssignmentSchema.parse({
    id: "asg_4",
    recordId: "rec_1",
    materialId: "m",
    quantity: 1,
    snapshotName: "X",
    snapshotCategoryId: "c",
    snapshotCategoryTitle: "C",
    snapshotAttributes: { nested: { foo: 1 } },
  });
  assertEqual(typeof result.snapshotAttributes, "object");
}

// MaterialUnit — invalid value rejected
assertThrows(() => materialUnitSchema.parse("foo"));

// MaterialUnit — valid values
assertEqual(materialUnitSchema.parse("adet"), "adet");
assertEqual(materialUnitSchema.parse("m"), "m");
assertEqual(materialUnitSchema.parse("kg"), "kg");
assertEqual(materialUnitSchema.parse("set"), "set");
assertEqual(materialUnitSchema.parse("paket"), "paket");

// calculationsExport — backwards compatible (no materials fields)
{
  const result = calculationsExportSchema.parse({
    version: { contractVersion: "1.0.0" },
    exportedAt: "2026-05-19T00:00:00.000Z",
    groups: [],
    records: [],
  });
  assertEqual(result.records.length, 0);
}

// calculationsExport — with materials
{
  const result = calculationsExportSchema.parse({
    version: { contractVersion: "1.0.0" },
    exportedAt: "2026-05-19T00:00:00.000Z",
    groups: [],
    records: [],
    materialCategories: [{ id: "c", title: "C" }],
    materials: [{ id: "c--m", categoryId: "c", name: "M", source: "user" }],
    materialAssignments: [],
  });
  assertEqual(result.materialCategories?.length ?? 0, 1);
}
