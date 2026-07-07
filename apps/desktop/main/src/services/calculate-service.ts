import {
  calculateCableSizing,
  calculateMotorCurrent,
  selectCableSectionFromRuler,
  suggestGroupCableSections,
  calculateVoltageDrop,
  calculateVoltageDropGroup,
  recommendProtectionDevices,
  ENGINE_VERSION,
} from "@elektroplan/calculation-core";
import type {
  CableSizingInput,
  MotorCurrentInput,
  MotorCurrentResult,
  CableSizingResult,
  GroupCableSuggestionResult,
  ProtectionDeviceCandidate,
  VoltageDropGroupInput,
  VoltageDropGroupResult,
  VoltageDropInput,
  VoltageDropResult,
} from "@elektroplan/calculation-core";
import {
  getDefaultProfile,
  getCableRulerEntries,
  getMotorTableEntries,
  getVoltageDropProfiles,
  INSTALLATION_METHOD_CODES,
  type CableRulerEntry,
  type InstallationMethodCode,
  type MotorTableEntry,
  type VoltageDropProfile,
} from "@elektroplan/calculation-data";
import {
  cableRequestSchema,
  cableRulerRequestSchema,
  motorRequestSchema,
  protectionRequestSchema,
  voltageDropGroupRequestSchema,
  voltageDropRequestSchema,
  type CableRequest,
  type CableRulerRequest,
  type CableRulerResponse,
  type MotorRequest,
  type ProtectionRequest,
  type VoltageDropGroupRequest,
  type VoltageDropRequest,
} from "@elektroplan/contracts";

export interface CalculateService {
  runMotor(request: unknown): MotorCurrentResult;
  runVoltageDrop(request: unknown): VoltageDropResult;
  runVoltageDropGroup(request: unknown): VoltageDropGroupResult;
  runCable(request: unknown): CableSizingResult;
  runCableRuler(request: unknown): CableRulerResponse;
  runGroupCableSuggest(groupTotalCurrentA: number): GroupCableSuggestionResult;
  runProtection(request: unknown): readonly ProtectionDeviceCandidate[];
  listCableRulerEntries(): readonly CableRulerEntry[];
  listMotorTableEntries(): readonly MotorTableEntry[];
  listVoltageDropProfiles(): readonly VoltageDropProfile[];
  getDefaultVoltageDropProfile(): VoltageDropProfile;
  getInstallationMethods(): readonly InstallationMethodCode[];
}

function stripUndefined<T extends Record<string, unknown>>(value: T): T {
  const out: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (entry !== undefined) {
      out[key] = entry;
    }
  }
  return out as T;
}

function stripUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((entry) => stripUndefinedDeep(entry)) as T;
  }

  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (entry !== undefined) {
        out[key] = stripUndefinedDeep(entry);
      }
    }
    return out as T;
  }

  return value;
}

function toMotorInput(request: MotorRequest): MotorCurrentInput {
  return stripUndefined(request) as MotorCurrentInput;
}

function toVoltageDropInput(request: VoltageDropRequest): VoltageDropInput {
  return stripUndefined(request) as VoltageDropInput;
}

function toVoltageDropGroupInput(
  request: VoltageDropGroupRequest,
): VoltageDropGroupInput {
  return stripUndefinedDeep(request) as VoltageDropGroupInput;
}

function mapInsulationRating(
  rating: CableRequest["insulationRating"],
): CableSizingInput["insulationRating"] {
  if (rating === "XLPE/EPR") {
    return "XLPE_EPR_90C";
  }
  throw new RangeError(`Unsupported insulation rating: ${String(rating)}`);
}

function toCableInput(request: CableRequest): CableSizingInput {
  const { voltageDrop, insulationRating, ...rest } = request;
  const base = stripUndefined(rest);
  return {
    ...base,
    insulationRating: mapInsulationRating(insulationRating),
    voltageDrop: stripUndefined(voltageDrop) as CableSizingInput["voltageDrop"],
  } as CableSizingInput;
}

function toProtectionQuery(
  request: ProtectionRequest,
): Parameters<typeof recommendProtectionDevices>[0] {
  return stripUndefined(request) as Parameters<
    typeof recommendProtectionDevices
  >[0];
}

export function createCalculateService(): CalculateService {
  return {
    runMotor(request: unknown): MotorCurrentResult {
      const parsed: MotorRequest = motorRequestSchema.parse(request);
      return calculateMotorCurrent(toMotorInput(parsed));
    },
    runVoltageDrop(request: unknown): VoltageDropResult {
      const parsed: VoltageDropRequest = voltageDropRequestSchema.parse(request);
      return calculateVoltageDrop(toVoltageDropInput(parsed));
    },
    runVoltageDropGroup(request: unknown): VoltageDropGroupResult {
      const parsed: VoltageDropGroupRequest = voltageDropGroupRequestSchema.parse(request);
      return calculateVoltageDropGroup(toVoltageDropGroupInput(parsed));
    },
    runCable(request: unknown): CableSizingResult {
      const parsed: CableRequest = cableRequestSchema.parse(request);
      return calculateCableSizing(toCableInput(parsed));
    },
    runCableRuler(request: unknown): CableRulerResponse {
      const parsed: CableRulerRequest = cableRulerRequestSchema.parse(request);
      const selection = selectCableSectionFromRuler(parsed);
      return {
        value: {
          mode: "ruler",
          designCurrentA: parsed.designCurrentA,
          ambient: parsed.ambient,
          selected: selection.selected,
          selectedAmpacityA: selection.selectedAmpacityA,
        },
        warnings: [],
        assumptions: [],
        formulaVariant: `cable-ruler-${parsed.ambient}`,
        engineVersion: ENGINE_VERSION,
        dataVersion: selection.dataVersion,
      };
    },
    runGroupCableSuggest(groupTotalCurrentA: number): GroupCableSuggestionResult {
      if (!Number.isFinite(groupTotalCurrentA)) {
        throw new TypeError("groupTotalCurrentA must be a finite number.");
      }

      return suggestGroupCableSections({ groupTotalCurrentA });
    },
    runProtection(request: unknown): readonly ProtectionDeviceCandidate[] {
      const parsed: ProtectionRequest = protectionRequestSchema.parse(request);
      return recommendProtectionDevices(toProtectionQuery(parsed));
    },
    listCableRulerEntries(): readonly CableRulerEntry[] {
      return getCableRulerEntries();
    },
    listMotorTableEntries(): readonly MotorTableEntry[] {
      return getMotorTableEntries();
    },
    listVoltageDropProfiles(): readonly VoltageDropProfile[] {
      return getVoltageDropProfiles();
    },
    getDefaultVoltageDropProfile(): VoltageDropProfile {
      return getDefaultProfile();
    },
    getInstallationMethods(): readonly InstallationMethodCode[] {
      return INSTALLATION_METHOD_CODES;
    },
  };
}
