// Local re-declarations — do NOT import from @elektroplan/contracts at runtime.

export interface SettingRecord {
  readonly key: string;
  readonly value: unknown;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface VoltageDropProfileSummary {
  readonly id: string;
  readonly titleKey: string;
  readonly titleTr: string;
  readonly limitPercent: number;
}

export interface ExportPayloadBundle {
  readonly records?: readonly CalculationRecord[];
  readonly groups?: readonly CalculationGroup[];
  readonly resultDocument?: unknown;
}

export interface ExportPdfPayload {
  readonly presentation: unknown;
}

export type ExportResult =
  | { readonly canceled: true }
  | { readonly canceled: false; readonly path: string };

// ── Warning / Assumption ──────────────────────────────────────────────────────
export interface WarningEntry {
  readonly code: string;
  readonly messageKey: string;
  readonly detail?: string;
}

export interface AssumptionEntry {
  readonly field: string;
  readonly usedValue: string | number;
  readonly source: "user" | "estimated" | "default";
}

// ── Motor ─────────────────────────────────────────────────────────────────────
export type MotorPhase = 1 | 3;
export type MotorVoltageMode = "LL" | "LN";

export interface MotorFormulaRequest {
  mode: "formula";
  phase: MotorPhase;
  P_out?: number;
  voltage?: number;
  cosPhi?: number;
  efficiencyPercent?: number;
  voltageMode?: MotorVoltageMode;
}

export interface MotorTableRequest {
  mode: "table";
  kW: number;
  voltage: 220 | 380;
}

export type MotorRequest = MotorFormulaRequest | MotorTableRequest;

export interface MotorFormulaOutput {
  mode: "formula";
  phase: MotorPhase;
  voltage: number;
  cosPhi: number;
  efficiencyPercent: number;
  P_out: number;
  inputPowerKW: number;
  apparentPowerKVA: number;
  currentA: number;
  voltageMode?: MotorVoltageMode;
  suggestedCableSection?: MotorSuggestedCableSection;
}

export interface MotorTableOutput {
  mode: "table";
  kW: number;
  PS: number;
  cosPhi: number;
  efficiencyPercent: number;
  currentA: number;
  cableSpec: string;
}

export type MotorOutput = MotorFormulaOutput | MotorTableOutput;

export interface MotorResponse {
  value: MotorOutput;
  warnings: WarningEntry[];
  assumptions: AssumptionEntry[];
  formulaVariant: string;
  dataVersion: string;
  engineVersion: string;
}

// ── Voltage Drop ──────────────────────────────────────────────────────────────
export type VoltageDropSystemType =
  | "single-phase-ac-two-conductor"
  | "dc-two-conductor"
  | "three-phase-ac-ll"
  | "three-phase-ac-ln";

export type VoltageDropImpedanceMode = "simplified" | "exact-ac";

export interface VoltageDropCurrentRequest {
  mode: "current";
  systemType: VoltageDropSystemType;
  impedanceMode: VoltageDropImpedanceMode;
  conductorMaterial: "copper" | "aluminum";
  lengthM: number;
  sectionMm2: number;
  baseVoltageV: number;
  currentA: number;
  cosPhi?: number;
  parallelConductors?: number;
  conductorTempC?: number;
  reactanceOhmPerKm?: number;
}

export interface VoltageDropPowerRequest {
  mode: "power";
  systemType: VoltageDropSystemType;
  impedanceMode: VoltageDropImpedanceMode;
  conductorMaterial: "copper" | "aluminum";
  lengthM: number;
  sectionMm2: number;
  baseVoltageV: number;
  powerKW: number;
  cosPhi?: number;
  parallelConductors?: number;
  conductorTempC?: number;
  reactanceOhmPerKm?: number;
}

export type VoltageDropRequest = VoltageDropCurrentRequest | VoltageDropPowerRequest;

export interface VoltageDropOutput {
  mode: "current" | "power";
  systemType: VoltageDropSystemType;
  impedanceMode: VoltageDropImpedanceMode;
  conductorMaterial: "copper" | "aluminum";
  lengthM: number;
  sectionMm2: number;
  baseVoltageV: number;
  currentA: number;
  cosPhi?: number;
  sinPhi?: number;
  parallelConductors: number;
  conductorTempC?: number;
  resistance20OhmPerKm: number;
  resistanceOhmPerKm: number;
  reactanceOhmPerKm: number;
  deltaVVolts: number;
  deltaVPercent: number;
}

export interface VoltageDropResponse {
  value: VoltageDropOutput;
  warnings: WarningEntry[];
  assumptions: AssumptionEntry[];
  formulaVariant: string;
  dataVersion: string;
  engineVersion: string;
}

// ── Cable ─────────────────────────────────────────────────────────────────────
export type CableVoltageDropSystemType =
  | "single-phase-ac-two-conductor"
  | "three-phase-ac-ll"
  | "three-phase-ac-ln";

export type InstallationMethod = "A1" | "A2" | "B1" | "B2" | "C" | "D" | "E";

export interface CableVoltageDropRequest {
  mode: "current";
  systemType: CableVoltageDropSystemType;
  impedanceMode: VoltageDropImpedanceMode;
  lengthM: number;
  baseVoltageV: number;
  parallelConductors?: number;
  conductorTempC?: number;
  reactanceOhmPerKm?: number;
  cosPhi?: number;
}

export interface CableRequest {
  designCurrentA: number;
  phase: 1 | 3;
  conductorMaterial: "copper" | "aluminum";
  installationMethod: InstallationMethod;
  insulationRating: "XLPE/EPR";
  ambientTemperatureC: number;
  groupedCircuits: number;
  thirdHarmonicPercent: number;
  voltageDropLimitPercent: number;
  voltageDrop: CableVoltageDropRequest;
  extraCorrectionFactor?: number;
}

export interface CandidateStep {
  sectionMm2: number;
  baseAmpacityA: number | null;
  correctedAmpacityA: number | null;
  thermalPass: boolean;
  vdPass: boolean;
  accepted: boolean;
  vdResult: VoltageDropResponse;
}

export interface CableOutput {
  selectedSectionMm2: number;
  baseAmpacityA: number;
  correctedAmpacityA: number;
  designCurrentA: number;
  sizingCurrentA: number;
  loadedConductors: number;
  harmonicSizingBasis: "design-current" | "neutral-current";
  kT: number;
  kG: number;
  kH: number;
  kTotal: number;
  izRequiredA: number;
  voltageDropLimitPercent: number;
  preliminaryEstimate: {
    kind: "preliminary-j-hint";
    referenceCurrentA: number;
    currentDensityAperMm2: number;
    correctionFactorProduct: number;
    estimatedSectionMm2: number;
  };
  vdResult: VoltageDropResponse;
  candidateTrace: CandidateStep[];
}

export interface CableResponse {
  value: CableOutput;
  warnings: WarningEntry[];
  assumptions: AssumptionEntry[];
  formulaVariant: string;
  dataVersion: string;
  engineVersion: string;
}

export type CableRulerAmbient = "toprak_20C" | "hava_30C";

export interface CableRulerRequest {
  designCurrentA: number;
  ambient: CableRulerAmbient;
}

export interface CableRulerEntryDto {
  nominal_kesit_mm2: string;
  sectionMm2: number;
  dis_cap_mm: number;
  net_agirlik_kg_km: number;
  sevk_uzunlugu_m: number;
  dc_direnc_ohm_km_20C: number;
  akim_toprak_20C_A: number | null;
  akim_hava_30C_A: number | null;
}

export interface CableRulerOutput {
  mode: "ruler";
  designCurrentA: number;
  ambient: CableRulerAmbient;
  selected: CableRulerEntryDto;
  selectedAmpacityA: number;
}

export interface CableRulerResponse {
  value: CableRulerOutput;
  warnings: WarningEntry[];
  assumptions: AssumptionEntry[];
  formulaVariant: string;
  dataVersion: string;
  engineVersion: string;
}

export interface GroupCableSuggestionEntry {
  sectionMm2: number;
  label: string;
  ambient: CableRulerAmbient;
  ampacityA: number;
  standardHintMm2?: 2.5 | 4;
}

export interface GroupCableSuggestionResult {
  toprak_20C: GroupCableSuggestionEntry | null;
  hava_30C: GroupCableSuggestionEntry | null;
}

export interface MotorSuggestedCableSection {
  sectionMm2: number;
  label: string;
  ambient: CableRulerAmbient;
  ampacityA: number;
  standardHintMm2?: 2.5 | 4;
}

// ── Protection ────────────────────────────────────────────────────────────────
export interface ProtectionRequest {
  minimumNominalCurrentA: number;
  families?: ("MCB" | "MCCB" | "RCD" | "RCBO")[];
  poles?: number;
  voltageV?: number;
  curve?: "B" | "C" | "D";
  residualCurrentMa?: number;
  limit?: number;
}

export type ProtectionResponse = unknown[];

// ── Records / Groups ──────────────────────────────────────────────────────────
export type CalculatorKind = "motor" | "voltage-drop" | "cable" | "protection";

export interface RecordVersion {
  contractVersion: string;
  engineVersion?: string;
  dataVersion?: string;
}

export interface GroupingMetadata {
  groupId?: string;
  groupPath?: string[];
  groupTitle?: string;
  order?: number;
  quantity?: number;
  tags?: string[];
}

export interface MotorCalculationRecord {
  id: string;
  calculator: "motor";
  title?: string;
  grouping?: GroupingMetadata;
  version: RecordVersion;
  input: MotorRequest;
  output: MotorResponse;
}

export interface VoltageDropCalculationRecord {
  id: string;
  calculator: "voltage-drop";
  title?: string;
  grouping?: GroupingMetadata;
  version: RecordVersion;
  input: VoltageDropRequest;
  output: VoltageDropResponse;
}

export interface CableCalculationRecord {
  id: string;
  calculator: "cable";
  title?: string;
  grouping?: GroupingMetadata;
  version: RecordVersion;
  input: CableRequest;
  output: CableResponse;
}

export interface ProtectionCalculationRecord {
  id: string;
  calculator: "protection";
  title?: string;
  grouping?: GroupingMetadata;
  version: RecordVersion;
  input: ProtectionRequest;
  output: ProtectionResponse;
}

export type CalculationRecord =
  | MotorCalculationRecord
  | VoltageDropCalculationRecord
  | CableCalculationRecord
  | ProtectionCalculationRecord;

export interface CalculationGroup {
  id: string;
  title: string;
  parentGroupId?: string;
  order?: number;
  tags?: string[];
  version: RecordVersion;
}

// ── Motor table DTO ───────────────────────────────────────────────────────────
export interface MotorTableEntryDto {
  kW: number;
  PS: number;
  cosPhi: number;
  efficiencyPercent: number;
  currentA_220V: number;
  currentA_380V: number | null;
  cableSpec: string;
}

// ── Materials / Assignments ───────────────────────────────────────────────────
export interface MaterialCategory {
  id: string; title: string; orderValue?: number; iconKey?: string;
}

export interface Material {
  id: string; categoryId: string; name: string; orderValue?: number;
  brand?: string; modelCode?: string; unit?: string; unitPrice?: number;
  stockQty?: number; notes?: string; attributes?: Record<string, unknown>;
  source: "seed" | "user"; seedDataVersion?: string;
}

export interface MaterialAssignment {
  id: string; recordId: string; materialId: string | null;
  quantity: number; unit?: string;
  snapshotName: string; snapshotCategoryId: string; snapshotCategoryTitle: string;
  snapshotBrand?: string; snapshotModelCode?: string;
  snapshotUnitPrice?: number; snapshotAttributes?: Record<string, unknown>;
  orderValue?: number;
}

export interface ImportSummary {
  categoriesAdded: number; materialsAdded: number; materialsUpdated: number; untouched: number;
}

// ── Bridge ────────────────────────────────────────────────────────────────────
export interface ElektroPlanBridge {
  readonly runtime: Readonly<{
    platform: string;
    versions: Readonly<{ chrome: string; electron: string; node: string }>;
  }>;
  readonly calc: Readonly<{
    motor(request: MotorRequest): Promise<MotorResponse>;
    voltageDrop(request: VoltageDropRequest): Promise<VoltageDropResponse>;
    cable(request: CableRequest): Promise<CableResponse>;
    cableRuler(request: CableRulerRequest): Promise<CableRulerResponse>;
    groupCableSuggest(groupTotalCurrentA: number): Promise<GroupCableSuggestionResult>;
    protection(request: ProtectionRequest): Promise<ProtectionResponse>;
  }>;
  readonly data: Readonly<{
    motorTable(): Promise<readonly MotorTableEntryDto[]>;
    cableRulerTable(): Promise<readonly CableRulerEntryDto[]>;
    voltageDropProfiles(): Promise<readonly VoltageDropProfileSummary[]>;
    defaultVoltageDropProfile(): Promise<VoltageDropProfileSummary>;
    installationMethods(): Promise<readonly string[]>;
  }>;
  readonly records: Readonly<{
    list(options?: { groupId?: string }): Promise<readonly CalculationRecord[]>;
    get(id: string): Promise<CalculationRecord | null>;
    save(record: CalculationRecord): Promise<CalculationRecord>;
    delete(id: string): Promise<boolean>;
  }>;
  readonly groups: Readonly<{
    list(): Promise<readonly CalculationGroup[]>;
    save(group: CalculationGroup): Promise<CalculationGroup>;
    delete(id: string): Promise<boolean>;
    duplicate(sourceGroupId: string, newTitle: string): Promise<CalculationGroup>;
  }>;
  readonly export: Readonly<{
    json(bundle: ExportPayloadBundle): Promise<ExportResult>;
    excel(bundle: ExportPayloadBundle): Promise<ExportResult>;
    pdf(bundle: ExportPdfPayload): Promise<ExportResult>;
  }>;
  readonly settings: Readonly<{
    get(key: string): Promise<SettingRecord | null>;
    set(key: string, value: unknown): Promise<SettingRecord>;
    list(): Promise<readonly SettingRecord[]>;
    delete(key: string): Promise<boolean>;
  }>;
  readonly app: Readonly<{
    engineVersion(): Promise<string>;
  }>;
  readonly materials: Readonly<{
    listCategories(): Promise<readonly MaterialCategory[]>;
    upsertCategory(cat: MaterialCategory): Promise<MaterialCategory>;
    deleteCategory(id: string): Promise<boolean>;
    list(filter?: { categoryId?: string; search?: string }): Promise<readonly Material[]>;
    upsert(material: Material): Promise<Material>;
    delete(id: string): Promise<boolean>;
    importExcel(filePath: string, mode?: "merge"): Promise<ImportSummary>;
    pickExcel(): Promise<string | null>;
  }>;
  readonly assignments: Readonly<{
    listForRecords(recordIds: string[]): Promise<readonly MaterialAssignment[]>;
    upsert(assignment: MaterialAssignment): Promise<MaterialAssignment>;
    delete(id: string): Promise<boolean>;
  }>;
}

declare global {
  interface Window {
    elektroPlan?: ElektroPlanBridge;
  }
}
