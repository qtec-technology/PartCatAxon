import type { JsonProvider } from "../providers/openai.provider.js";
import { SYSTEM_PROMPT, buildUserPrompt } from "../prompts/weight-lookup.prompt.js";

export interface WeightLookupRequest {
  supplierOrderCode?: string;
  mfrBrand?: string;
  mfrCatalogNo?: string;
  description: string;
  uom?: string;
  graingerRow?: {
    VendorStockItemNo: string;
    CWeight: number | null;
    ItemWeight: number | null;
    DimL: number | null;
    DimW: number | null;
    DimH: number | null;
    DimUnit: string | null;
  } | null;
}

export interface WeightLookupResult {
  itemWeightKg: number | null;
  chargeableWeightKg: number | null;
  dimensionL: number | null;
  dimensionW: number | null;
  dimensionH: number | null;
  dimUnit: "CM" | "INCH" | null;
  source: "grainger" | "ai_estimate" | "not_found";
  confidence: number;
  sourceUrl?: string;
}

const asNumberOrNull = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const normalizeDimUnit = (value: unknown): "CM" | "INCH" | null => {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toUpperCase();
  return normalized === "CM" || normalized === "INCH" ? normalized : null;
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const notFound = (): WeightLookupResult => ({
  itemWeightKg: null,
  chargeableWeightKg: null,
  dimensionL: null,
  dimensionW: null,
  dimensionH: null,
  dimUnit: null,
  source: "not_found",
  confidence: 0,
});

const normalizeAiResult = (result: WeightLookupResult): WeightLookupResult => {
  const normalized: WeightLookupResult = {
    itemWeightKg: asNumberOrNull(result.itemWeightKg),
    chargeableWeightKg: asNumberOrNull(result.chargeableWeightKg),
    dimensionL: asNumberOrNull(result.dimensionL),
    dimensionW: asNumberOrNull(result.dimensionW),
    dimensionH: asNumberOrNull(result.dimensionH),
    dimUnit: normalizeDimUnit(result.dimUnit),
    source: result.source === "not_found" ? "not_found" : "ai_estimate",
    confidence: asNumberOrNull(result.confidence) ?? 0,
  };

  const hasAnyEstimate =
    normalized.itemWeightKg !== null ||
    normalized.chargeableWeightKg !== null ||
    normalized.dimensionL !== null ||
    normalized.dimensionW !== null ||
    normalized.dimensionH !== null;

  if (!hasAnyEstimate || normalized.source === "not_found") {
    return notFound();
  }

  normalized.confidence = clamp(normalized.confidence, 0.3, 0.6);

  if (typeof result.sourceUrl === "string" && result.sourceUrl.trim() !== "") {
    normalized.sourceUrl = result.sourceUrl.trim();
  }

  return normalized;
};

export const lookupWeight = async (
  input: WeightLookupRequest,
  provider?: JsonProvider,
): Promise<WeightLookupResult> => {
  if (input.graingerRow !== undefined && input.graingerRow !== null) {
    return {
      itemWeightKg: input.graingerRow.ItemWeight,
      chargeableWeightKg: input.graingerRow.CWeight,
      dimensionL: input.graingerRow.DimL,
      dimensionW: input.graingerRow.DimW,
      dimensionH: input.graingerRow.DimH,
      dimUnit: normalizeDimUnit(input.graingerRow.DimUnit),
      source: "grainger",
      confidence: 0.95,
    };
  }

  if (provider === undefined) {
    return notFound();
  }

  try {
    const aiResult = await provider.generateJson<WeightLookupResult>({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: buildUserPrompt(input),
      temperature: 0.2,
      maxOutputTokens: 900,
    });

    return normalizeAiResult(aiResult);
  } catch {
    return notFound();
  }
};
