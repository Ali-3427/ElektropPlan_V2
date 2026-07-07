import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type {
  CableRulerAmbient,
  CableRulerEntryDto,
  CableRulerResponse,
} from "../../bridge/types";
import { getBridge, isBridgeAvailable } from "../../bridge/client";
import { formatAmp, formatNumberTr } from "../../i18n/format";
import { queryKeys } from "../../query/keys";
import { Button } from "../../ui/Button";
import { Card } from "../../ui/Card";
import { ErrorBanner } from "../../ui/ErrorBanner";
import { Field, fieldGrid } from "../../ui/Field";
import { NumberInput } from "../../ui/NumberInput";
import { ResultPanel } from "../../ui/ResultPanel";
import { Select } from "../../ui/Select";
import { Spinner } from "../../ui/Spinner";
import { usePersistentPageState } from "../shared/usePersistentPageState";
import styles from "./CableRulerMode.module.css";

const AMBIENT_OPTIONS: { value: CableRulerAmbient; label: string }[] = [
  { value: "hava_30C", label: "Hava (30 °C)" },
  { value: "toprak_20C", label: "Toprak (20 °C)" },
];

function isPositiveNumber(value: number | null): value is number {
  return value !== null && Number.isFinite(value) && value > 0;
}

function getSupportedMaxAmpacity(table: readonly CableRulerEntryDto[]): number {
  return table.reduce((maxAmpacity, row) => {
    const candidates = [row.akim_toprak_20C_A, row.akim_hava_30C_A];
    let nextMax = maxAmpacity;
    for (const candidate of candidates) {
      if (candidate !== null && candidate > nextMax) {
        nextMax = candidate;
      }
    }
    return nextMax;
  }, 0);
}

interface CableRulerPageState {
  readonly designCurrentA: number | null;
  readonly ambient: CableRulerAmbient;
  readonly result: CableRulerResponse | null;
}

function createDefaultCableRulerPageState(): CableRulerPageState {
  return {
    designCurrentA: null,
    ambient: "hava_30C",
    result: null,
  };
}

export function CableRulerMode() {
  const [pageState, setPageState] = usePersistentPageState<CableRulerPageState>({
    key: "elektroplan.page.cable.ruler",
    version: 1,
    defaultValue: () => createDefaultCableRulerPageState(),
  });
  const [designCurrentA, setDesignCurrentA] = useState<number | null>(pageState.designCurrentA);
  const [ambient, setAmbient] = useState<CableRulerAmbient>(pageState.ambient);
  const [result, setResult] = useState<CableRulerResponse | null>(pageState.result);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPageState({
      designCurrentA,
      ambient,
      result,
    });
  }, [ambient, designCurrentA, result, setPageState]);

  const rulerTableQuery = useQuery({
    queryKey: queryKeys.cableRulerTable,
    queryFn: () => getBridge().data.cableRulerTable(),
    enabled: isBridgeAvailable(),
  });

  const table = rulerTableQuery.data ?? [];
  const supportedMaxAmpacity = getSupportedMaxAmpacity(table);
  const canSubmit = isPositiveNumber(designCurrentA) && !loading && table.length > 0;

  async function handleSubmit() {
    if (!isPositiveNumber(designCurrentA)) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await getBridge().calc.cableRuler({
        designCurrentA,
        ambient,
      });
      setResult(response);
    } catch (caughtError) {
      setResult(null);
      if (caughtError instanceof Error && /No cable ruler row/i.test(caughtError.message)) {
        setError("Bu akım için ruler aralığında kesit yok.");
      } else {
        setError(
          caughtError instanceof Error ? caughtError.message : "Hesaplama hatası.",
        );
      }
    } finally {
      setLoading(false);
    }
  }

  if (rulerTableQuery.isLoading) {
    return (
      <div className={styles.center}>
        <Spinner />
      </div>
    );
  }

  if (rulerTableQuery.isError) {
    return (
      <div className={styles.wrap}>
        <ErrorBanner message="Cable ruler tablosu yüklenemedi." />
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <Card
        title="Cetvel Parametreleri"
        subtitle={
          <span className={styles.summary}>
            {table.length} standart satır yüklü • üst sınır {formatAmp(supportedMaxAmpacity, 0)}
          </span>
        }
      >
        <div className={styles.form}>
          <div className={fieldGrid}>
            <Field label="Tasarım Akımı (A)" required>
              <NumberInput value={designCurrentA} onChange={setDesignCurrentA} />
            </Field>
            <Field label="Ortam">
              <Select
                value={ambient}
                onChange={(value) => setAmbient(value as CableRulerAmbient)}
                options={AMBIENT_OPTIONS}
              />
            </Field>
          </div>

          <div className={styles.actions}>
            <Button type="button" variant="primary" disabled={!canSubmit} loading={loading} onClick={handleSubmit}>
              Hesapla
            </Button>
          </div>
        </div>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && (
        <ResultPanel
          title="Cetvel Sonucu"
          warnings={result.warnings}
          assumptions={result.assumptions}
          engineVersion={result.engineVersion}
          dataVersion={result.dataVersion}
        >
          <div className={styles.resultGrid}>
            <ResultRow
              label="Seçilen Kesit"
              value={`${result.value.selected.nominal_kesit_mm2} mm²`}
              highlight
            />
            <ResultRow
              label="Ampasite"
              value={formatAmp(result.value.selectedAmpacityA, 0)}
            />
            <ResultRow
              label="DC Direnç"
              value={`${formatNumberTr(result.value.selected.dc_direnc_ohm_km_20C, 4)} Ω/km`}
            />
            <ResultRow
              label="Dış Çap"
              value={`${formatNumberTr(result.value.selected.dis_cap_mm, 1)} mm`}
            />
            <ResultRow
              label="Net Ağırlık"
              value={`${formatNumberTr(result.value.selected.net_agirlik_kg_km, 0)} kg/km`}
            />
            <ResultRow
              label="Seçim Kaynağı"
              value={`${result.value.selected.nominal_kesit_mm2} etiketi (${result.dataVersion})`}
            />
          </div>
        </ResultPanel>
      )}
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
