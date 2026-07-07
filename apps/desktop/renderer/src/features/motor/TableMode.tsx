import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { CalculationRecord, MotorResponse, MotorTableEntryDto } from "../../bridge/types";
import { getBridge, isBridgeAvailable } from "../../bridge/client";
import { formatNumberTr } from "../../i18n/format";
import { queryKeys } from "../../query/keys";
import { Button } from "../../ui/Button";
import { Card } from "../../ui/Card";
import { ErrorBanner } from "../../ui/ErrorBanner";
import { Field, fieldGrid } from "../../ui/Field";
import { ResultPanel } from "../../ui/ResultPanel";
import { SaveDialog } from "../../ui/SaveDialog";
import { Select } from "../../ui/Select";
import { Spinner } from "../../ui/Spinner";
import { usePersistentPageState } from "../shared/usePersistentPageState";
import styles from "./TableMode.module.css";

interface MotorTablePageState {
  readonly selectedKw: number | null;
  readonly voltage: 220 | 380;
  readonly result: MotorResponse | null;
}

export function TableMode() {
  const tableQuery = useQuery({
    queryKey: queryKeys.motorTable,
    queryFn: () => getBridge().data.motorTable(),
    enabled: isBridgeAvailable(),
  });
  const entries: readonly MotorTableEntryDto[] =
    (tableQuery.data as readonly MotorTableEntryDto[] | undefined) ?? [];
  const [pageState, setPageState] = usePersistentPageState<MotorTablePageState>({
    key: "elektroplan.page.motor.table",
    version: 1,
    defaultValue: {
      selectedKw: null,
      voltage: 380,
      result: null,
    },
  });
  const { selectedKw, voltage, result } = pageState;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSave, setShowSave] = useState(false);

  useEffect(() => {
    if (entries.length > 0 && selectedKw === null) {
      const first = entries[0];
      if (first) {
        setPageState((current) => ({ ...current, selectedKw: first.kW }));
      }
    }
  }, [entries, selectedKw, setPageState]);

  const selectedEntry = entries.find((entry) => entry.kW === selectedKw);
  const volt380Disabled = selectedEntry?.currentA_380V === null;

  useEffect(() => {
    if (volt380Disabled && voltage === 380) {
      setPageState((current) => ({ ...current, voltage: 220 }));
    }
  }, [setPageState, volt380Disabled, voltage]);

  async function handleCalc(kw: number, nextVoltage: 220 | 380) {
    setLoading(true);
    setError(null);
    try {
      const response = await getBridge().calc.motor({
        mode: "table",
        kW: kw,
        voltage: nextVoltage,
      });
      setPageState((current) => ({ ...current, result: response }));
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Hesaplama hatasi.");
    } finally {
      setLoading(false);
    }
  }

  const kwOptions = entries.map((entry) => ({
    value: String(entry.kW),
    label: `${formatNumberTr(entry.kW, 2)} kW`,
  }));

  const saveRecord: CalculationRecord | null =
    result && selectedKw !== null
      ? {
          id: crypto.randomUUID(),
          calculator: "motor",
          version: {
            contractVersion: "1",
            engineVersion: result.engineVersion,
            dataVersion: result.dataVersion,
          },
          input: { mode: "table", kW: selectedKw, voltage },
          output: {
            ...result,
            warnings: [...result.warnings],
            assumptions: [...result.assumptions],
          },
        }
      : null;

  if (tableQuery.isLoading) {
    return (
      <div className={styles.center}>
        <Spinner />
      </div>
    );
  }

  if (tableQuery.isError) {
    return <ErrorBanner message="Motor tablosu yuklenemedi." />;
  }

  return (
    <div className={styles.wrap}>
      <Card title="Motor Secimi">
        <div className={styles.form}>
          <div className={fieldGrid}>
            <Field label="Motor Gucu (kW)">
              <Select
                value={selectedKw !== null ? String(selectedKw) : ""}
                onChange={(value) =>
                  setPageState((current) => ({
                    ...current,
                    selectedKw: parseFloat(value),
                    result: null,
                  }))
                }
                options={kwOptions}
              />
            </Field>

            <Field label="Gerilim">
              <div className={styles.radioGroup}>
                <label className={`${styles.radio} ${voltage === 220 ? styles.checked : ""}`}>
                  <input
                    type="radio"
                    name="voltage"
                    value="220"
                    checked={voltage === 220}
                    onChange={() =>
                      setPageState((current) => ({ ...current, voltage: 220, result: null }))
                    }
                  />
                  220 V
                </label>
                <label
                  className={`${styles.radio} ${voltage === 380 ? styles.checked : ""} ${volt380Disabled ? styles.disabled : ""}`}
                >
                  <input
                    type="radio"
                    name="voltage"
                    value="380"
                    checked={voltage === 380}
                    disabled={volt380Disabled}
                    onChange={() => {
                      if (!volt380Disabled) {
                        setPageState((current) => ({
                          ...current,
                          voltage: 380,
                          result: null,
                        }));
                      }
                    }}
                  />
                  380 V
                </label>
              </div>
            </Field>
          </div>

          <div className={styles.actions}>
            <Button
              type="button"
              variant="primary"
              disabled={selectedKw === null}
              loading={loading}
              onClick={() => {
                if (selectedKw !== null) {
                  void handleCalc(selectedKw, voltage);
                }
              }}
            >
              Hesapla
            </Button>
          </div>
        </div>
      </Card>

      {error ? <ErrorBanner message={error} /> : null}

      {result && result.value.mode === "table" ? (
        <ResultPanel
          title="Motor Tablosu Sonuclari"
          warnings={result.warnings}
          assumptions={result.assumptions}
          engineVersion={result.engineVersion}
          dataVersion={result.dataVersion}
          onSave={saveRecord ? () => setShowSave(true) : undefined}
        >
          <div className={styles.resultGrid}>
            <TRow label="Guc (kW)" value={`${formatNumberTr(result.value.kW, 2)} kW`} />
            <TRow label="PS" value={`${formatNumberTr(result.value.PS, 2)} PS`} />
            <TRow label="Cosphi" value={formatNumberTr(result.value.cosPhi, 3)} />
            <TRow label="%Verim" value={`${formatNumberTr(result.value.efficiencyPercent, 1)} %`} />
            <TRow
              label="Akim (A)"
              value={
                voltage === 380 && selectedEntry?.currentA_380V === null
                  ? "-"
                  : `${formatNumberTr(result.value.currentA, 2)} A`
              }
              highlight
            />
            <TRow label="Kablo" value={result.value.cableSpec} />
          </div>
        </ResultPanel>
      ) : null}

      {showSave && saveRecord ? (
        <SaveDialog record={saveRecord} onClose={() => setShowSave(false)} />
      ) : null}
    </div>
  );
}

function TRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`${styles.resultRow} ${highlight ? styles.highlight : ""}`}>
      <span className={styles.resultLabel}>{label}</span>
      <span className={styles.resultValue}>{value}</span>
    </div>
  );
}
