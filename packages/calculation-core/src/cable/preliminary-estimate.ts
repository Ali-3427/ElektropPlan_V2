import { J_REF_ALUMINUM, J_REF_COPPER } from "../common/constants/index.js";

export interface PreliminaryCableEstimateInput {
  referenceCurrentA: number;
  conductorMaterial: "copper" | "aluminum";
  correctionFactorProduct: number;
}

export interface PreliminaryCableEstimate {
  kind: "preliminary-j-hint";
  referenceCurrentA: number;
  currentDensityAperMm2: number;
  correctionFactorProduct: number;
  estimatedSectionMm2: number;
}

export function calculatePreliminaryCableEstimate(
  input: PreliminaryCableEstimateInput,
): PreliminaryCableEstimate {
  const currentDensityAperMm2 =
    input.conductorMaterial === "copper" ? J_REF_COPPER : J_REF_ALUMINUM;

  return {
    kind: "preliminary-j-hint",
    referenceCurrentA: input.referenceCurrentA,
    currentDensityAperMm2,
    correctionFactorProduct: input.correctionFactorProduct,
    estimatedSectionMm2:
      input.referenceCurrentA /
      (currentDensityAperMm2 * input.correctionFactorProduct),
  };
}
