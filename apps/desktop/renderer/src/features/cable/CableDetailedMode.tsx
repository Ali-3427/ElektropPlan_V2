import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type {
  AssumptionEntry,
  CableRequest,
  CableResponse,
  CableVoltageDropSystemType,
  CalculationRecord,
  VoltageDropImpedanceMode,
  VoltageDropProfileSummary,
} from "../../bridge/types";
import { getBridge, isBridgeAvailable } from "../../bridge/client";
import { formatAmp, formatNumberTr, formatPercent } from "../../i18n/format";
import { queryKeys } from "../../query/keys";
import { Button } from "../../ui/Button";
import { Card } from "../../ui/Card";
import { ErrorBanner } from "../../ui/ErrorBanner";
import { Field, fieldGrid } from "../../ui/Field";
import { NumberInput } from "../../ui/NumberInput";
import { ResultPanel } from "../../ui/ResultPanel";
import { SaveDialog } from "../../ui/SaveDialog";
import { Select } from "../../ui/Select";
import { Spinner } from "../../ui/Spinner";
import {
  CALCULATOR_EXAMPLE_DEFAULTS,
  examplePlaceholder,
  mergeAssumptions,
  normalizeExampleNumber,
} from "../shared/calculatorDefaults";
import { usePersistentPageState } from "../shared/usePersistentPageState";
import { INSTALLATION_METHOD_DESCRIPTIONS } from "../voltageDrop/voltageDropGroup";
import styles from "./CableDetailedMode.module.css";

const PHASE_OPTIONS = [
  { value: "1", label: "Tek Fazlı (1Φ)" },
  { value: "3", label: "Üç Fazlı (3Φ)" },
];

const MATERIAL_OPTIONS = [
  { value: "copper", label: "Bakır" },
  { value: "aluminum", label: "Alüminyum" },
];

const SYSTEM_TYPE_OPTIONS: { value: CableVoltageDropSystemType; label: string }[] = [
  { value: "single-phase-ac-two-conductor", label: "Tek Fazlı AC (2 İletken)" },
  { value: "three-phase-ac-ll", label: "Üç Fazlı AC - Hat-Hat (LL)" },
  { value: "three-phase-ac-ln", label: "Üç Fazlı AC - Hat-Nötr (LN)" },
];

const IMPEDANCE_MODE_OPTIONS: { value: VoltageDropImpedanceMode; label: string }[] = [
  { value: "simplified", label: "Basit (Direnç)" },
  { value: "exact-ac", label: "Tam AC (R+X)" },
];

interface CableSubmission {
  request: CableRequest;
  assumptions: AssumptionEntry[];
}

interface CableSubmissionState {
  designCurrentA: number | null;
  phase: "1" | "3";
  conductorMaterial: "copper" | "aluminum";
  installationMethod: string;
  ambientTemperatureC: number | null;
  groupedCircuits: number | null;
  thirdHarmonicPercent: number | null;
  voltageDropLimitPercent: number | null;
  systemType: CableVoltageDropSystemType;
  impedanceMode: VoltageDropImpedanceMode;
  lengthM: number | null;
  baseVoltageV: number | null;
  cosPhi: number | null;
  parallelConductors: number | null;
  conductorTempC: number | null;
  reactanceOhmPerKm: number | null;
}

interface CableDetailedPageState {
  readonly designCurrentA: number | null;
  readonly phase: "1" | "3";
  readonly conductorMaterial: "copper" | "aluminum";
  readonly installationMethod: string;
  readonly ambientTemperatureC: number | null;
  readonly groupedCircuits: number | null;
  readonly thirdHarmonicPercent: number | null;
  readonly voltageDropLimitPercent: number | null;
  readonly systemType: CableVoltageDropSystemType;
  readonly impedanceMode: VoltageDropImpedanceMode;
  readonly lengthM: number | null;
  readonly baseVoltageV: number | null;
  readonly cosPhi: number | null;
  readonly parallelConductors: number | null;
  readonly conductorTempC: number | null;
  readonly reactanceOhmPerKm: number | null;
  readonly result: CableResponse | null;
  readonly lastRequest: CableRequest | null;
}

function createDefaultCableDetailedPageState(): CableDetailedPageState {
  return {
    designCurrentA: null,
    phase: "3",
    conductorMaterial: "copper",
    installationMethod: "B2",
    ambientTemperatureC: null,
    groupedCircuits: null,
    thirdHarmonicPercent: null,
    voltageDropLimitPercent: null,
    systemType: "three-phase-ac-ll",
    impedanceMode: "simplified",
    lengthM: null,
    baseVoltageV: null,
    cosPhi: null,
    parallelConductors: null,
    conductorTempC: null,
    reactanceOhmPerKm: null,
    result: null,
    lastRequest: null,
  };
}

function isFiniteNumber(value: number): boolean {
  return Number.isFinite(value);
}

function isPositiveNumber(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}

function buildCableSubmission(
  state: CableSubmissionState,
  methods: readonly string[],
  hasProfileSelect: boolean,
  defaultProfileLimitPercent: number | null,
): CableSubmission | null {
  const resolvedInstallationMethod = methods.includes(state.installationMethod)
    ? state.installationMethod
    : methods[0];

  if (!resolvedInstallationMethod) {
    return null;
  }

  if (state.phase === "1" && state.systemType !== "single-phase-ac-two-conductor") {
    return null;
  }

  if (state.phase === "3" && state.systemType === "single-phase-ac-two-conductor") {
    return null;
  }

  const designCurrent = normalizeExampleNumber(
    state.designCurrentA,
    CALCULATOR_EXAMPLE_DEFAULTS.cable.designCurrentA,
    "designCurrentA",
  );
  const ambientTemperature = normalizeExampleNumber(
    state.ambientTemperatureC,
    CALCULATOR_EXAMPLE_DEFAULTS.cable.ambientTemperatureC,
    "ambientTemperatureC",
  );
  const groupedCircuits = normalizeExampleNumber(
    state.groupedCircuits,
    CALCULATOR_EXAMPLE_DEFAULTS.cable.groupedCircuits,
    "groupedCircuits",
  );
  const thirdHarmonic = normalizeExampleNumber(
    state.thirdHarmonicPercent,
    CALCULATOR_EXAMPLE_DEFAULTS.cable.thirdHarmonicPercent,
    "thirdHarmonicPercent",
  );
  const voltageDropLimitPercent = hasProfileSelect
    ? state.voltageDropLimitPercent ?? defaultProfileLimitPercent
    : normalizeExampleNumber(
        state.voltageDropLimitPercent,
        CALCULATOR_EXAMPLE_DEFAULTS.cable.voltageDropLimitPercent,
        "voltageDropLimitPercent",
      ).value;
  const lengthM = normalizeExampleNumber(
    state.lengthM,
    CALCULATOR_EXAMPLE_DEFAULTS.voltageDrop.lengthM,
    "lengthM",
  );
  const baseVoltageV = normalizeExampleNumber(
    state.baseVoltageV,
    CALCULATOR_EXAMPLE_DEFAULTS.voltageDrop.baseVoltageV,
    "baseVoltageV",
  );
  const cosPhi = normalizeExampleNumber(
    state.cosPhi,
    CALCULATOR_EXAMPLE_DEFAULTS.voltageDrop.cosPhi,
    "cosPhi",
  );
  const parallelConductors = normalizeExampleNumber(
    state.parallelConductors,
    CALCULATOR_EXAMPLE_DEFAULTS.voltageDrop.parallelConductors,
    "parallelConductors",
  );
  const conductorTempC = normalizeExampleNumber(
    state.conductorTempC,
    CALCULATOR_EXAMPLE_DEFAULTS.voltageDrop.conductorTempC,
    "conductorTempC",
  );
  const reactanceOhmPerKm =
    state.impedanceMode === "exact-ac"
      ? normalizeExampleNumber(
          state.reactanceOhmPerKm,
          CALCULATOR_EXAMPLE_DEFAULTS.voltageDrop.reactanceOhmPerKm,
          "reactanceOhmPerKm",
        )
      : null;

  if (
    !isPositiveNumber(designCurrent.value) ||
    !isPositiveNumber(ambientTemperature.value) ||
    !isPositiveInteger(groupedCircuits.value) ||
    !isFiniteNumber(thirdHarmonic.value) ||
    thirdHarmonic.value < 0 ||
    voltageDropLimitPercent === null ||
    !isPositiveNumber(voltageDropLimitPercent) ||
    !isPositiveNumber(lengthM.value) ||
    !isPositiveNumber(baseVoltageV.value) ||
    !isFiniteNumber(cosPhi.value) ||
    cosPhi.value <= 0 ||
    cosPhi.value > 1 ||
    !isPositiveNumber(parallelConductors.value) ||
    !isFiniteNumber(conductorTempC.value) ||
    (reactanceOhmPerKm !== null && !isPositiveNumber(reactanceOhmPerKm.value))
  ) {
    return null;
  }

  const assumptions = mergeAssumptions(
    designCurrent.assumptions,
    ambientTemperature.assumptions,
    groupedCircuits.assumptions,
    thirdHarmonic.assumptions,
    hasProfileSelect
      ? []
      : normalizeExampleNumber(
          state.voltageDropLimitPercent,
          CALCULATOR_EXAMPLE_DEFAULTS.cable.voltageDropLimitPercent,
          "voltageDropLimitPercent",
        ).assumptions,
    lengthM.assumptions,
    baseVoltageV.assumptions,
    cosPhi.assumptions,
    parallelConductors.assumptions,
    conductorTempC.assumptions,
    reactanceOhmPerKm?.assumptions,
  );

  const request: CableRequest = {
    designCurrentA: designCurrent.value,
    phase: Number(state.phase) as 1 | 3,
    conductorMaterial: state.conductorMaterial,
    installationMethod: resolvedInstallationMethod as CableRequest["installationMethod"],
    insulationRating: "XLPE/EPR",
    ambientTemperatureC: ambientTemperature.value,
    groupedCircuits: groupedCircuits.value,
    thirdHarmonicPercent: thirdHarmonic.value,
    voltageDropLimitPercent,
    voltageDrop: {
      mode: "current",
      systemType: state.systemType,
      impedanceMode: state.impedanceMode,
      lengthM: lengthM.value,
      baseVoltageV: baseVoltageV.value,
      ...(cosPhi.value !== null ? { cosPhi: cosPhi.value } : {}),
      ...(parallelConductors.value !== null
        ? { parallelConductors: parallelConductors.value }
        : {}),
      ...(conductorTempC.value !== null
        ? { conductorTempC: conductorTempC.value }
        : {}),
      ...(reactanceOhmPerKm !== null && reactanceOhmPerKm.value !== null
        ? { reactanceOhmPerKm: reactanceOhmPerKm.value }
        : {}),
    },
  };

  return { request, assumptions };
}

export function CableDetailedMode() {
  const [pageState, setPageState] = usePersistentPageState<CableDetailedPageState>({
    key: "elektroplan.page.cable.detailed",
    version: 1,
    defaultValue: () => createDefaultCableDetailedPageState(),
  });
  const [designCurrentA, setDesignCurrentA] = useState<number | null>(pageState.designCurrentA);
  const [phase, setPhase] = useState<"1" | "3">(pageState.phase);
  const [conductorMaterial, setConductorMaterial] = useState<"copper" | "aluminum">(
    pageState.conductorMaterial,
  );
  const [installationMethod, setInstallationMethod] = useState<string>(pageState.installationMethod);
  const [ambientTemperatureC, setAmbientTemperatureC] = useState<number | null>(
    pageState.ambientTemperatureC,
  );
  const [groupedCircuits, setGroupedCircuits] = useState<number | null>(pageState.groupedCircuits);
  const [thirdHarmonicPercent, setThirdHarmonicPercent] = useState<number | null>(
    pageState.thirdHarmonicPercent,
  );
  const [voltageDropLimitPercent, setVoltageDropLimitPercent] = useState<number | null>(
    pageState.voltageDropLimitPercent,
  );
  const [systemType, setSystemType] = useState<CableVoltageDropSystemType>(pageState.systemType);
  const [impedanceMode, setImpedanceMode] = useState<VoltageDropImpedanceMode>(
    pageState.impedanceMode,
  );
  const [lengthM, setLengthM] = useState<number | null>(pageState.lengthM);
  const [baseVoltageV, setBaseVoltageV] = useState<number | null>(pageState.baseVoltageV);
  const [cosPhi, setCosPhi] = useState<number | null>(pageState.cosPhi);
  const [parallelConductors, setParallelConductors] = useState<number | null>(
    pageState.parallelConductors,
  );
  const [conductorTempC, setConductorTempC] = useState<number | null>(pageState.conductorTempC);
  const [reactanceOhmPerKm, setReactanceOhmPerKm] = useState<number | null>(
    pageState.reactanceOhmPerKm,
  );
  const [result, setResult] = useState<CableResponse | null>(pageState.result);
  const [lastRequest, setLastRequest] = useState<CableRequest | null>(pageState.lastRequest);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSave, setShowSave] = useState(false);

  useEffect(() => {
    setPageState({
      designCurrentA,
      phase,
      conductorMaterial,
      installationMethod,
      ambientTemperatureC,
      groupedCircuits,
      thirdHarmonicPercent,
      voltageDropLimitPercent,
      systemType,
      impedanceMode,
      lengthM,
      baseVoltageV,
      cosPhi,
      parallelConductors,
      conductorTempC,
      reactanceOhmPerKm,
      result,
      lastRequest,
    });
  }, [
    ambientTemperatureC,
    baseVoltageV,
    conductorMaterial,
    conductorTempC,
    cosPhi,
    designCurrentA,
    groupedCircuits,
    impedanceMode,
    installationMethod,
    lastRequest,
    lengthM,
    parallelConductors,
    phase,
    reactanceOhmPerKm,
    result,
    setPageState,
    systemType,
    thirdHarmonicPercent,
    voltageDropLimitPercent,
  ]);

  const methodsQuery = useQuery({
    queryKey: queryKeys.installationMethods,
    queryFn: () => getBridge().data.installationMethods(),
    enabled: isBridgeAvailable(),
  });

  const profilesQuery = useQuery({
    queryKey: queryKeys.vdProfiles,
    queryFn: () => getBridge().data.voltageDropProfiles(),
    enabled: isBridgeAvailable(),
  });

  const defaultProfileQuery = useQuery({
    queryKey: queryKeys.vdDefaultProfile,
    queryFn: () => getBridge().data.defaultVoltageDropProfile(),
    enabled: isBridgeAvailable(),
  });

  useEffect(() => {
    const methods = methodsQuery.data;
    if (methods && methods.length > 0 && !methods.includes(installationMethod)) {
      setInstallationMethod(methods[0] ?? "B2");
    }
  }, [methodsQuery.data, installationMethod]);

  useEffect(() => {
    if (defaultProfileQuery.data && voltageDropLimitPercent === null) {
      setVoltageDropLimitPercent(defaultProfileQuery.data.limitPercent);
    }
  }, [defaultProfileQuery.data, voltageDropLimitPercent]);

  const methods: readonly string[] = methodsQuery.data ?? ["A1", "A2", "B1", "B2", "C", "D", "E"];
  const methodOptions = methods.map((method) => ({
    value: method,
    label:
      method in INSTALLATION_METHOD_DESCRIPTIONS
        ? `${method} - ${
            INSTALLATION_METHOD_DESCRIPTIONS[
              method as keyof typeof INSTALLATION_METHOD_DESCRIPTIONS
            ]
          }`
        : method,
  }));

  const profiles: readonly VoltageDropProfileSummary[] = profilesQuery.data ?? [];
  const profileOptions = profiles.map((profile) => ({
    value: String(profile.limitPercent),
    label: `${profile.titleTr} (${profile.limitPercent}%)`,
  }));

  const submission = buildCableSubmission(
    {
      designCurrentA,
      phase,
      conductorMaterial,
      installationMethod,
      ambientTemperatureC,
      groupedCircuits,
      thirdHarmonicPercent,
      voltageDropLimitPercent,
      systemType,
      impedanceMode,
      lengthM,
      baseVoltageV,
      cosPhi,
      parallelConductors,
      conductorTempC,
      reactanceOhmPerKm,
    },
    methods,
    profiles.length > 0,
    defaultProfileQuery.data?.limitPercent ?? null,
  );

  async function handleSubmit() {
    if (!submission) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await getBridge().calc.cable(submission.request);
      const merged: CableResponse = {
        ...response,
        assumptions: mergeAssumptions(response.assumptions, submission.assumptions),
      };
      setResult(merged);
      setLastRequest(submission.request);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : "Hesaplama hatası.",
      );
    } finally {
      setLoading(false);
    }
  }

  const saveRecord: CalculationRecord | null =
    result && lastRequest
      ? {
          id: crypto.randomUUID(),
          calculator: "cable",
          version: {
            contractVersion: "1",
            engineVersion: result.engineVersion,
            dataVersion: result.dataVersion,
          },
          input: lastRequest,
          output: result,
        }
      : null;

  const isLoading =
    methodsQuery.isLoading || profilesQuery.isLoading || defaultProfileQuery.isLoading;

  if (isLoading) {
    return (
      <div className={styles.center}>
        <Spinner />
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <Card title="Kablo Parametreleri">
        <div className={styles.form}>
          <div className={fieldGrid}>
            <Field label="Tasarım Akımı (A)" required>
              <NumberInput
                value={designCurrentA}
                onChange={setDesignCurrentA}
                placeholder={examplePlaceholder(CALCULATOR_EXAMPLE_DEFAULTS.cable.designCurrentA)}
              />
            </Field>
            <Field label="Faz">
              <Select value={phase} onChange={(value) => setPhase(value as "1" | "3")} options={PHASE_OPTIONS} />
            </Field>
            <Field label="İletken Malzeme">
              <Select
                value={conductorMaterial}
                onChange={(value) => setConductorMaterial(value as "copper" | "aluminum")}
                options={MATERIAL_OPTIONS}
              />
            </Field>
            <Field label="Montaj Yöntemi">
              <Select value={installationMethod} onChange={setInstallationMethod} options={methodOptions} />
            </Field>
            <Field label="İzolasyon">
              <input type="text" className={styles.readonly} value="XLPE/EPR" readOnly />
            </Field>
            <Field label="Ortam Sıcaklığı (°C)" required>
              <NumberInput
                value={ambientTemperatureC}
                onChange={setAmbientTemperatureC}
                placeholder={examplePlaceholder(CALCULATOR_EXAMPLE_DEFAULTS.cable.ambientTemperatureC)}
              />
            </Field>
            <Field label="Devre Gruplandırma" required>
              <NumberInput
                value={groupedCircuits}
                onChange={setGroupedCircuits}
                placeholder={examplePlaceholder(CALCULATOR_EXAMPLE_DEFAULTS.cable.groupedCircuits)}
              />
            </Field>
            <Field label="3. Harmonik (%)" required>
              <NumberInput
                value={thirdHarmonicPercent}
                onChange={setThirdHarmonicPercent}
                placeholder={examplePlaceholder(CALCULATOR_EXAMPLE_DEFAULTS.cable.thirdHarmonicPercent)}
              />
            </Field>
            <Field label="Gerilim Düşüm Limiti">
              {profileOptions.length > 0 ? (
                <Select
                  value={voltageDropLimitPercent !== null ? String(voltageDropLimitPercent) : ""}
                  onChange={(value) => setVoltageDropLimitPercent(parseFloat(value))}
                  options={profileOptions}
                />
              ) : (
                <NumberInput
                  value={voltageDropLimitPercent}
                  onChange={setVoltageDropLimitPercent}
                  placeholder={examplePlaceholder(CALCULATOR_EXAMPLE_DEFAULTS.cable.voltageDropLimitPercent)}
                />
              )}
            </Field>
          </div>

          <hr className={styles.divider} />
          <h4 className={styles.subTitle}>Gerilim Düşümü Parametreleri</h4>

          <div className={fieldGrid}>
            <Field label="Sistem Tipi">
              <Select
                value={systemType}
                onChange={(value) => setSystemType(value as CableVoltageDropSystemType)}
                options={SYSTEM_TYPE_OPTIONS}
              />
            </Field>
            <Field label="Empedans Modu">
              <Select
                value={impedanceMode}
                onChange={(value) => setImpedanceMode(value as VoltageDropImpedanceMode)}
                options={IMPEDANCE_MODE_OPTIONS}
              />
            </Field>
            <Field label="Uzunluk (m)" required>
              <NumberInput
                value={lengthM}
                onChange={setLengthM}
                placeholder={examplePlaceholder(CALCULATOR_EXAMPLE_DEFAULTS.voltageDrop.lengthM)}
              />
            </Field>
            <Field label="Nominal Gerilim (V)" required>
              <NumberInput
                value={baseVoltageV}
                onChange={setBaseVoltageV}
                placeholder={examplePlaceholder(CALCULATOR_EXAMPLE_DEFAULTS.voltageDrop.baseVoltageV)}
              />
            </Field>
            <Field label="cosφ (isteğe bağlı)">
              <NumberInput
                value={cosPhi}
                onChange={setCosPhi}
                placeholder={examplePlaceholder(CALCULATOR_EXAMPLE_DEFAULTS.voltageDrop.cosPhi)}
              />
            </Field>
            <Field label="Paralel İletken (isteğe bağlı)">
              <NumberInput
                value={parallelConductors}
                onChange={setParallelConductors}
                placeholder={examplePlaceholder(CALCULATOR_EXAMPLE_DEFAULTS.voltageDrop.parallelConductors)}
              />
            </Field>
            <Field label="İletken Sıcaklık °C (isteğe bağlı)">
              <NumberInput
                value={conductorTempC}
                onChange={setConductorTempC}
                placeholder={examplePlaceholder(CALCULATOR_EXAMPLE_DEFAULTS.voltageDrop.conductorTempC)}
              />
            </Field>
            {impedanceMode === "exact-ac" && (
              <Field label="Reaktans (Ω/km) (exact-ac)">
                <NumberInput
                  value={reactanceOhmPerKm}
                  onChange={setReactanceOhmPerKm}
                  placeholder={examplePlaceholder(CALCULATOR_EXAMPLE_DEFAULTS.voltageDrop.reactanceOhmPerKm)}
                />
              </Field>
            )}
          </div>

          <div className={styles.actions}>
            <Button type="button" variant="primary" disabled={!submission} loading={loading} onClick={handleSubmit}>
              Hesapla
            </Button>
          </div>
        </div>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && (
        <ResultPanel
          title="Kablo Seçim Sonucu"
          warnings={result.warnings}
          assumptions={result.assumptions}
          engineVersion={result.engineVersion}
          dataVersion={result.dataVersion}
          onSave={saveRecord ? () => setShowSave(true) : undefined}
        >
          <div className={styles.resultGrid}>
            <RRow label="Seçilen Kesit" value={`${formatNumberTr(result.value.selectedSectionMm2, 0)} mm²`} highlight />
            <RRow label="Düzeltilmiş Ampasiti" value={formatAmp(result.value.correctedAmpacityA, 2)} />
            <RRow label="kT (Sıcaklık)" value={formatNumberTr(result.value.kT, 4)} />
            <RRow label="kG (Gruplama)" value={formatNumberTr(result.value.kG, 4)} />
            <RRow label="kH (Harmonik)" value={formatNumberTr(result.value.kH, 4)} />
            <RRow label="kTotal" value={formatNumberTr(result.value.kTotal, 4)} />
            <RRow label="Iz Gereken" value={formatAmp(result.value.izRequiredA, 2)} />
            <RRow label="Gerilim Düşümü ΔV%" value={formatPercent(result.value.vdResult.value.deltaVPercent, 2)} />
          </div>

          {result.value.candidateTrace.length > 0 && (
            <div className={styles.traceWrap}>
              <h4 className={styles.traceTitle}>Aday Kesit İzleme</h4>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Kesit (mm²)</th>
                      <th>Iz (A)</th>
                      <th>Iz' (A)</th>
                      <th>Termal</th>
                      <th>ΔV%</th>
                      <th>Kabul</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.value.candidateTrace.map((step, index) => (
                      <tr key={index} className={step.accepted ? styles.accepted : ""}>
                        <td>{formatNumberTr(step.sectionMm2, 0)}</td>
                        <td>{step.baseAmpacityA !== null ? formatNumberTr(step.baseAmpacityA, 1) : "—"}</td>
                        <td>{step.correctedAmpacityA !== null ? formatNumberTr(step.correctedAmpacityA, 1) : "—"}</td>
                        <td>{step.thermalPass ? "✓" : "✕"}</td>
                        <td>{formatPercent(step.vdResult.value.deltaVPercent, 2)}</td>
                        <td>{step.accepted ? "✓" : "✕"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </ResultPanel>
      )}

      {showSave && saveRecord && <SaveDialog record={saveRecord} onClose={() => setShowSave(false)} />}
    </div>
  );
}

function RRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`${styles.resultRow} ${highlight ? styles.highlight : ""}`}>
      <span className={styles.resultLabel}>{label}</span>
      <span className={styles.resultValue}>{value}</span>
    </div>
  );
}
