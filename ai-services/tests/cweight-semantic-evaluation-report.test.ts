import { describe, expect, it } from "vitest";
import { buildCWeightSemanticEvaluationReport, parseCsv } from "../src/index.js";

describe("cweight semantic evaluation report", () => {
  it("counts correct, wrong, and not-found semantic matches", () => {
    const graingerRows = parseCsv([
      "GRAINGER_NO,MFG_NAME,MFG_PART_NO,SHORT_DESC,Sell_Pack_Weight_kgs,Volumetric_Weight_kgs,Chargeable_Weight_kgs,SWeight,VWeight,CWeight",
      "100G48,PROTO,100G48,Master Tool Set General Purpose 78 pcs.,32.38,15.36,32.38,32.38,15.36,32.38",
      "100G52,PROTO,100G52,Master Tool Set General Purpose 564 pcs.,174.99,52.23,174.99,174.99,52.23,174.99",
      "",
    ].join("\n"));

    const report = buildCWeightSemanticEvaluationReport({ graingerRows, pitm1Rows: [] });

    expect(report.scenarios.short_description_only).toMatchObject({
      scenario: "short_description_only",
      total: 2,
    });
    expect(report.scenarios.short_description_only?.correct ?? 0).toBeGreaterThan(0);
  });

  it("keeps semantic precision above current research guardrails", () => {
    const graingerRows = parseCsv([
      "GRAINGER_NO,MFG_NAME,MFG_PART_NO,SHORT_DESC,Sell_Pack_Weight_kgs,Volumetric_Weight_kgs,Chargeable_Weight_kgs,SWeight,VWeight,CWeight",
      "A1,ACME,A1,Elbow 90 Deg Low Lead Brass 1 Tube,0.1,0.1,0.1,0.1,0.1,0.1",
      "A2,ACME,A2,Elbow 90 Deg Low Lead Brass 2 Tube,0.2,0.2,0.2,0.2,0.2,0.2",
      "",
    ].join("\n"));

    const report = buildCWeightSemanticEvaluationReport({ graingerRows, pitm1Rows: [] });

    expect(report.scenarios.noisy_description_only?.precision ?? 0).toBeGreaterThanOrEqual(0.9);
  });
});
