import { describe, expect, it } from "vitest";
import type { JsonGenerationRequest, JsonProvider } from "../src/providers/openai.provider.js";
import type { HSCodeResult } from "../src/services/hscode.service.js";
import { suggestHSCode } from "../src/services/hscode.service.js";

describe("suggestHSCode", () => {
  it("classifies without historical matches and caps confidence below 0.5", async () => {
    const provider: JsonProvider = {
      async generateJson<T>() {
        return {
          hsCode: "8501.40.19",
          dutyPercent: 10,
          excisePercent: null,
          confidence: 0.82,
          reasoning: "Single phase AC motors are classified under heading 8501 for electric motors.",
          alternativeCodes: [{ hsCode: "8501.52.19", dutyPercent: 10, confidence: 0.3 }],
        } satisfies HSCodeResult as T;
      },
    };

    const result = await suggestHSCode(
      {
        description: "Single phase AC motor 1HP 1725RPM TEFC",
        itemCategory: "Electrical",
        countryOfOrigin: "USA",
        historicalMatches: [],
      },
      provider,
    );

    expect(result).toEqual({
      hsCode: "8501.40.19",
      dutyPercent: 10,
      excisePercent: null,
      confidence: 0.49,
      reasoning: "Single phase AC motors are classified under heading 8501 for electric motors.",
      alternativeCodes: [{ hsCode: "8501.52.19", dutyPercent: 10, confidence: 0.3 }],
    });
  });

  it("passes populated historical matches as few-shot context", async () => {
    const requestSeen: { value: JsonGenerationRequest | null } = { value: null };
    const provider: JsonProvider = {
      async generateJson<T>(request: JsonGenerationRequest): Promise<T> {
        requestSeen.value = request;
        return {
          hsCode: "8482.10.00",
          dutyPercent: 5,
          excisePercent: null,
          confidence: 0.74,
          reasoning: "Historical bearing examples support heading 8482.10 for ball bearings.",
        } satisfies HSCodeResult as T;
      },
    };

    const result = await suggestHSCode(
      {
        description: "Deep groove ball bearing 6205-2RS",
        itemCategory: "Mechanical",
        historicalMatches: [
          {
            description: "Ball bearing 6204 ZZ",
            hsCode: "8482.10.00",
            dutyPercent: 5,
          },
        ],
      },
      provider,
    );

    expect(requestSeen.value?.userPrompt).toContain("historicalMatches");
    expect(requestSeen.value?.userPrompt).toContain("Ball bearing 6204 ZZ");
    expect(result).toEqual({
      hsCode: "8482.10.00",
      dutyPercent: 5,
      excisePercent: null,
      confidence: 0.74,
      reasoning: "Historical bearing examples support heading 8482.10 for ball bearings.",
    });
  });
});
