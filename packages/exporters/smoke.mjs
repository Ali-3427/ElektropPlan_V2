import assert from "node:assert/strict";

import {
  exportCalculationsToExcel,
  exportCalculationsToJson,
  exportPresentationToPdf,
} from "./dist/index.js";

const sampleMotorResult = {
  value: {
    mode: "formula",
    currentA: 15.2,
    apparentPowerKVA: 10.5,
  },
  warnings: [{ code: "input-rounded", messageKey: "motor.inputRounded", detail: "Display only" }],
  assumptions: [{ field: "efficiencyPercent", usedValue: 91, source: "default" }],
  formulaVariant: "iec-formula",
  dataVersion: "2026.04",
  engineVersion: "1.2.3",
};

const sampleExport = {
  version: {
    contractVersion: "1.0.0",
    engineVersion: "1.2.3",
    dataVersion: "2026.04",
  },
  exportedAt: "2026-04-19T20:00:00.000Z",
  groups: [],
  records: [
    {
      id: "motor-1",
      calculator: "motor",
      title: "Main Pump Motor",
      version: {
        contractVersion: "1.0.0",
        engineVersion: "1.2.3",
        dataVersion: "2026.04",
      },
      input: {
        mode: "formula",
        phase: 3,
        P_out: 7.5,
        voltage: 400,
        cosPhi: 0.85,
        efficiencyPercent: 91,
        voltageMode: "LL",
      },
      output: sampleMotorResult,
    },
    {
      id: "protection-1",
      calculator: "protection",
      title: "Branch Protection",
      version: {
        contractVersion: "1.0.0",
      },
      input: {
        minimumNominalCurrentA: 16,
        families: ["MCB"],
      },
      output: [
        {
          id: "mcb-16",
          family: "MCB",
          curve: "C",
          ratings: {
            nominalCurrentA: 16,
            breakingCapacityKa: 6,
            residualCurrentMa: null,
            voltageV: 400,
            poles: 3,
          },
          sourceNote: "IEC sample",
          device: {
            id: "mcb-16",
            family: "MCB",
            poles: 3,
            nominalCurrentA: 16,
            breakingCapacityKa: 6,
            curve: "C",
            residualCurrentMa: null,
            voltageV: 400,
            sourceNote: "IEC sample",
          },
        },
      ],
    },
  ],
};

const json = exportCalculationsToJson(sampleExport);
assert.deepEqual(JSON.parse(Buffer.from(json.data).toString("utf8")), sampleExport);

const excel = exportCalculationsToExcel(sampleExport);
const excelXml = Buffer.from(excel.data).toString("utf8");
assert.match(excelXml, /Worksheet ss:Name="Motor"/);
assert.match(excelXml, /Worksheet ss:Name="Protection"/);
assert.match(excelXml, /input\.phase/);
assert.match(excelXml, /output\.formulaVariant/);
assert.match(excelXml, /warnings\[0\]\.input-rounded/);

const pdf = exportPresentationToPdf({
  title: "Calculation Summary",
  subtitle: "Pre-rounded values only",
  exportedAt: "2026-04-19 23:00 +03:00",
  records: [
    {
      id: "motor-1",
      calculator: "motor",
      title: "Main Pump Motor",
      sections: [
        {
          title: "Inputs",
          rows: [
            { label: "Voltage", value: "400 V" },
            { label: "Power", value: "7.50 kW" },
          ],
        },
        {
          title: "Outputs",
          rows: [{ label: "Current", value: "15.20 A" }],
        },
      ],
    },
  ],
});
const pdfText = Buffer.from(pdf.data).toString("utf8");
assert.match(pdfText, /^%PDF-1\.4/);
assert.match(pdfText, /Calculation Summary/);
assert.match(pdfText, /15\.20 A/);

console.log("exporters smoke tests passed");
