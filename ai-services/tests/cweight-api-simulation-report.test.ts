import { describe, expect, it } from "vitest";
import { buildCWeightApiSimulationReport, parseCsv } from "../src/index.js";

describe("cweight api simulation report", () => {
  it("simulates API only for local NOT_FOUND cases and keeps suggestions review-only", () => {
    const graingerRows = parseCsv([
      "GRAINGER_NO,MFG_NAME,MFG_PART_NO,SHORT_DESC,Sell_Pack_Weight_kgs,Volumetric_Weight_kgs,Chargeable_Weight_kgs,SWeight,VWeight,CWeight",
      "A1,ACME,A1,Broom w Handle and Brace 24 Block,1,2,2,1,2,2",
      "A2,ACME,A2,Broom w Handle and Brace 24 Block,1,1,1,1,1,1",
      "",
    ].join("\n"));

    const report = buildCWeightApiSimulationReport({ graingerRows, pitm1Rows: [] });
    const verified = report.scenarios.find(
      (scenario) => scenario.scenario === "short_description_only" && scenario.method === "verified_catalog_match",
    );

    expect(verified).toBeDefined();
    expect(verified?.localNotFoundEligible ?? 0).toBeGreaterThan(0);
    expect(verified?.maxDecision).toBe("REVIEW_SUGGESTION");
    expect(report.recommendation.productionGate).toContain("local NOT_FOUND");
  });

  it("shows broad simulated matching is not the preferred production method", () => {
    const graingerRows = parseCsv([
      "GRAINGER_NO,MFG_NAME,MFG_PART_NO,SHORT_DESC,Sell_Pack_Weight_kgs,Volumetric_Weight_kgs,Chargeable_Weight_kgs,SWeight,VWeight,CWeight",
      "B1,ACME,B1,Tee Low Lead Brass PEX 1 Tube,0.1,0.1,0.1,0.1,0.1,0.1",
      "B2,ACME,B2,Tee Low Lead Brass PEX 1-1/4 Tube,0.2,0.2,0.2,0.2,0.2,0.2",
      "B3,ACME,B3,Tee Low Lead Brass PEX 2 Tube,0.3,0.3,0.3,0.3,0.3,0.3",
      "",
    ].join("\n"));

    const report = buildCWeightApiSimulationReport({ graingerRows, pitm1Rows: [] });

    expect(report.recommendation.preferredMethod).toBe("verified_catalog_match");
    for (const scenario of report.scenarios) {
      expect(scenario.maxDecision).toBe("REVIEW_SUGGESTION");
    }
  });
});
