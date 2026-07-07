import type { DatasetWithMetadata } from "../../dataset/types.js";

export type CableRulerAmbient = "toprak_20C" | "hava_30C";

export interface CableRulerEntry {
  nominal_kesit_mm2: string;
  sectionMm2: number;
  dis_cap_mm: number;
  net_agirlik_kg_km: number;
  sevk_uzunlugu_m: number;
  dc_direnc_ohm_km_20C: number;
  akim_toprak_20C_A: number | null;
  akim_hava_30C_A: number | null;
}

export const CABLE_RULER_COLUMNS = [
  "nominal_kesit_mm2",
  "dis_cap_mm",
  "net_agirlik_kg_km",
  "sevk_uzunlugu_m",
  "dc_direnc_ohm_km_20C",
  "akim_toprak_20C_A",
  "akim_hava_30C_A",
] as const;

export type CableRulerColumn = (typeof CABLE_RULER_COLUMNS)[number];

export interface CableRulerDataset extends DatasetWithMetadata {
  columns: readonly CableRulerColumn[];
  entries: readonly CableRulerEntry[];
}
