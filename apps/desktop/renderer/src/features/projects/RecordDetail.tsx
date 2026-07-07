import { useState, type ReactNode } from "react";

import type { CalculationRecord } from "../../bridge/types";
import { formatAmp, formatNumberTr, formatPercent, formatVolt } from "../../i18n/format";
import { Button } from "../../ui/Button";
import { useProjectMutations } from "./projectMutations";
import {
  CALCULATOR_LABELS,
  getRecordDisplayTitle,
  getRecordUnitCurrentA,
} from "./useProjectsData";
import styles from "./RecordDetail.module.css";

interface RecordDetailProps {
  record: CalculationRecord;
  quantity: number;
  onQuantityChange: (quantity: number) => void;
  onDelete: () => void;
}

export function RecordDetail({
  record,
  quantity,
  onQuantityChange,
  onDelete,
}: RecordDetailProps) {
  const mutations = useProjectMutations();
  const unitCurrentA = getRecordUnitCurrentA(record);
  const totalCurrentA = unitCurrentA * quantity;

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div>
          <div className={styles.eyebrow}>{CALCULATOR_LABELS[record.calculator]}</div>
          <h2 className={styles.title}>{getRecordDisplayTitle(record)}</h2>
        </div>
        <Button variant="danger" onClick={onDelete}>
          Sil
        </Button>
      </div>

      <div className={styles.grid}>
        <Row label="Hesap tipi" value={CALCULATOR_LABELS[record.calculator]} />
        <Row label="Kontrat" value={record.version.contractVersion} />
        {record.version.engineVersion ? (
          <Row label="Engine" value={record.version.engineVersion} />
        ) : null}
        {record.version.dataVersion ? <Row label="Data" value={record.version.dataVersion} /> : null}
        <Row label="Adet">
          <input
            className={styles.quantityInput}
            min={1}
            step={1}
            type="number"
            value={quantity}
            onChange={(event) => onQuantityChange(Math.max(1, Math.trunc(Number(event.target.value)) || 1))}
          />
        </Row>

        {record.calculator === "motor" ? (
          <MotorRows record={record} totalCurrentA={totalCurrentA} />
        ) : null}
        {record.calculator === "cable" ? <CableRows record={record} /> : null}
        {record.calculator === "voltage-drop" ? <VoltageDropRows record={record} /> : null}
        {record.calculator === "voltage-drop-group" ? (
          <VoltageDropGroupRows record={record} />
        ) : null}
        {record.calculator === "protection" ? <ProtectionRows record={record} /> : null}
        {record.calculator === "manual-current" ? (
          <ManualCurrentRows key={record.id} record={record} mutations={mutations} />
        ) : null}
      </div>
    </div>
  );
}

function MotorRows({
  record,
  totalCurrentA,
}: {
  record: Extract<CalculationRecord, { calculator: "motor" }>;
  totalCurrentA: number;
}) {
  const outputValue = record.output.value;
  const suggestedCable =
    outputValue.mode === "formula" ? outputValue.suggestedCableSection : undefined;

  return (
    <>
      <Row label="Mod" value={outputValue.mode === "formula" ? "Formul" : "Tablo"} />
      {outputValue.mode === "formula" ? (
        <>
          <Row label="Faz" value={String(outputValue.phase)} />
          <Row label="Gerilim" value={formatVolt(outputValue.voltage, 0)} />
          <Row label="P cikis" value={`${formatNumberTr(outputValue.P_out, 3)} kW`} />
          <Row label="Giris gucu" value={`${formatNumberTr(outputValue.inputPowerKW, 3)} kW`} />
          <Row
            label="Gorunur guc"
            value={`${formatNumberTr(outputValue.apparentPowerKVA, 3)} kVA`}
          />
          <Row label="cosPhi" value={formatNumberTr(outputValue.cosPhi, 3)} />
          <Row label="Verim" value={formatPercent(outputValue.efficiencyPercent, 1)} />
        </>
      ) : (
        <>
          <Row label="Guc" value={`${formatNumberTr(outputValue.kW, 2)} kW`} />
          <Row label="PS" value={`${formatNumberTr(outputValue.PS, 2)} PS`} />
          <Row label="Gerilim" value={`${record.input.voltage} V`} />
          <Row label="cosPhi" value={formatNumberTr(outputValue.cosPhi, 3)} />
          <Row label="Verim" value={formatPercent(outputValue.efficiencyPercent, 1)} />
          <Row label="Kablo spec" value={outputValue.cableSpec} />
        </>
      )}

      <Row label="Birim akim" value={formatAmp(outputValue.currentA, 2)} highlight />
      <Row label="Toplam akim" value={formatAmp(totalCurrentA, 2)} highlight />
      {suggestedCable ? (
        <Row
          label="Kablo onerisi"
          value={`${suggestedCable.label} mm2 (${formatAmp(suggestedCable.ampacityA, 0)})`}
        />
      ) : null}
      {suggestedCable?.standardHintMm2 !== undefined ? (
        <Row
          label="Standart kesit"
          value={`${formatNumberTr(suggestedCable.standardHintMm2, 1)} mm2`}
        />
      ) : null}
    </>
  );
}

function CableRows({
  record,
}: {
  record: Extract<CalculationRecord, { calculator: "cable" }>;
}) {
  return (
    <>
      <Row label="Tasarim akimi" value={formatAmp(record.output.value.designCurrentA, 2)} />
      <Row label="Faz" value={String(record.input.phase)} />
      <Row
        label="Malzeme"
        value={record.input.conductorMaterial === "copper" ? "Bakir" : "Aluminyum"}
      />
      <Row label="Metot" value={record.input.installationMethod} />
      <Row
        label="Secilen kesit"
        value={`${formatNumberTr(record.output.value.selectedSectionMm2, 1)} mm2`}
        highlight
      />
      <Row
        label="Duzeltilmis ampasite"
        value={formatAmp(record.output.value.correctedAmpacityA, 2)}
      />
      <Row
        label="Gerilim dusumu"
        value={formatPercent(record.output.value.vdResult.value.deltaVPercent, 2)}
      />
    </>
  );
}

function VoltageDropRows({
  record,
}: {
  record: Extract<CalculationRecord, { calculator: "voltage-drop" }>;
}) {
  return (
    <>
      <Row label="Sistem" value={record.output.value.systemType} />
      <Row label="Akim" value={formatAmp(record.output.value.currentA, 2)} />
      <Row label="Uzunluk" value={`${formatNumberTr(record.output.value.lengthM, 1)} m`} />
      <Row label="Kesit" value={`${formatNumberTr(record.output.value.sectionMm2, 1)} mm2`} />
      <Row label="Delta V" value={formatVolt(record.output.value.deltaVVolts, 3)} highlight />
      <Row
        label="Delta V %"
        value={formatPercent(record.output.value.deltaVPercent, 2)}
        highlight
      />
    </>
  );
}

function ProtectionRows({
  record,
}: {
  record: Extract<CalculationRecord, { calculator: "protection" }>;
}) {
  const recommendationCount = Array.isArray(record.output) ? record.output.length : 0;

  return (
    <>
      <Row label="Min akim" value={formatAmp(record.input.minimumNominalCurrentA, 2)} />
      <Row label="Aileler" value={record.input.families?.join(", ") ?? "Tumu"} />
      <Row label="Kutup" value={record.input.poles ? String(record.input.poles) : "Serbest"} />
      <Row label="Oneri sayisi" value={String(recommendationCount)} highlight />
    </>
  );
}

function ManualCurrentRows({
  record,
  mutations,
}: {
  record: Extract<CalculationRecord, { calculator: "manual-current" }>;
  mutations: ReturnType<typeof useProjectMutations>;
}) {
  const [label, setLabel] = useState(record.input.label ?? "");
  const [currentA, setCurrentA] = useState(String(record.input.currentA));
  const [saveError, setSaveError] = useState<string | null>(null);

  const parsedCurrentA = Number(currentA);
  const isValid = Number.isFinite(parsedCurrentA) && parsedCurrentA > 0;

  const handleSave = () => {
    if (!isValid) {
      return;
    }

    const trimmedLabel = label.trim();

    setSaveError(null);
    mutations
      .updateManualCurrent({
        record,
        ...(trimmedLabel ? { label: trimmedLabel } : {}),
        currentA: parsedCurrentA,
      })
      .catch((error: unknown) => {
        setSaveError(error instanceof Error ? error.message : "Kayit guncellenemedi.");
      });
  };

  return (
    <>
      <Row label="Etiket">
        <input
          className={styles.manualCurrentInput}
          type="text"
          value={label}
          onChange={(event) => setLabel(event.target.value)}
        />
      </Row>
      <Row label="Akim (A)">
        <input
          className={styles.manualCurrentInput}
          min={0}
          step="any"
          type="number"
          value={currentA}
          onChange={(event) => setCurrentA(event.target.value)}
        />
      </Row>
      <Row label="">
        <Button onClick={handleSave} disabled={!isValid}>
          Kaydet
        </Button>
      </Row>
      {saveError ? (
        <Row label="">
          <span className={styles.errorText}>{saveError}</span>
        </Row>
      ) : null}
    </>
  );
}

function VoltageDropGroupRows({
  record,
}: {
  record: Extract<CalculationRecord, { calculator: "voltage-drop-group" }>;
}) {
  const output = record.output.value;

  return (
    <>
      <Row label="Sistem" value={formatVoltageDropGroupSystemType(output.settings.systemType)} />
      <Row label="Faz modu" value={formatVoltageDropGroupPhaseMode(output.settings.phaseMode)} />
      <Row label="Gerilim" value={formatVolt(output.settings.baseVoltageV, 0)} />
      <Row label="Limit" value={formatPercent(output.settings.limitPercent, 2)} />
      <Row label="Toplam güç" value={`${formatNumberTr(output.totalLocalPowerKW, 2)} kW`} />
      <Row
        label="Maks kümülatif VD"
        value={formatPercent(output.maxCumulativeDeltaVPercent, 2)}
        highlight
      />
      <Row label="Durum" value={output.isCompliant ? "Uygun" : "Limit aşımı"} highlight={output.isCompliant} />
      <Row label="Segment" value={`${output.segments.length} adet`} />
      <Row label="İletken" value={formatVoltageDropGroupMaterial(output.settings.conductorMaterial)} />
      <Row label="Montaj metodu" value={output.settings.installationMethod} />
      <Row label="İzolasyon" value={formatVoltageDropGroupInsulation(output.settings.insulationRating)} />
      <Row label="cosPhi" value={formatNumberTr(output.settings.cosPhi, 3)} />
      <Row label="Verim" value={formatPercent(output.settings.efficiencyPercent, 1)} />
      <Row label="Ortam" value={`${formatNumberTr(output.settings.ambientTemperatureC, 0)} °C`} />
      <Row label="Kümeli devre" value={formatNumberTr(output.settings.groupedCircuits, 0)} />
      <Row label="İletken sıcaklığı" value={`${formatNumberTr(output.settings.conductorTempC, 0)} °C`} />
      <Row label="İmpedans modu" value={formatVoltageDropGroupImpedanceMode(output.settings.impedanceMode)} />
      {typeof output.settings.reactanceOhmPerKm === "number" ? (
        <Row label="Reaktans" value={`${formatNumberTr(output.settings.reactanceOhmPerKm, 3)} Ω/km`} />
      ) : null}

      <div className={styles.segmentSection}>
        <div className={styles.sectionTitle}>Segmentler</div>
        <div className={styles.tableWrap}>
          <div className={styles.segmentTable}>
            <div className={`${styles.segmentRow} ${styles.segmentHeader}`}>
              <span>Segment</span>
              <span>Yerel kW</span>
              <span>Hat kW</span>
              <span>Akım</span>
              <span>Uzunluk</span>
              <span>Kesit</span>
              <span>ΔV</span>
              <span>ΣΔV</span>
              <span>Durum</span>
            </div>
            {output.segments.map((segment) => (
              <div key={`${segment.order}-${segment.title}`} className={styles.segmentRow}>
                <span>{segment.title}</span>
                <span>{formatNumberTr(segment.localPowerKW, 2)} kW</span>
                <span>{formatNumberTr(segment.flowPowerKW, 2)} kW</span>
                <span>{formatAmp(segment.currentA, 2)}</span>
                <span>{formatNumberTr(segment.lengthM, 1)} m</span>
                <span>{formatNumberTr(segment.selectedSectionMm2, 1)} mm²</span>
                <span>{formatPercent(segment.segmentDeltaVPercent, 2)}</span>
                <span>{formatPercent(segment.cumulativeDeltaVPercent, 2)}</span>
                <span>{segment.compliant ? "Uygun" : "Aşım"}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {output.optimizationSteps.length > 0 ? (
        <div className={styles.stepsSection}>
          <div className={styles.sectionTitle}>Optimizasyon adımları</div>
          <div className={styles.stepList}>
            {output.optimizationSteps.map((step) => (
              <div
                key={`${step.iteration}-${step.segmentOrder}-${step.fromSectionMm2}-${step.toSectionMm2}`}
                className={styles.stepItem}
              >
                <div className={styles.stepTitle}>
                  #{step.iteration} {step.segmentTitle}
                </div>
                <div className={styles.stepMeta}>
                  {formatNumberTr(step.fromSectionMm2, 1)} mm² → {formatNumberTr(step.toSectionMm2, 1)} mm²
                </div>
                <div className={styles.stepMeta}>
                  SI {formatNumberTr(step.sensitivityIndex, 4)} · {formatPercent(step.previousMaxCumulativeDeltaVPercent, 2)} →{" "}
                  {formatPercent(step.nextMaxCumulativeDeltaVPercent, 2)}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </>
  );
}

function formatVoltageDropGroupSystemType(systemType: "single-phase-ac-two-conductor" | "three-phase-ac-ll") {
  return systemType === "single-phase-ac-two-conductor" ? "Tek faz / 2 iletken" : "Üç faz / L-L";
}

function formatVoltageDropGroupPhaseMode(phaseMode: "auto" | "single-phase" | "three-phase") {
  if (phaseMode === "auto") {
    return "Otomatik";
  }

  return phaseMode === "single-phase" ? "Tek faz" : "Üç faz";
}

function formatVoltageDropGroupMaterial(material: "copper" | "aluminum") {
  return material === "copper" ? "Bakır" : "Alüminyum";
}

function formatVoltageDropGroupInsulation(insulation: "PVC_70C" | "XLPE_EPR_90C") {
  return insulation === "PVC_70C" ? "PVC 70 °C" : "XLPE/EPR 90 °C";
}

function formatVoltageDropGroupImpedanceMode(mode: "simplified" | "exact-ac") {
  return mode === "simplified" ? "Basitleştirilmiş" : "Tam AC";
}

function Row({
  label,
  value,
  children,
  highlight = false,
}: {
  label: string;
  value?: string;
  children?: ReactNode;
  highlight?: boolean;
}) {
  return (
    <div className={`${styles.row} ${highlight ? styles.rowHighlight : ""}`}>
      <span className={styles.label}>{label}</span>
      <div className={styles.value}>{children ?? value ?? "-"}</div>
    </div>
  );
}
