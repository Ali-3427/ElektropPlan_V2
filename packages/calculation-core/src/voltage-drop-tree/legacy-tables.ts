import type {
  LegacyConductor,
  LegacyInstallation,
  LegacySectionOption,
} from "./types.js";

export const TEMP_FACTORS = {
  10: 1.22,
  15: 1.17,
  20: 1.12,
  25: 1.06,
  30: 1.0,
  35: 0.94,
  40: 0.87,
  45: 0.79,
  50: 0.71,
  55: 0.61,
  60: 0.5,
} as const satisfies Readonly<Record<number, number>>;

export const GROUP_FACTORS = {
  "1": 1.0,
  "2": 0.95,
  "3": 0.9,
  "4-6": 0.88,
  "7-9": 0.84,
  "10-12": 0.78,
  "13-15": 0.65,
  "16-20": 0.57,
} as const satisfies Readonly<Record<string, number>>;

export const COPPER_OVERHEAD = {
  "1.5": 19,
  "2.5": 26,
  "4": 34,
  "6": 44,
  "10": 61,
  "16": 82,
  "25": 109,
  "35": 135,
  "50": 165,
  "70": 210,
  "95": 250,
  "120": 285,
  "150": 320,
  "185": 355,
  "240": 415,
  "300": 470,
  "2120": 570,
  "2150": 640,
  "2185": 710,
  "2240": 830,
  "2300": 940,
  "3120": 855,
  "3150": 960,
  "3185": 1065,
  "3240": 1245,
  "3300": 1410,
  "4120": 1140,
  "4150": 1280,
  "4185": 1420,
  "4240": 1660,
  "4300": 1880,
} as const satisfies Readonly<Record<string, number>>;

export const COPPER_UNDERGROUND = {
  "1.5": 27,
  "2.5": 36,
  "4": 47,
  "6": 59,
  "10": 79,
  "16": 102,
  "25": 133,
  "35": 159,
  "50": 188,
  "70": 232,
  "95": 280,
  "120": 318,
  "150": 359,
  "185": 406,
  "240": 473,
  "300": 535,
  "2120": 636,
  "2150": 718,
  "2185": 812,
  "2240": 946,
  "2300": 1070,
  "3120": 954,
  "3150": 1077,
  "3185": 1218,
  "3240": 1419,
  "3300": 1605,
  "4120": 1272,
  "4150": 1436,
  "4185": 1624,
  "4240": 1892,
  "4300": 2140,
} as const satisfies Readonly<Record<string, number>>;

export const ALUMINUM_OVERHEAD = {
  "10": 46,
  "16": 61,
  "25": 79,
  "35": 98,
  "50": 116,
  "70": 146,
  "95": 176,
  "120": 202,
  "150": 226,
  "185": 255,
  "240": 292,
  "300": 330,
  "2120": 404,
  "2150": 452,
  "2185": 510,
  "2240": 584,
  "2300": 660,
  "3120": 606,
  "3150": 678,
  "3185": 765,
  "3240": 876,
  "3300": 990,
  "4120": 808,
  "4150": 904,
  "4185": 1020,
  "4240": 1168,
  "4300": 1320,
} as const satisfies Readonly<Record<string, number>>;

export const ALUMINUM_UNDERGROUND = {
  "10": 46,
  "16": 70,
  "25": 99,
  "35": 118,
  "50": 142,
  "70": 176,
  "95": 211,
  "120": 242,
  "150": 270,
  "185": 308,
  "240": 363,
  "300": 412,
  "2120": 484,
  "2150": 540,
  "2185": 616,
  "2240": 726,
  "2300": 824,
  "3120": 726,
  "3150": 810,
  "3185": 924,
  "3240": 1089,
  "3300": 1236,
  "4120": 968,
  "4150": 1080,
  "4185": 1232,
  "4240": 1452,
  "4300": 1648,
} as const satisfies Readonly<Record<string, number>>;

export const LEGACY_SECTION_OPTIONS: readonly LegacySectionOption[] = [
  { key: "1.5", label: "1.5 mm2", areaMm2: 1.5, singleRunAreaMm2: 1.5, parallelRuns: 1 },
  { key: "2.5", label: "2.5 mm2", areaMm2: 2.5, singleRunAreaMm2: 2.5, parallelRuns: 1 },
  { key: "4", label: "4 mm2", areaMm2: 4, singleRunAreaMm2: 4, parallelRuns: 1 },
  { key: "6", label: "6 mm2", areaMm2: 6, singleRunAreaMm2: 6, parallelRuns: 1 },
  { key: "10", label: "10 mm2", areaMm2: 10, singleRunAreaMm2: 10, parallelRuns: 1 },
  { key: "16", label: "16 mm2", areaMm2: 16, singleRunAreaMm2: 16, parallelRuns: 1 },
  { key: "25", label: "25 mm2", areaMm2: 25, singleRunAreaMm2: 25, parallelRuns: 1 },
  { key: "35", label: "35 mm2", areaMm2: 35, singleRunAreaMm2: 35, parallelRuns: 1 },
  { key: "50", label: "50 mm2", areaMm2: 50, singleRunAreaMm2: 50, parallelRuns: 1 },
  { key: "70", label: "70 mm2", areaMm2: 70, singleRunAreaMm2: 70, parallelRuns: 1 },
  { key: "95", label: "95 mm2", areaMm2: 95, singleRunAreaMm2: 95, parallelRuns: 1 },
  { key: "120", label: "120 mm2", areaMm2: 120, singleRunAreaMm2: 120, parallelRuns: 1 },
  { key: "150", label: "150 mm2", areaMm2: 150, singleRunAreaMm2: 150, parallelRuns: 1 },
  { key: "185", label: "185 mm2", areaMm2: 185, singleRunAreaMm2: 185, parallelRuns: 1 },
  { key: "240", label: "240 mm2", areaMm2: 240, singleRunAreaMm2: 240, parallelRuns: 1 },
  { key: "300", label: "300 mm2", areaMm2: 300, singleRunAreaMm2: 300, parallelRuns: 1 },
  { key: "2120", label: "2 x 120 mm2", areaMm2: 240, singleRunAreaMm2: 120, parallelRuns: 2 },
  { key: "2150", label: "2 x 150 mm2", areaMm2: 300, singleRunAreaMm2: 150, parallelRuns: 2 },
  { key: "2185", label: "2 x 185 mm2", areaMm2: 370, singleRunAreaMm2: 185, parallelRuns: 2 },
  { key: "2240", label: "2 x 240 mm2", areaMm2: 480, singleRunAreaMm2: 240, parallelRuns: 2 },
  { key: "2300", label: "2 x 300 mm2", areaMm2: 600, singleRunAreaMm2: 300, parallelRuns: 2 },
  { key: "3120", label: "3 x 120 mm2", areaMm2: 360, singleRunAreaMm2: 120, parallelRuns: 3 },
  { key: "3150", label: "3 x 150 mm2", areaMm2: 450, singleRunAreaMm2: 150, parallelRuns: 3 },
  { key: "3185", label: "3 x 185 mm2", areaMm2: 555, singleRunAreaMm2: 185, parallelRuns: 3 },
  { key: "3240", label: "3 x 240 mm2", areaMm2: 720, singleRunAreaMm2: 240, parallelRuns: 3 },
  { key: "3300", label: "3 x 300 mm2", areaMm2: 900, singleRunAreaMm2: 300, parallelRuns: 3 },
  { key: "4120", label: "4 x 120 mm2", areaMm2: 480, singleRunAreaMm2: 120, parallelRuns: 4 },
  { key: "4150", label: "4 x 150 mm2", areaMm2: 600, singleRunAreaMm2: 150, parallelRuns: 4 },
  { key: "4185", label: "4 x 185 mm2", areaMm2: 740, singleRunAreaMm2: 185, parallelRuns: 4 },
  { key: "4240", label: "4 x 240 mm2", areaMm2: 960, singleRunAreaMm2: 240, parallelRuns: 4 },
  { key: "4300", label: "4 x 300 mm2", areaMm2: 1200, singleRunAreaMm2: 300, parallelRuns: 4 },
] as const;

const SECTION_OPTION_BY_KEY: Readonly<Record<string, LegacySectionOption>> = Object.freeze(
  Object.fromEntries(LEGACY_SECTION_OPTIONS.map((item) => [item.key, item])),
);

const ALUMINUM_KEYS = LEGACY_SECTION_OPTIONS.filter(
  (item) => item.key in ALUMINUM_OVERHEAD && item.key in ALUMINUM_UNDERGROUND,
).map((item) => item.key);

const COPPER_KEYS = LEGACY_SECTION_OPTIONS.filter(
  (item) => item.key in COPPER_OVERHEAD && item.key in COPPER_UNDERGROUND,
).map((item) => item.key);

export function getSectionOption(key: string): LegacySectionOption {
  const option = SECTION_OPTION_BY_KEY[key];
  if (!option) {
    throw new RangeError(`unknown legacy section key: ${key}`);
  }
  return option;
}

export function getNextSectionOption(
  key: string,
  conductor: LegacyConductor,
): LegacySectionOption | null {
  const keys = conductor === "aluminum" ? ALUMINUM_KEYS : COPPER_KEYS;
  const currentIndex = keys.indexOf(key);
  if (currentIndex === -1) {
    throw new RangeError(`section key ${key} is not defined for conductor: ${conductor}`);
  }
  const nextKey = keys[currentIndex + 1];
  return nextKey ? getSectionOption(nextKey) : null;
}

export function getAmpacityTable(
  conductor: LegacyConductor,
  installation: LegacyInstallation,
): Readonly<Record<string, number>> {
  if (conductor === "copper") {
    return installation === "underground" ? COPPER_UNDERGROUND : COPPER_OVERHEAD;
  }
  return installation === "underground" ? ALUMINUM_UNDERGROUND : ALUMINUM_OVERHEAD;
}

export function getTemperatureFactor(temperatureC: number): number {
  const normalizedTemperature = Math.trunc(temperatureC);
  return TEMP_FACTORS[normalizedTemperature as keyof typeof TEMP_FACTORS] ?? 1.0;
}

export function getGroupFactorResult(groupedCircuits: number): {
  factor: number;
  warning?: string;
} {
  if (groupedCircuits <= 1) {
    return { factor: GROUP_FACTORS["1"] };
  }
  if (groupedCircuits === 2) {
    return { factor: GROUP_FACTORS["2"] };
  }
  if (groupedCircuits === 3) {
    return { factor: GROUP_FACTORS["3"] };
  }
  if (groupedCircuits <= 6) {
    return { factor: GROUP_FACTORS["4-6"] };
  }
  if (groupedCircuits <= 9) {
    return { factor: GROUP_FACTORS["7-9"] };
  }
  if (groupedCircuits <= 12) {
    return { factor: GROUP_FACTORS["10-12"] };
  }
  if (groupedCircuits <= 15) {
    return { factor: GROUP_FACTORS["13-15"] };
  }
  if (groupedCircuits <= 20) {
    return { factor: GROUP_FACTORS["16-20"] };
  }

  return {
    factor: GROUP_FACTORS["16-20"],
    warning: `groupedCircuits ${groupedCircuits} exceeds supported range; using 16-20 factor`,
  };
}

export function getGroupFactor(groupedCircuits: number): number {
  return getGroupFactorResult(groupedCircuits).factor;
}

