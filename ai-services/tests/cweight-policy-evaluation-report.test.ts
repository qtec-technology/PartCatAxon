import { describe, expect, it } from "vitest";
import {
  buildCWeightIncompleteInputReport,
  buildCWeightPolicyEvaluationReport,
  buildCWeightSemanticEvaluationReport,
  parseCsv,
} from "../src/index.js";

describe("cweight policy evaluation report", () => {
  it("maps local-only evidence into decision policy buckets", () => {
    const graingerRows = parseCsv([
      "GRAINGER_NO,MFG_NAME,MFG_PART_NO,SHORT_DESC,Sell_Pack_Weight_kgs,Volumetric_Weight_kgs,Chargeable_Weight_kgs,SWeight,VWeight,CWeight",
      "100G48,PROTO,100G48,Master Tool Set General Purpose 78 pcs.,32.38,15.36,32.38,32.38,15.36,32.38",
      "100G52,PROTO,100G52,Master Tool Set General Purpose 564 pcs.,174.99,52.23,174.99,174.99,52.23,174.99",
      "",
    ].join("\n"));
    const incomplete = buildCWeightIncompleteInputReport({ graingerRows, pitm1Rows: [] });
    const semantic = buildCWeightSemanticEvaluationReport({ graingerRows, pitm1Rows: [] });

    const report = buildCWeightPolicyEvaluationReport({ incomplete, semantic });

    expect(report.localOnly.supplierCodeOnly).toMatchObject({
      scenario: "supplier_code_only",
      total: 2,
      autoAccept: 2,
      reviewSuggestion: 0,
      notFound: 0,
      recall: 1,
    });
    expect(report.localOnly.shortDescriptionOnly.autoAccept).toBe(0);
    expect(report.localOnly.shortDescriptionOnly.reviewSuggestion).toBeGreaterThan(0);
    expect(report.apiAssisted).toMatchObject({
      status: "designed_not_executed",
      maxAllowedDecision: "REVIEW_SUGGESTION",
      autoAcceptImprovement: 0,
    });
    expect(report.policies.notFound.policy).toContain("Return null weights");
  });
});
