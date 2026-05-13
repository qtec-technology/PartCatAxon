import { describe, expect, it } from "vitest";
import { buildCWeightIncompleteInputReport, parseCsv } from "../src/index.js";

describe("cweight incomplete input report", () => {
  it("measures lookup coverage across incomplete request scenarios", () => {
    const graingerRows = parseCsv([
      "GRAINGER_NO,MFG_NAME,MFG_PART_NO,SHORT_DESC,Sell_Pack_Weight_kgs,Volumetric_Weight_kgs,Chargeable_Weight_kgs,SWeight,VWeight,CWeight",
      "100FN6,DISCO,10889PK,Worm Gear Hose Clamps #4 1/4-5/8 C PK10,0.09,0.02,0.09,0.09,0.02,0.09",
      "",
    ].join("\n"));
    const pitm1Rows = parseCsv([
      "TermID,VendorCode,VendorStockItemNo,U_Length,U_Width,U_Height,U_DimWeight,U_Weight,U_ShipWeightCal,U_DimUnitNo,U_DimUnit,U_ShipModeNo,U_CWeight,ItemDescription,U_CalalogNo",
      "899195,VF0072,30C248,5,2,2,0.068,0.08,0.5,2,INCH,6,,Taper Gauge Set Flat Leaf Gauge Resolution Inch,267",
      "",
    ].join("\n"));

    const report = buildCWeightIncompleteInputReport({ graingerRows, pitm1Rows });

    expect(report.sourceRows).toEqual({
      graingerRows: 1,
      pitm1Rows: 1,
      chargeableWeightRows: 0,
    });
    expect(report.scenarios.supplier_code_only).toMatchObject({
      scenario: "supplier_code_only",
      totalInputRows: 2,
      matchedRows: 2,
      notFoundRows: 0,
    });
    expect(report.scenarios.mfr_part_only).toMatchObject({
      scenario: "mfr_part_only",
      totalInputRows: 2,
      matchedRows: 2,
      notFoundRows: 0,
    });
    expect(report.scenarios.short_description_only.totalInputRows).toBe(2);
    expect(report.scenarios.noisy_description_only.totalInputRows).toBe(2);
  });
});
