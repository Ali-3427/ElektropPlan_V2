import type { CalculationResult } from "../../calculation-core/dist/index.js";
import type { CalculationsExport } from "../../contracts/src/index.js";

import type { ExportedFile } from "./shared.js";
import { encodeUtf8 } from "./shared.js";

export interface JsonExportOptions {
  indentation?: number;
}

export type JsonMetadata = Record<string, unknown>;

export interface JsonCalculationResultDocument<TValue, TMetadata extends JsonMetadata = JsonMetadata> {
  metadata: TMetadata;
  result: CalculationResult<TValue>;
}

function createJsonFile(payload: unknown, options: JsonExportOptions = {}): ExportedFile<"json"> {
  const indentation = options.indentation ?? 2;
  const json = `${JSON.stringify(payload, null, indentation)}\n`;

  return {
    format: "json",
    mimeType: "application/json",
    fileExtension: "json",
    data: encodeUtf8(json),
  };
}

export function exportCalculationResultToJson<TValue, TMetadata extends JsonMetadata = JsonMetadata>(
  document: JsonCalculationResultDocument<TValue, TMetadata>,
  options?: JsonExportOptions,
): ExportedFile<"json"> {
  return createJsonFile(document, options);
}

export function exportCalculationsToJson(
  document: CalculationsExport,
  options?: JsonExportOptions,
): ExportedFile<"json"> {
  return createJsonFile(document, options);
}
