import { z } from "zod";

export const installationMethodValues = ["A1", "A2", "B1", "B2", "C", "D", "E"] as const;
export const installationMethodSchema = z.enum(installationMethodValues);

export const ampacityMaterialSchema = z.enum(["copper", "aluminum"]);
export const conductorMaterialSchema = ampacityMaterialSchema;
export const insulationRatingSchema = z.literal("XLPE/EPR");
export const harmonicSizingCurrentBasisSchema = z.enum(["design-current", "neutral-current"]);

export const protectionDeviceFamilySchema = z.enum(["MCB", "MCCB", "RCD", "RCBO"]);
export const protectionDeviceCurveSchema = z.enum(["B", "C", "D"]);

export const warningEntrySchema = z
  .object({
    code: z.string(),
    messageKey: z.string(),
    detail: z.string().optional(),
  })
  .strict();

export const assumptionEntrySchema = z
  .object({
    field: z.string(),
    usedValue: z.union([z.string(), z.number()]),
    source: z.enum(["user", "estimated", "default"]),
  })
  .strict();

export const calculationResultVersionSchema = z
  .object({
    dataVersion: z.string(),
    engineVersion: z.string(),
  })
  .strict();

export function createCalculationResultSchema<T extends z.ZodTypeAny>(valueSchema: T) {
  return z
    .object({
      value: valueSchema,
      warnings: z.array(warningEntrySchema),
      assumptions: z.array(assumptionEntrySchema),
      formulaVariant: z.string(),
      dataVersion: z.string(),
      engineVersion: z.string(),
    })
    .strict();
}

export const motorPhaseSchema = z.union([z.literal(1), z.literal(3)]);
export const motorVoltageModeSchema = z.enum(["LL", "LN"]);
export const motorCurrentModeSchema = z.enum(["formula", "table"]);
export const motorTableVoltageSchema = z.union([z.literal(220), z.literal(380)]);
export const cableRulerAmbientSchema = z.enum(["toprak_20C", "hava_30C"]);

export const motorFormulaRequestSchema = z
  .object({
    mode: z.literal("formula"),
    phase: motorPhaseSchema,
    P_out: z.number().optional(),
    voltage: z.number().optional(),
    cosPhi: z.number().optional(),
    efficiencyPercent: z.number().optional(),
    voltageMode: motorVoltageModeSchema.optional(),
  })
  .strict();

export const motorTableRequestSchema = z
  .object({
    mode: z.literal("table"),
    kW: z.number(),
    voltage: motorTableVoltageSchema,
  })
  .strict();

export const motorRequestSchema = z.discriminatedUnion("mode", [
  motorFormulaRequestSchema,
  motorTableRequestSchema,
]);

export const motorSuggestedCableSectionSchema = z
  .object({
    sectionMm2: z.number().positive(),
    label: z.string(),
    ambient: cableRulerAmbientSchema,
    ampacityA: z.number().positive(),
    standardHintMm2: z.union([z.literal(2.5), z.literal(4)]).optional(),
  })
  .strict();

export const motorFormulaOutputSchema = z
  .object({
    mode: z.literal("formula"),
    phase: motorPhaseSchema,
    voltage: z.number(),
    cosPhi: z.number(),
    efficiencyPercent: z.number(),
    P_out: z.number(),
    inputPowerKW: z.number(),
    apparentPowerKVA: z.number(),
    currentA: z.number(),
    voltageMode: motorVoltageModeSchema.optional(),
    suggestedCableSection: motorSuggestedCableSectionSchema.optional(),
  })
  .strict();

export const motorTableOutputSchema = z
  .object({
    mode: z.literal("table"),
    kW: z.number(),
    PS: z.number(),
    cosPhi: z.number(),
    efficiencyPercent: z.number(),
    currentA: z.number(),
    cableSpec: z.string(),
  })
  .strict();

export const motorOutputSchema = z.discriminatedUnion("mode", [
  motorFormulaOutputSchema,
  motorTableOutputSchema,
]);

export const motorResponseSchema = createCalculationResultSchema(motorOutputSchema);

export const voltageDropSystemTypeSchema = z.enum([
  "single-phase-ac-two-conductor",
  "dc-two-conductor",
  "three-phase-ac-ll",
  "three-phase-ac-ln",
]);
export const voltageDropImpedanceModeSchema = z.enum(["simplified", "exact-ac"]);
export const voltageDropLoadModeSchema = z.enum(["current", "power"]);

const voltageDropInputBaseSchema = z
  .object({
    systemType: voltageDropSystemTypeSchema,
    impedanceMode: voltageDropImpedanceModeSchema,
    conductorMaterial: conductorMaterialSchema,
    lengthM: z.number(),
    sectionMm2: z.number(),
    baseVoltageV: z.number(),
    parallelConductors: z.number().optional(),
    conductorTempC: z.number().optional(),
    reactanceOhmPerKm: z.number().optional(),
  })
  .strict();

export const voltageDropCurrentRequestSchema = voltageDropInputBaseSchema.extend({
  mode: z.literal("current"),
  currentA: z.number(),
  cosPhi: z.number().optional(),
});

export const voltageDropPowerRequestSchema = voltageDropInputBaseSchema.extend({
  mode: z.literal("power"),
  powerKW: z.number(),
  cosPhi: z.number().optional(),
});

export const voltageDropRequestSchema = z.discriminatedUnion("mode", [
  voltageDropCurrentRequestSchema,
  voltageDropPowerRequestSchema,
]);

export const voltageDropOutputSchema = z
  .object({
    mode: voltageDropLoadModeSchema,
    systemType: voltageDropSystemTypeSchema,
    impedanceMode: voltageDropImpedanceModeSchema,
    conductorMaterial: conductorMaterialSchema,
    lengthM: z.number(),
    sectionMm2: z.number(),
    baseVoltageV: z.number(),
    currentA: z.number(),
    cosPhi: z.number().optional(),
    sinPhi: z.number().optional(),
    parallelConductors: z.number(),
    conductorTempC: z.number().optional(),
    resistance20OhmPerKm: z.number(),
    resistanceOhmPerKm: z.number(),
    reactanceOhmPerKm: z.number(),
    deltaVVolts: z.number(),
    deltaVPercent: z.number(),
  })
  .strict();

export const voltageDropResponseSchema = createCalculationResultSchema(voltageDropOutputSchema);

export const voltageDropGroupPhaseModeSchema = z.enum([
  "auto",
  "single-phase",
  "three-phase",
]);
export const voltageDropGroupSystemTypeSchema = z.enum([
  "single-phase-ac-two-conductor",
  "three-phase-ac-ll",
]);
export const voltageDropGroupInsulationRatingSchema = z.enum([
  "PVC_70C",
  "XLPE_EPR_90C",
]);

export const voltageDropGroupSegmentRequestSchema = z
  .object({
    id: z.string().min(1).optional(),
    parentId: z.string().min(1).nullable().optional(),
    title: z.string().min(1),
    loadPowerKW: z.number().positive().optional(),
    localPowerKW: z.number().positive().optional(),
    lengthM: z.number().positive(),
    fixedSectionKey: z.string().min(1).optional(),
    sectionMm2: z.number().positive().optional(),
    settings: z
      .object({
        cosPhi: z.number().optional(),
        efficiencyPercent: z.number().optional(),
        conductorMaterial: ampacityMaterialSchema.optional(),
        installationMethod: installationMethodSchema.optional(),
        insulationRating: voltageDropGroupInsulationRatingSchema.optional(),
        ambientTemperatureC: z.number().optional(),
        groupedCircuits: z.number().optional(),
        thirdHarmonicPercent: z.number().optional(),
        conductorTempC: z.number().optional(),
        impedanceMode: voltageDropImpedanceModeSchema.optional(),
        reactanceOhmPerKm: z.number().optional(),
        terminalLossFactor: z.number().optional(),
      })
      .strict()
      .optional(),
  })
  .strict()
  .refine((segment) => segment.loadPowerKW !== undefined || segment.localPowerKW !== undefined, {
    message: "loadPowerKW is required.",
  });

export const voltageDropGroupSettingsRequestSchema = z
  .object({
    limitPercent: z.number().optional(),
    phaseMode: voltageDropGroupPhaseModeSchema.optional(),
    singlePhaseVoltageV: z.number().optional(),
    threePhaseVoltageV: z.number().optional(),
    cosPhi: z.number().optional(),
    efficiencyPercent: z.number().optional(),
    conductorMaterial: ampacityMaterialSchema.optional(),
    installationMethod: installationMethodSchema.optional(),
    insulationRating: voltageDropGroupInsulationRatingSchema.optional(),
    ambientTemperatureC: z.number().optional(),
    groupedCircuits: z.number().optional(),
    thirdHarmonicPercent: z.number().optional(),
    conductorTempC: z.number().optional(),
    impedanceMode: voltageDropImpedanceModeSchema.optional(),
    reactanceOhmPerKm: z.number().optional(),
    terminalLossFactor: z.number().optional(),
  })
  .strict();

export const voltageDropGroupRequestSchema = z
  .object({
    title: z.string().min(1).optional(),
    segments: z.array(voltageDropGroupSegmentRequestSchema),
    settings: voltageDropGroupSettingsRequestSchema.optional(),
  })
  .strict();

export const voltageDropGroupResolvedSettingsSchema = z
  .object({
    limitPercent: z.number(),
    phaseMode: voltageDropGroupPhaseModeSchema,
    systemType: voltageDropGroupSystemTypeSchema,
    baseVoltageV: z.number(),
    cosPhi: z.number(),
    efficiencyPercent: z.number(),
    conductorMaterial: ampacityMaterialSchema,
    installationMethod: installationMethodSchema,
    insulationRating: voltageDropGroupInsulationRatingSchema,
    ambientTemperatureC: z.number(),
    groupedCircuits: z.number(),
    thirdHarmonicPercent: z.number(),
    conductorTempC: z.number(),
    impedanceMode: voltageDropImpedanceModeSchema,
    reactanceOhmPerKm: z.number().optional(),
    terminalLossFactor: z.number(),
  })
  .strict();

export const voltageDropGroupSegmentOutputSchema = z
  .object({
    id: z.string().min(1).optional(),
    parentId: z.string().min(1).nullable().optional(),
    title: z.string().min(1),
    order: z.number().int(),
    depth: z.number().int().nonnegative().optional(),
    childIds: z.array(z.string().min(1)).optional(),
    pathIds: z.array(z.string().min(1)).optional(),
    loadPowerKW: z.number().positive().optional(),
    localPowerKW: z.number().positive(),
    flowPowerKW: z.number().positive(),
    lengthM: z.number(),
    currentA: z.number(),
    selectedSectionKey: z.string().min(1).optional(),
    selectedSectionAreaMm2: z.number().positive().optional(),
    selectedParallelRuns: z.number().int().positive().optional(),
    selectedSectionMm2: z.number().positive(),
    fixedSection: z.boolean().optional(),
    settings: z
      .object({
        cosPhi: z.number(),
        efficiencyPercent: z.number(),
        conductorMaterial: ampacityMaterialSchema,
        installationMethod: installationMethodSchema,
        insulationRating: voltageDropGroupInsulationRatingSchema,
        ambientTemperatureC: z.number(),
        groupedCircuits: z.number(),
        thirdHarmonicPercent: z.number(),
        conductorTempC: z.number(),
        impedanceMode: voltageDropImpedanceModeSchema,
        reactanceOhmPerKm: z.number().optional(),
        terminalLossFactor: z.number(),
      })
      .strict()
      .optional(),
    baseAmpacityA: z.number(),
    correctedAmpacityA: z.number(),
    segmentDeltaVVolts: z.number(),
    segmentDeltaVPercent: z.number(),
    cumulativeDeltaVPercent: z.number(),
    thermalPass: z.boolean(),
    voltageDropPass: z.boolean(),
    compliant: z.boolean(),
  })
  .strict();

export const voltageDropGroupOptimizationStepSchema = z
  .object({
    iteration: z.number().int(),
    segmentOrder: z.number().int(),
    segmentTitle: z.string().min(1),
    fromSectionMm2: z.number(),
    toSectionMm2: z.number(),
    previousMaxCumulativeDeltaVPercent: z.number(),
    nextMaxCumulativeDeltaVPercent: z.number(),
    sensitivityIndex: z.number(),
  })
  .strict();

export const voltageDropGroupOutputSchema = z
  .object({
    title: z.string().min(1).optional(),
    settings: voltageDropGroupResolvedSettingsSchema,
    totalLocalPowerKW: z.number(),
    maxCumulativeDeltaVPercent: z.number(),
    isCompliant: z.boolean(),
    segments: z.array(voltageDropGroupSegmentOutputSchema),
    optimizationSteps: z.array(voltageDropGroupOptimizationStepSchema),
  })
  .strict();

export const voltageDropGroupResponseSchema =
  createCalculationResultSchema(voltageDropGroupOutputSchema);

export const cablePhaseSchema = z.union([z.literal(1), z.literal(3)]);

export const cableVoltageDropSystemTypeSchema = z.enum([
  "single-phase-ac-two-conductor",
  "three-phase-ac-ll",
  "three-phase-ac-ln",
]);

export const cableVoltageDropRequestSchema = z
  .object({
    mode: z.literal("current"),
    systemType: cableVoltageDropSystemTypeSchema,
    impedanceMode: voltageDropImpedanceModeSchema,
    lengthM: z.number(),
    baseVoltageV: z.number(),
    parallelConductors: z.number().optional(),
    conductorTempC: z.number().optional(),
    reactanceOhmPerKm: z.number().optional(),
    cosPhi: z.number().optional(),
  })
  .strict();

export const preliminaryCableEstimateSchema = z
  .object({
    kind: z.literal("preliminary-j-hint"),
    referenceCurrentA: z.number(),
    currentDensityAperMm2: z.number(),
    correctionFactorProduct: z.number(),
    estimatedSectionMm2: z.number(),
  })
  .strict();

export const cableRequestSchema = z
  .object({
    designCurrentA: z.number(),
    phase: cablePhaseSchema,
    conductorMaterial: ampacityMaterialSchema,
    installationMethod: installationMethodSchema,
    insulationRating: insulationRatingSchema,
    ambientTemperatureC: z.number(),
    groupedCircuits: z.number(),
    thirdHarmonicPercent: z.number(),
    voltageDropLimitPercent: z.number(),
    voltageDrop: cableVoltageDropRequestSchema,
    extraCorrectionFactor: z.number().optional(),
  })
  .strict();

export const candidateStepSchema = z
  .object({
    sectionMm2: z.number(),
    baseAmpacityA: z.number().nullable(),
    correctedAmpacityA: z.number().nullable(),
    thermalPass: z.boolean(),
    vdPass: z.boolean(),
    accepted: z.boolean(),
    vdResult: voltageDropResponseSchema,
  })
  .strict();

export const cableOutputSchema = z
  .object({
    selectedSectionMm2: z.number(),
    baseAmpacityA: z.number(),
    correctedAmpacityA: z.number(),
    designCurrentA: z.number(),
    sizingCurrentA: z.number(),
    loadedConductors: z.number(),
    harmonicSizingBasis: harmonicSizingCurrentBasisSchema,
    kT: z.number(),
    kG: z.number(),
    kH: z.number(),
    kTotal: z.number(),
    izRequiredA: z.number(),
    voltageDropLimitPercent: z.number(),
    preliminaryEstimate: preliminaryCableEstimateSchema,
    vdResult: voltageDropResponseSchema,
    candidateTrace: z.array(candidateStepSchema),
  })
  .strict();

export const cableResponseSchema = createCalculationResultSchema(cableOutputSchema);

export const cableRulerRequestSchema = z
  .object({
    designCurrentA: z.number().positive(),
    ambient: cableRulerAmbientSchema,
  })
  .strict();

export const cableRulerEntrySchema = z
  .object({
    nominal_kesit_mm2: z.string(),
    sectionMm2: z.number().positive(),
    dis_cap_mm: z.number(),
    net_agirlik_kg_km: z.number(),
    sevk_uzunlugu_m: z.number(),
    dc_direnc_ohm_km_20C: z.number(),
    akim_toprak_20C_A: z.number().nullable(),
    akim_hava_30C_A: z.number().nullable(),
  })
  .strict();

export const cableRulerOutputSchema = z
  .object({
    mode: z.literal("ruler"),
    designCurrentA: z.number().positive(),
    ambient: cableRulerAmbientSchema,
    selected: cableRulerEntrySchema,
    selectedAmpacityA: z.number().positive(),
  })
  .strict();

export const cableRulerResponseSchema =
  createCalculationResultSchema(cableRulerOutputSchema);

export const protectionCatalogEntrySchema = z
  .object({
    id: z.string(),
    family: protectionDeviceFamilySchema,
    poles: z.number(),
    nominalCurrentA: z.number(),
    breakingCapacityKa: z.number().nullable(),
    curve: protectionDeviceCurveSchema.nullable(),
    residualCurrentMa: z.number().nullable(),
    voltageV: z.number(),
    sourceNote: z.string(),
  })
  .strict();

export const protectionRequestSchema = z
  .object({
    minimumNominalCurrentA: z.number(),
    families: z.array(protectionDeviceFamilySchema).optional(),
    poles: z.number().optional(),
    voltageV: z.number().optional(),
    curve: protectionDeviceCurveSchema.optional(),
    residualCurrentMa: z.number().optional(),
    limit: z.number().optional(),
  })
  .strict();

export const protectionDeviceRatingsSchema = z
  .object({
    nominalCurrentA: z.number(),
    breakingCapacityKa: z.number().nullable(),
    residualCurrentMa: z.number().nullable(),
    voltageV: z.number(),
    poles: z.number(),
  })
  .strict();

export const protectionCandidateSchema = z
  .object({
    id: z.string(),
    family: protectionDeviceFamilySchema,
    curve: protectionDeviceCurveSchema.nullable(),
    ratings: protectionDeviceRatingsSchema,
    sourceNote: z.string(),
    device: protectionCatalogEntrySchema,
  })
  .strict();

export const protectionResponseSchema = z.array(protectionCandidateSchema);

export const calculatorKindSchema = z.enum([
  "motor",
  "voltage-drop",
  "voltage-drop-group",
  "cable",
  "protection",
  "manual-current",
]);

export const groupingMetadataSchema = z
  .object({
    groupId: z.string().min(1).optional(),
    groupPath: z.array(z.string().min(1)).optional(),
    groupTitle: z.string().min(1).optional(),
    order: z.number().int().optional(),
    tags: z.array(z.string().min(1)).optional(),
    quantity: z.number().int().min(1).optional(),
  })
  .strict();

export const recordVersionSchema = z
  .object({
    contractVersion: z.string(),
    engineVersion: z.string().optional(),
    dataVersion: z.string().optional(),
  })
  .strict();

const recordBaseSchema = z
  .object({
    id: z.string().min(1),
    calculator: calculatorKindSchema,
    title: z.string().min(1).optional(),
    grouping: groupingMetadataSchema.optional(),
    version: recordVersionSchema,
  })
  .strict();

export const motorCalculationRecordSchema = recordBaseSchema.extend({
  calculator: z.literal("motor"),
  input: motorRequestSchema,
  output: motorResponseSchema,
});

export const voltageDropCalculationRecordSchema = recordBaseSchema.extend({
  calculator: z.literal("voltage-drop"),
  input: voltageDropRequestSchema,
  output: voltageDropResponseSchema,
});

export const voltageDropGroupCalculationRecordSchema = recordBaseSchema.extend({
  calculator: z.literal("voltage-drop-group"),
  input: voltageDropGroupRequestSchema,
  output: voltageDropGroupResponseSchema,
});

export const cableCalculationRecordSchema = recordBaseSchema.extend({
  calculator: z.literal("cable"),
  input: cableRequestSchema,
  output: cableResponseSchema,
});

export const protectionCalculationRecordSchema = recordBaseSchema.extend({
  calculator: z.literal("protection"),
  input: protectionRequestSchema,
  output: protectionResponseSchema,
});

export const manualCurrentRequestSchema = z
  .object({
    currentA: z.number().finite().nonnegative(),
    label: z.string().min(1).optional(),
  })
  .strict();

export const manualCurrentResponseSchema = z
  .object({
    value: z.object({ currentA: z.number() }).strict(),
  })
  .strict();

export const manualCurrentCalculationRecordSchema = recordBaseSchema.extend({
  calculator: z.literal("manual-current"),
  input: manualCurrentRequestSchema,
  output: manualCurrentResponseSchema,
});

export const calculationRecordSchema = z.discriminatedUnion("calculator", [
  motorCalculationRecordSchema,
  voltageDropCalculationRecordSchema,
  voltageDropGroupCalculationRecordSchema,
  cableCalculationRecordSchema,
  protectionCalculationRecordSchema,
  manualCurrentCalculationRecordSchema,
]);

export const calculationGroupSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    parentGroupId: z.string().min(1).optional(),
    order: z.number().int().optional(),
    tags: z.array(z.string().min(1)).optional(),
    version: recordVersionSchema,
  })
  .strict();

export const materialUnitSchema = z.enum(["adet", "m", "kg", "set", "paket"]);

export const materialCategorySchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    orderValue: z.number().int().optional(),
    iconKey: z.string().optional(),
  })
  .strict();

export const materialSchema = z
  .object({
    id: z.string().min(1),
    categoryId: z.string().min(1),
    name: z.string().min(1),
    orderValue: z.number().int().optional(),
    brand: z.string().optional(),
    modelCode: z.string().optional(),
    unit: materialUnitSchema.optional(),
    unitPrice: z.number().nonnegative().optional(),
    stockQty: z.number().int().nonnegative().optional(),
    notes: z.string().optional(),
    attributes: z
      .record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))
      .optional(),
    source: z.enum(["seed", "user"]).default("user"),
    seedDataVersion: z.string().optional(),
  })
  .strict();

export const materialAssignmentSchema = z
  .object({
    id: z.string().min(1),
    recordId: z.string().min(1),
    materialId: z.string().nullable(),
    quantity: z.number().positive(),
    unit: materialUnitSchema.optional(),
    snapshotName: z.string().min(1),
    snapshotCategoryId: z.string().min(1),
    snapshotCategoryTitle: z.string().min(1),
    snapshotBrand: z.string().optional(),
    snapshotModelCode: z.string().optional(),
    snapshotUnitPrice: z.number().nonnegative().optional(),
    snapshotAttributes: z.record(z.string(), z.unknown()).optional(),
    orderValue: z.number().int().optional(),
  })
  .strict();

export const calculationsExportSchema = z
  .object({
    version: recordVersionSchema,
    exportedAt: z.string(),
    groups: z.array(calculationGroupSchema),
    records: z.array(calculationRecordSchema),
    materialCategories: z.array(materialCategorySchema).optional(),
    materials: z.array(materialSchema).optional(),
    materialAssignments: z.array(materialAssignmentSchema).optional(),
  })
  .strict();

export type InstallationMethod = z.infer<typeof installationMethodSchema>;

export type WarningEntryDto = z.infer<typeof warningEntrySchema>;
export type AssumptionEntryDto = z.infer<typeof assumptionEntrySchema>;
export type CalculationResultVersionDto = z.infer<typeof calculationResultVersionSchema>;

export type MotorRequest = z.infer<typeof motorRequestSchema>;
export type MotorOutput = z.infer<typeof motorOutputSchema>;
export type MotorResponse = z.infer<typeof motorResponseSchema>;
export type MotorSuggestedCableSection = z.infer<
  typeof motorSuggestedCableSectionSchema
>;

export type ManualCurrentRequest = z.infer<typeof manualCurrentRequestSchema>;
export type ManualCurrentResponse = z.infer<typeof manualCurrentResponseSchema>;

export type VoltageDropRequest = z.infer<typeof voltageDropRequestSchema>;
export type VoltageDropOutput = z.infer<typeof voltageDropOutputSchema>;
export type VoltageDropResponse = z.infer<typeof voltageDropResponseSchema>;
export type VoltageDropGroupPhaseMode = z.infer<
  typeof voltageDropGroupPhaseModeSchema
>;
export type VoltageDropGroupSystemType = z.infer<
  typeof voltageDropGroupSystemTypeSchema
>;
export type VoltageDropGroupInsulationRating = z.infer<
  typeof voltageDropGroupInsulationRatingSchema
>;
export type VoltageDropGroupSegmentRequest = z.infer<
  typeof voltageDropGroupSegmentRequestSchema
>;
export type VoltageDropGroupSettingsRequest = z.infer<
  typeof voltageDropGroupSettingsRequestSchema
>;
export type VoltageDropGroupRequest = z.infer<typeof voltageDropGroupRequestSchema>;
export type VoltageDropGroupResolvedSettings = z.infer<
  typeof voltageDropGroupResolvedSettingsSchema
>;
export type VoltageDropGroupSegmentOutput = z.infer<
  typeof voltageDropGroupSegmentOutputSchema
>;
export type VoltageDropGroupOptimizationStep = z.infer<
  typeof voltageDropGroupOptimizationStepSchema
>;
export type VoltageDropGroupOutput = z.infer<typeof voltageDropGroupOutputSchema>;
export type VoltageDropGroupResponse = z.infer<
  typeof voltageDropGroupResponseSchema
>;

export type CableRequest = z.infer<typeof cableRequestSchema>;
export type CableOutput = z.infer<typeof cableOutputSchema>;
export type CableResponse = z.infer<typeof cableResponseSchema>;
export type CableRulerAmbient = z.infer<typeof cableRulerAmbientSchema>;
export type CableRulerRequest = z.infer<typeof cableRulerRequestSchema>;
export type CableRulerEntryDto = z.infer<typeof cableRulerEntrySchema>;
export type CableRulerOutput = z.infer<typeof cableRulerOutputSchema>;
export type CableRulerResponse = z.infer<typeof cableRulerResponseSchema>;

export type ProtectionRequest = z.infer<typeof protectionRequestSchema>;
export type ProtectionCandidate = z.infer<typeof protectionCandidateSchema>;
export type ProtectionResponse = z.infer<typeof protectionResponseSchema>;

export type GroupingMetadata = z.infer<typeof groupingMetadataSchema>;
export type RecordVersion = z.infer<typeof recordVersionSchema>;
export type CalculationRecord = z.infer<typeof calculationRecordSchema>;
export type CalculationGroup = z.infer<typeof calculationGroupSchema>;
export type CalculationsExport = z.infer<typeof calculationsExportSchema>;

export type MaterialUnit = z.infer<typeof materialUnitSchema>;
export type MaterialCategory = z.infer<typeof materialCategorySchema>;
export type Material = z.infer<typeof materialSchema>;
export type MaterialAssignment = z.infer<typeof materialAssignmentSchema>;
