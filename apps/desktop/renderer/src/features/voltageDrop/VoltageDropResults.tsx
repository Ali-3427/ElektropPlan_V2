import {
  formatAmp,
  formatNumberTr,
  formatPercent,
} from "../../i18n/format";
import type {
  VoltageDropGroupResponse,
  VoltageDropGroupSegmentResult,
} from "./voltageDropGroup";
import { formatVoltageDropSectionLabel } from "./voltageDropGroup";
import styles from "./VoltageDropResults.module.css";

interface VoltageDropResultsProps {
  result: VoltageDropGroupResponse;
  groupTitle: string;
}

function resolveStatusLabel(segment: VoltageDropGroupSegmentResult): string {
  if (segment.compliant) {
    return "Uygun";
  }
  if (!segment.thermalPass && !segment.voltageDropPass) {
    return "Termik + DV";
  }
  if (!segment.thermalPass) {
    return "Termik";
  }
  if (!segment.voltageDropPass) {
    return "Dusum";
  }
  return "Kontrol";
}

export function VoltageDropResults({ result, groupTitle }: VoltageDropResultsProps) {
  const title = result.value.title || groupTitle.trim() || "Gerilim dusumu grubu";
  const titleById = new Map<string, string>();
  for (const segment of result.value.segments) {
    if (segment.id) {
      titleById.set(segment.id, segment.title);
    }
  }

  return (
    <div className={styles.root}>
      <div className={styles.resultTop}>
        <div>
          <div className={styles.resultTitle}>{title}</div>
          <div className={styles.resultSubtitle}>Segment bazli grup sonucu</div>
        </div>
        <div
          className={`${styles.statusPill} ${
            result.value.isCompliant ? styles.statusOk : styles.statusBad
          }`}
        >
          {result.value.isCompliant ? "Uygun" : "Uygun degil"}
        </div>
      </div>

      <div className={styles.summaryStrip}>
        <Metric label="Toplam yuk" value={`${formatNumberTr(result.value.totalLocalPowerKW, 2)} kW`} />
        <Metric
          label="Maks. kumulatif dusum"
          value={formatPercent(result.value.maxCumulativeDeltaVPercent, 2)}
          highlight
        />
        <Metric
          label="Limit"
          value={formatPercent(result.value.settings.limitPercent, 2)}
        />
        <Metric
          label="Uyumluluk"
          value={result.value.isCompliant ? "Uygun" : "Uygun degil"}
        />
        <Metric
          label="Optimizasyon"
          value={`${result.value.optimizationSteps.length} adim`}
        />
      </div>

      <div className={styles.tableSection}>
        <div className={styles.tableTitle}>Brans tablosu</div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <caption className={styles.srOnly}>Brans tablosu</caption>
            <thead>
              <tr>
                <th scope="col">Segment</th>
                <th scope="col">Ust</th>
                <th scope="col">Yol</th>
                <th scope="col">Akis kW</th>
                <th scope="col">Akim A</th>
                <th scope="col">Hesaplanan kesit</th>
                <th scope="col">Ampasite</th>
                <th scope="col">Segment DV</th>
                <th scope="col">Kumulatif DV</th>
                <th scope="col">Durum</th>
              </tr>
            </thead>
            <tbody>
              {result.value.segments.map((segment) => {
                const parentTitle =
                  segment.parentId && titleById.has(segment.parentId)
                    ? titleById.get(segment.parentId)
                    : "-";
                const pathTitle =
                  segment.pathIds && segment.pathIds.length > 0
                    ? segment.pathIds.map((id) => titleById.get(id) ?? id).join(" > ")
                    : segment.title;
                const statusLabel = resolveStatusLabel(segment);
                const isCompliant = segment.compliant && segment.thermalPass && segment.voltageDropPass;
                const statusPrefix = isCompliant ? "OK" : "HATA";

                return (
                  <tr
                    key={segment.id ?? String(segment.order)}
                    className={isCompliant ? styles.rowOk : undefined}
                  >
                    <td className={styles.segmentNameCell}>{segment.title}</td>
                    <td>{parentTitle}</td>
                    <td>{pathTitle}</td>
                    <td>{formatNumberTr(segment.flowPowerKW, 2)}</td>
                    <td>{formatAmp(segment.currentA, 2)}</td>
                    <td>{formatVoltageDropSectionLabel(segment)}</td>
                    <td>{formatAmp(segment.correctedAmpacityA, 2)}</td>
                    <td>{formatPercent(segment.segmentDeltaVPercent, 2)}</td>
                    <td>{formatPercent(segment.cumulativeDeltaVPercent, 2)}</td>
                    <td>
                      <span
                        className={`${styles.statusPill} ${
                          isCompliant ? styles.statusOk : styles.statusBad
                        }`}
                      >
                        {statusPrefix}: {statusLabel}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className={`${styles.metric} ${highlight ? styles.metricHighlight : ""}`}>
      <span className={styles.metricLabel}>{label}</span>
      <span className={styles.metricValue}>{value}</span>
    </div>
  );
}
