export {
  ALPHA_ALUMINUM_20,
  ALPHA_COPPER_20,
  HP_TO_KW,
  J_REF_ALUMINUM,
  J_REF_COPPER,
  RHO_ALUMINUM_20,
  RHO_COPPER_20,
  SQRT3,
  X_AC_FALLBACK_OHM_PER_KM,
} from "./common/constants/index.js";
export { roundForDisplay } from "./common/precision/index.js";
export type { EstimationStatus } from "./common/types/estimation.js";
export type {
  AssumptionEntry,
  CalculationResult,
  WarningEntry,
} from "./common/types/result.js";
export { hpToKw } from "./common/units/normalize.js";
export { assertInRange, assertOneOf, assertPositive } from "./common/validation/guards.js";
export {
  calculateCableSizing,
  calculateCableSizingAlgorithm,
  calculatePreliminaryCableEstimate,
  buildStandardSectionHint,
  determineLoadedConductors,
  lookupGroupingFactor,
  lookupHarmonicFactor,
  lookupTempFactor,
  selectCableSectionFromRuler,
  suggestGroupCableSections,
  CABLE_INSTALLATION_METHODS,
} from "./cable/index.js";
export type {
  CableRulerAmbient,
  CableRulerSelection,
  CableRulerSelectionInput,
  GroupCableSuggestionEntry,
  GroupCableSuggestionInput,
  GroupCableSuggestionResult,
  StandardSectionHint,
  StandardSectionHintInput,
  CableInstallationMethod,
  CablePhase,
  CableSizingInput,
  CableSizingOutput,
  CableSizingResult,
  CableVoltageDropInput,
  CandidateStep,
} from "./cable/index.js";
export {
  calcApparentPower,
  calcInputPower,
  calcSinglePhaseCurrent,
  calcThreePhaseLineLineCurrent,
  calcThreePhaseLineNeutralCurrent,
  calculateMotorCurrent,
  calculateMotorFromTable,
  getMotorTableDataVersion,
  validateMotorCurrentInput,
} from "./motor/index.js";
export type {
  FormulaModeInput,
  FormulaModeOutput,
  MotorCurrentInput,
  MotorCurrentMode,
  MotorCurrentOutput,
  MotorCurrentResult,
  MotorPhase,
  MotorSuggestedCableSection,
  MotorSuggestedCableSectionAmbient,
  MotorTableVoltage,
  MotorVoltageMode,
  TableModeInput,
  TableModeOutput,
} from "./motor/index.js";
export { recommendProtectionDevices } from "./protection/index.js";
export type {
  ProtectionDeviceCandidate,
  ProtectionDeviceRatings,
  ProtectionRecommendationQuery,
} from "./protection/index.js";
export {
  calcDCTwoConductorVoltageDrop,
  calcR20,
  calcRTheta,
  calcSinPhi,
  calcSinglePhaseACTwoConductorVoltageDrop,
  calcThreePhaseACLineLineVoltageDrop,
  calcThreePhaseACLineNeutralVoltageDrop,
  calculateCurrentFromPower,
  calculateVoltageDrop,
  deriveCurrentForVoltageDrop,
} from "./voltage-drop/index.js";
export type {
  ConductorMaterial,
  VoltageDropCurrentModeInput,
  VoltageDropImpedanceMode,
  VoltageDropInput,
  VoltageDropLoadMode,
  VoltageDropOutput,
  VoltageDropPowerModeInput,
  VoltageDropResult,
  VoltageDropSystemType,
} from "./voltage-drop/index.js";
export {
  calculateVoltageDropGroup,
  resolveVoltageDropGroupSettings,
  VOLTAGE_DROP_GROUP_DATA_VERSION,
  DEFAULT_VOLTAGE_DROP_GROUP_SETTINGS,
} from "./voltage-drop-group/index.js";
export type {
  VoltageDropGroupPhaseMode,
  VoltageDropGroupSystemType,
  VoltageDropGroupSegmentInput,
  VoltageDropGroupSettingsInput,
  VoltageDropGroupInput,
  VoltageDropGroupResolvedSettings,
  VoltageDropGroupSegmentOutput,
  VoltageDropGroupOptimizationStep,
  VoltageDropGroupOutput,
  VoltageDropGroupResult,
} from "./voltage-drop-group/index.js";
export {
  calculateVoltageDropTree,
  calculateVoltageDropTreeDetailed,
  VOLTAGE_DROP_TREE_DATA_VERSION,
  DEFAULT_VOLTAGE_DROP_TREE_SETTINGS,
} from "./voltage-drop-tree/index.js";
export {
  ALUMINUM_OVERHEAD,
  ALUMINUM_UNDERGROUND,
  COPPER_OVERHEAD,
  COPPER_UNDERGROUND,
  GROUP_FACTORS,
  LEGACY_SECTION_OPTIONS,
  TEMP_FACTORS,
  getAmpacityTable,
  getGroupFactor,
  getGroupFactorResult,
  getNextSectionOption,
  getSectionOption,
  getTemperatureFactor,
} from "./voltage-drop-tree/legacy-tables.js";
export type {
  LegacyConductor,
  LegacyInstallation,
  LegacySectionOption,
  LegacyVoltageType,
  VoltageDropTreeInput,
  VoltageDropTreeOutput,
  VoltageDropTreeSegmentInput,
  VoltageDropTreeSegmentOutput,
  VoltageDropTreeSegmentSettingsInput,
  VoltageDropTreeResolvedSettings,
  VoltageDropTreeSettingsInput,
} from "./voltage-drop-tree/types.js";
export type { VoltageDropTreeOptimizationStep } from "./voltage-drop-tree/optimizer.js";
export { ENGINE_VERSION } from "./version.js";
