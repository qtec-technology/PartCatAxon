import { OpenAIProvider } from "../providers/openai.provider.js";
import type { JsonProvider } from "../providers/openai.provider.js";
import { SYSTEM_PROMPT, buildUserPrompt } from "../prompts/hscode.prompt.js";

export interface HSCodeRequest {
  description: string;
  mfrBrand?: string;
  itemCategory?: string;
  countryOfOrigin?: string;
  historicalMatches?: Array<{
    description: string;
    hsCode: string;
    dutyPercent: number;
  }>;
}

export interface HSCodeResult {
  hsCode: string | null;
  dutyPercent: number | null;
  excisePercent: number | null;
  confidence: number;
  reasoning: string;
  alternativeCodes?: Array<{
    hsCode: string;
    dutyPercent: number;
    confidence: number;
  }>;
}

const asNumberOrNull = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const normalizeHsCode = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const digits = value.replace(/\D/g, "");

  if (digits.length !== 8) {
    return null;
  }

  return `${digits.slice(0, 4)}.${digits.slice(4, 6)}.${digits.slice(6, 8)}`;
};

const normalizeAlternatives = (
  alternatives: HSCodeResult["alternativeCodes"],
): HSCodeResult["alternativeCodes"] => {
  if (!Array.isArray(alternatives)) {
    return undefined;
  }

  const normalized = alternatives
    .map((alternative) => {
      const hsCode = normalizeHsCode(alternative.hsCode);
      const dutyPercent = asNumberOrNull(alternative.dutyPercent);
      const confidence = asNumberOrNull(alternative.confidence);

      if (hsCode === null || dutyPercent === null || confidence === null) {
        return null;
      }

      return {
        hsCode,
        dutyPercent,
        confidence: clamp(confidence, 0, 1),
      };
    })
    .filter((alternative): alternative is NonNullable<typeof alternative> => alternative !== null);

  return normalized.length > 0 ? normalized : undefined;
};

const nullResult = (reasoning: string): HSCodeResult => ({
  hsCode: null,
  dutyPercent: null,
  excisePercent: null,
  confidence: 0,
  reasoning,
});

const normalizeAiResult = (input: HSCodeRequest, result: HSCodeResult): HSCodeResult => {
  const hasHistoricalMatches = (input.historicalMatches?.length ?? 0) > 0;
  const confidenceCap = hasHistoricalMatches ? 1 : 0.49;
  const confidence = clamp(asNumberOrNull(result.confidence) ?? 0, 0, confidenceCap);
  const hsCode = normalizeHsCode(result.hsCode);
  const dutyPercent = asNumberOrNull(result.dutyPercent);
  const excisePercent = asNumberOrNull(result.excisePercent);
  const reasoning =
    typeof result.reasoning === "string" && result.reasoning.trim() !== ""
      ? result.reasoning.trim()
      : "No reasoning returned by classifier.";

  if (confidence === 0 || hsCode === null || dutyPercent === null) {
    return nullResult(reasoning);
  }

  const normalized: HSCodeResult = {
    hsCode,
    dutyPercent,
    excisePercent,
    confidence,
    reasoning,
  };

  const alternativeCodes = normalizeAlternatives(result.alternativeCodes);
  if (alternativeCodes !== undefined) {
    normalized.alternativeCodes = alternativeCodes;
  }

  return normalized;
};

export const suggestHSCode = async (
  input: HSCodeRequest,
  provider?: JsonProvider,
): Promise<HSCodeResult> => {
  // GPT is preferred here because HS classification benefits from structured tariff reasoning.
  const aiProvider = provider ?? new OpenAIProvider();

  try {
    const aiResult = await aiProvider.generateJson<HSCodeResult>({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: buildUserPrompt(input),
      temperature: 0.1,
      maxOutputTokens: 1_100,
    });

    return normalizeAiResult(input, aiResult);
  } catch {
    return nullResult("Unable to classify HS code from the available data.");
  }
};
