import { useEffect, useRef, useState } from "react";
import type {
  CalculationRecord,
  MotorFormulaRequest,
  MotorPhase,
  MotorResponse,
  MotorVoltageMode,
} from "../../bridge/types";
import { getBridge } from "../../bridge/client";
import { formatAmp, formatNumberTr } from "../../i18n/format";
import { Button } from "../../ui/Button";
import { Card } from "../../ui/Card";
import { ErrorBanner } from "../../ui/ErrorBanner";
import { Field, fieldGrid } from "../../ui/Field";
import { NumberInput } from "../../ui/NumberInput";
import { ResultPanel } from "../../ui/ResultPanel";
import { SaveDialog } from "../../ui/SaveDialog";
import { Select } from "../../ui/Select";
import {
  MOTOR_EFFICIENCY_PERCENT_MIN,
  MOTOR_FORMULA_PLACEHOLDERS,
  MOTOR_PHASE_OPTIONS,
  MOTOR_VOLTAGE_MODE_OPTIONS,
  buildMotorFormulaSubmission,
  getMotorFormulaVoltageForPhase,
  getMotorFormulaVoltageOptions,
} from "../shared/calculatorDefaults";
import { usePersistentPageState } from "../shared/usePersistentPageState";
import styles from "./FormulaMode.module.css";

interface FormulaCalculationState {
  readonly recordId: string;
  readonly request: MotorFormulaRequest;
  readonly result: MotorResponse;
}

interface MotorFormulaPageState {
  readonly P_out: number | null;
  readonly voltage: 220 | 380;
  readonly cosPhi: number | null;
  readonly efficiencyPercent: number | null;
  readonly phase: MotorPhase;
  readonly voltageMode: MotorVoltageMode;
  readonly calculation: FormulaCalculationState | null;
}

export function FormulaMode() {
  const [pageState, setPageState] = usePersistentPageState<MotorFormulaPageState>({
    key: "elektroplan.page.motor.formula",
    version: 1,
    defaultValue: {
      P_out: null,
      voltage: getMotorFormulaVoltageForPhase(3),
      cosPhi: null,
      efficiencyPercent: null,
      phase: 3,
      voltageMode: "LL",
      calculation: null,
    },
  });
  const { P_out, voltage, cosPhi, efficiencyPercent, phase, voltageMode, calculation } =
    pageState;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSave, setShowSave] = useState(false);
  const requestSeq = useRef(0);

  const submission = buildMotorFormulaSubmission({
    P_out,
    cosPhi,
    efficiencyPercent,
    phase,
    voltageMode,
  });
  const efficiencyPercentError =
    efficiencyPercent !== null &&
    (efficiencyPercent < MOTOR_EFFICIENCY_PERCENT_MIN || efficiencyPercent > 100)
      ? `Verim yuzde olarak ${MOTOR_EFFICIENCY_PERCENT_MIN}-100 arasinda girilmeli (or. 85).`
      : null;

  useEffect(() => {
    requestSeq.current += 1;
    setPageState((current) => ({ ...current, calculation: null }));
    setShowSave(false);
    setError(null);
    setLoading(false);
  }, [phase, setPageState, voltageMode]);

  const result = calculation?.result ?? null;
  const saveRecord: CalculationRecord | null = calculation
    ? {
        id: calculation.recordId,
        calculator: "motor",
        version: {
          contractVersion: "1",
          engineVersion: calculation.result.engineVersion,
          dataVersion: calculation.result.dataVersion,
        },
        input: calculation.request,
        output: {
          ...calculation.result,
          warnings: [...calculation.result.warnings],
          assumptions: [...calculation.result.assumptions],
        },
      }
    : null;

  async function handleSubmit() {
    if (!submission.isValid) return;

    const requestId = ++requestSeq.current;
    setLoading(true);
    setError(null);
    try {
      const res = await getBridge().calc.motor(submission.request);
      if (requestSeq.current !== requestId) return;
      setPageState((current) => ({
        ...current,
        calculation: {
          recordId: crypto.randomUUID(),
          request: submission.request,
          result: {
            ...res,
            assumptions: [...res.assumptions, ...submission.assumptions],
          },
        },
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Hesaplama hatasi.");
    } finally {
      if (requestSeq.current === requestId) {
        setLoading(false);
      }
    }
  }

  function handlePhaseChange(nextPhase: MotorPhase) {
    setPageState((current) => ({
      ...current,
      phase: nextPhase,
      voltage: getMotorFormulaVoltageForPhase(nextPhase),
    }));
  }

  return (
    <div className={styles.wrap}>
      <Card title="Giris Parametreleri">
        <div className={styles.form}>
          <div className={fieldGrid}>
            <Field label="Cikis Gucu P_out (kW)" required>
              <NumberInput
                value={P_out}
                onChange={(next) => setPageState((current) => ({ ...current, P_out: next }))}
                placeholder={MOTOR_FORMULA_PLACEHOLDERS.P_out}
              />
            </Field>
            <Field label="Gerilim (V)" required>
              <Select
                value={String(voltage)}
                onChange={(value) =>
                  setPageState((current) => ({
                    ...current,
                    voltage: value === "220" ? 220 : 380,
                  }))
                }
                options={getMotorFormulaVoltageOptions(phase)}
              />
            </Field>
            <Field label="Guc Faktoru (cosphi)" required>
              <NumberInput
                value={cosPhi}
                onChange={(next) => setPageState((current) => ({ ...current, cosPhi: next }))}
                placeholder={MOTOR_FORMULA_PLACEHOLDERS.cosPhi}
              />
            </Field>
            <Field
              label="Verim (%)"
              required
              hint="0-100 arasi yuzde degeri girin; 0,85 degil 85 yazin."
              error={efficiencyPercentError}
            >
              <NumberInput
                value={efficiencyPercent}
                onChange={(next) =>
                  setPageState((current) => ({ ...current, efficiencyPercent: next }))
                }
                placeholder={MOTOR_FORMULA_PLACEHOLDERS.efficiencyPercent}
                invalid={efficiencyPercentError !== null}
              />
            </Field>
            <Field label="Faz">
              <Select
                value={String(phase)}
                onChange={(value) => handlePhaseChange(Number(value) as MotorPhase)}
                options={MOTOR_PHASE_OPTIONS}
              />
            </Field>
            {phase === 3 ? (
              <Field label="Gerilim Modu">
                <Select
                  value={voltageMode}
                  onChange={(value) =>
                    setPageState((current) => ({
                      ...current,
                      voltageMode: value as MotorVoltageMode,
                    }))
                  }
                  options={MOTOR_VOLTAGE_MODE_OPTIONS}
                />
              </Field>
            ) : null}
          </div>

          <div className={styles.actions}>
            <Button
              type="button"
              variant="primary"
              disabled={!submission.isValid}
              loading={loading}
              onClick={handleSubmit}
            >
              Hesapla
            </Button>
          </div>
        </div>
      </Card>

      {error ? <ErrorBanner message={error} /> : null}

      {result && result.value.mode === "formula" ? (
        <ResultPanel
          title="Hesap Sonuclari"
          warnings={result.warnings}
          assumptions={result.assumptions}
          engineVersion={result.engineVersion}
          dataVersion={result.dataVersion}
          onSave={saveRecord ? () => setShowSave(true) : undefined}
        >
          <div className={styles.resultGrid}>
            <ResultRow label="Akim" value={formatAmp(result.value.currentA, 2)} highlight />
            <ResultRow label="Giris Gucu" value={`${formatNumberTr(result.value.inputPowerKW, 3)} kW`} />
            <ResultRow
              label="Gorunur Guc"
              value={`${formatNumberTr(result.value.apparentPowerKVA, 3)} kVA`}
            />
            <ResultRow label="cosphi" value={formatNumberTr(result.value.cosPhi, 3)} />
            <ResultRow label="Verim" value={`${formatNumberTr(result.value.efficiencyPercent, 1)} %`} />
            {result.value.suggestedCableSection ? (
              <>
                <ResultRow
                  label="Onerilen Kablo Kesiti"
                  value={`${result.value.suggestedCableSection.label} mm2 (${formatAmp(
                    result.value.suggestedCableSection.ampacityA,
                    0,
                  )} hava 30 C)`}
                />
                {result.value.suggestedCableSection.standardHintMm2 !== undefined ? (
                  <ResultRow
                    label="Standart Kesit Onerisi"
                    value={`${formatNumberTr(
                      result.value.suggestedCableSection.standardHintMm2,
                      1,
                    )} mm2 onerilir`}
                  />
                ) : null}
              </>
            ) : null}
          </div>
        </ResultPanel>
      ) : null}

      {showSave && saveRecord ? (
        <SaveDialog record={saveRecord} onClose={() => setShowSave(false)} />
      ) : null}
    </div>
  );
}

function ResultRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className={`${styles.resultRow} ${highlight ? styles.highlight : ""}`}>
      <span className={styles.resultLabel}>{label}</span>
      <span className={styles.resultValue}>{value}</span>
    </div>
  );
}
