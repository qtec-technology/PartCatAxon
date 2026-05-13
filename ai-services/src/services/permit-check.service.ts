import { OpenAIProvider } from "../providers/openai.provider.js";
import type { JsonProvider } from "../providers/openai.provider.js";
import { SYSTEM_PROMPT, buildUserPrompt } from "../prompts/permit-check.prompt.js";

export interface PermitCheckRequest {
  description: string;
  hsCode?: string;
  itemCategory?: string;
  mfrBrand?: string;
  countryOfOrigin?: string;
  rulesContext?: Array<{
    category: string;
    requiresPermit: boolean;
    permitType: string;
    shelfLifeMonths?: number;
  }> | null;
}

export interface PermitCheckResult {
  permitRequired: boolean | null;
  permitType?: string;
  shelfLifeRequired: boolean | null;
  shelfLifeMonths?: number;
  hazardous: boolean | null;
  notes: string;
  confidence: number;
}

const UNKNOWN_NOTES = "ไม่สามารถระบุได้จากข้อมูลที่มี กรุณาตรวจสอบกับผู้เชี่ยวชาญ";

const unknown = (): PermitCheckResult => ({
  permitRequired: null,
  shelfLifeRequired: null,
  hazardous: null,
  notes: UNKNOWN_NOTES,
  confidence: 0,
});

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const text = (input: PermitCheckRequest): string =>
  [input.description, input.itemCategory, input.mfrBrand, input.countryOfOrigin]
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLowerCase();

const chapterFromHsCode = (hsCode?: string): number | null => {
  if (typeof hsCode !== "string") {
    return null;
  }

  const digits = hsCode.replace(/\D/g, "");
  if (digits.length < 2) {
    return null;
  }

  const chapter = Number.parseInt(digits.slice(0, 2), 10);
  return Number.isFinite(chapter) ? chapter : null;
};

const hasAny = (value: string, words: string[]): boolean =>
  words.some((word) => value.includes(word));

const fromRulesContext = (input: PermitCheckRequest): PermitCheckResult | null => {
  if (!Array.isArray(input.rulesContext) || input.rulesContext.length === 0) {
    return null;
  }

  const inputText = text(input);
  const rule = input.rulesContext.find((candidate) =>
    inputText.includes(candidate.category.toLowerCase()),
  );

  if (!rule) {
    return null;
  }

  const result: PermitCheckResult = {
    permitRequired: rule.requiresPermit,
    shelfLifeRequired: rule.shelfLifeMonths !== undefined,
    hazardous: hasAny(inputText, ["chemical", "hazard", "acid", "solvent", "flammable"]),
    notes: `Matched supplied rulesContext category "${rule.category}".`,
    confidence: 0.85,
  };

  if (rule.requiresPermit && rule.permitType.trim() !== "") {
    result.permitType = rule.permitType;
  }

  if (rule.shelfLifeMonths !== undefined) {
    result.shelfLifeMonths = rule.shelfLifeMonths;
  }

  return result;
};

const deterministicCheck = (input: PermitCheckRequest): PermitCheckResult | null => {
  const inputText = text(input);
  const chapter = chapterFromHsCode(input.hsCode);
  const isChemical = hasAny(inputText, [
    "chemical",
    "acid",
    "alkali",
    "solvent",
    "resin",
    "adhesive",
    "paint",
    "aerosol",
  ]);
  const isPharma = hasAny(inputText, ["pharma", "medicine", "drug", "vaccine"]);
  const isFood = hasAny(inputText, ["food", "beverage", "supplement"]);
  const isWeapon = hasAny(inputText, ["weapon", "arms", "firearm", "gun", "munition", "ammunition"]);
  const isRadioactive = hasAny(inputText, ["radioactive", "isotope", "radiation source"]);
  const isHighVoltage = hasAny(inputText, [
    "high-voltage",
    "high voltage",
    "medium voltage",
    "11kv",
    "22kv",
    "33kv",
    ">1000v",
  ]);
  const category = input.itemCategory?.toLowerCase() ?? "";

  if (chapter === 93 || isWeapon) {
    return {
      permitRequired: true,
      permitType: "ใบอนุญาตอาวุธ/ยุทธภัณฑ์",
      shelfLifeRequired: false,
      hazardous: true,
      notes: "HS chapter 93 or weapon keywords indicate an always permit-controlled item.",
      confidence: 0.95,
    };
  }

  if (chapter === 30 || isPharma) {
    return {
      permitRequired: true,
      permitType: "อย.",
      shelfLifeRequired: true,
      hazardous: false,
      notes: "Pharmaceutical goods are commonly controlled by Thai FDA import rules and usually need shelf-life review.",
      confidence: 0.8,
    };
  }

  if (chapter === 28 || chapter === 29 || chapter === 38 || isChemical || category.includes("chemical")) {
    return {
      permitRequired: true,
      permitType: "กรมโรงงาน",
      shelfLifeRequired: false,
      hazardous: true,
      notes: "Chemical chapter/category/description indicates permit and hazardous-goods review should be applied.",
      confidence: 0.78,
    };
  }

  if (isRadioactive) {
    return {
      permitRequired: true,
      permitType: "สำนักงานปรมาณูเพื่อสันติ",
      shelfLifeRequired: false,
      hazardous: true,
      notes: "Radioactive material keywords indicate permit-controlled hazardous goods.",
      confidence: 0.85,
    };
  }

  if (isFood) {
    return {
      permitRequired: true,
      permitType: "อย.",
      shelfLifeRequired: true,
      hazardous: false,
      notes: "Food or supplement keywords indicate Thai FDA import and shelf-life review.",
      confidence: 0.72,
    };
  }

  if ((chapter === 85 || category.includes("electrical")) && isHighVoltage) {
    return {
      permitRequired: true,
      permitType: "ใบอนุญาตอุปกรณ์ไฟฟ้าแรงสูง",
      shelfLifeRequired: false,
      hazardous: false,
      notes: "Electrical chapter/category plus high-voltage description indicates permit review may be required.",
      confidence: 0.68,
    };
  }

  if (category.includes("mechanical") && chapter !== 85) {
    return {
      permitRequired: false,
      shelfLifeRequired: false,
      hazardous: false,
      notes: "No chemical, food, pharma, weapon, radioactive, or high-voltage permit trigger is apparent from the available data.",
      confidence: 0.6,
    };
  }

  return null;
};

const normalizeAiResult = (result: PermitCheckResult): PermitCheckResult => {
  const confidence =
    typeof result.confidence === "number" && Number.isFinite(result.confidence)
      ? clamp(result.confidence, 0, 1)
      : 0;

  if (confidence === 0 || result.permitRequired === null || result.shelfLifeRequired === null || result.hazardous === null) {
    return unknown();
  }

  if (result.permitRequired === true && confidence < 0.65) {
    return unknown();
  }

  const normalized: PermitCheckResult = {
    permitRequired: result.permitRequired,
    shelfLifeRequired: result.shelfLifeRequired,
    hazardous: result.hazardous,
    notes:
      typeof result.notes === "string" && result.notes.trim() !== ""
        ? result.notes.trim()
        : UNKNOWN_NOTES,
    confidence,
  };

  if (typeof result.permitType === "string" && result.permitType.trim() !== "") {
    normalized.permitType = result.permitType.trim();
  }

  if (typeof result.shelfLifeMonths === "number" && Number.isFinite(result.shelfLifeMonths)) {
    normalized.shelfLifeMonths = result.shelfLifeMonths;
  }

  return normalized;
};

export const checkImportPermit = async (
  input: PermitCheckRequest,
  provider?: JsonProvider,
): Promise<PermitCheckResult> => {
  const rulesResult = fromRulesContext(input);
  if (rulesResult !== null) {
    return rulesResult;
  }

  const deterministicResult = deterministicCheck(input);
  if (deterministicResult !== null) {
    return deterministicResult;
  }

  // GPT is used only after deterministic Thai chapter/category guardrails cannot resolve the item.
  const aiProvider = provider ?? new OpenAIProvider();

  try {
    const aiResult = await aiProvider.generateJson<PermitCheckResult>({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: buildUserPrompt(input),
      temperature: 0,
      maxOutputTokens: 800,
    });

    return normalizeAiResult(aiResult);
  } catch {
    return unknown();
  }
};
