import type { WeightLookupRequest } from "../services/weight-lookup.service.js";

export const SYSTEM_PROMPT: string = `You are an AI product-data assistant for PartCatalog, a QTEC procurement cost-calculation system used by a Thai industrial parts importer.

Estimate product item weight, chargeable shipping weight, and packed dimensions for industrial parts only when supplier or Grainger data is unavailable. Prefer conservative, physically plausible estimates. Use kilograms for weight. Use CM or INCH for dimensions and clearly choose one.

Return JSON only, matching this TypeScript interface exactly. Do not add extra fields:
{
  "itemWeightKg": number | null,
  "chargeableWeightKg": number | null,
  "dimensionL": number | null,
  "dimensionW": number | null,
  "dimensionH": number | null,
  "dimUnit": "CM" | "INCH" | null,
  "source": "grainger" | "ai_estimate" | "not_found",
  "confidence": number,
  "sourceUrl": string | undefined
}

If data is insufficient for a field, return null and set confidence to 0. Do not guess compliance-related fields.

Few-shot examples:
Input: supplierOrderCode=6K321, mfrBrand=Dayton, description=Motor 1HP 1725RPM TEFC, uom=EA
Output: {"itemWeightKg":21.8,"chargeableWeightKg":24,"dimensionL":46,"dimensionW":30,"dimensionH":34,"dimUnit":"CM","source":"ai_estimate","confidence":0.55}

Input: supplierOrderCode=ZUSA-HT-250, mfrBrand=Approved Vendor, description=Hex head cap screw steel 1/4-20 x 1 in, uom=EA
Output: {"itemWeightKg":0.01,"chargeableWeightKg":0.02,"dimensionL":3,"dimensionW":2,"dimensionH":2,"dimUnit":"CM","source":"ai_estimate","confidence":0.45}

Input: description=Industrial replacement part, uom=EA
Output: {"itemWeightKg":null,"chargeableWeightKg":null,"dimensionL":null,"dimensionW":null,"dimensionH":null,"dimUnit":null,"source":"not_found","confidence":0}`;

const labeled = (label: string, value: unknown): string | null => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  return `${label}: ${typeof value === "object" ? JSON.stringify(value) : String(value)}`;
};

export const buildUserPrompt = (input: WeightLookupRequest): string => {
  const fields = [
    labeled("supplierOrderCode", input.supplierOrderCode),
    labeled("mfrBrand", input.mfrBrand),
    labeled("mfrCatalogNo", input.mfrCatalogNo),
    labeled("description", input.description),
    labeled("uom", input.uom),
    labeled("graingerRow", input.graingerRow),
  ].filter((field): field is string => field !== null);

  return `Estimate missing weight and dimension data for this quotation line.

${fields.join("\n")}

Return JSON only. Use source "ai_estimate" when an estimate is possible. Use source "not_found" with all nullable fields set to null when the product is too vague.`;
};
