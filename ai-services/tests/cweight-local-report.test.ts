import { describe, expect, it } from "vitest";
import { buildCWeightLocalReport, dedupePitm1Rows, parseCsv } from "../src/index.js";

describe("cweight local report", () => {
  it("builds exact-key and description-only coverage from local rows", () => {
    const graingerRows = parseCsv([
      "GRAINGER_NO,MFG_NAME,MFG_PART_NO,SHORT_DESC,Sell_Pack_Weight_kgs,Volumetric_Weight_kgs,Chargeable_Weight_kgs,SWeight,VWeight,CWeight",
      "100FN6,DISCO,10889PK,Worm Gear Hose Clamps #4 1/4-5/8 C PK10,0.09,0.02,0.09,0.09,0.02,0.09",
      "",
    ].join("\n"));
    const pitm1Rows = parseCsv([
      "TermID,VendorCode,VendorStockItemNo,U_Length,U_Width,U_Height,U_DimWeight,U_Weight,U_ShipWeightCal,U_DimUnitNo,U_DimUnit,U_ShipModeNo,U_CWeight,ItemDescription,U_CalalogNo",
      "899195,VF0072,30C248,5,2,2,0.068,0.08,0.5,2,INCH,6,,Taper Gauge Set: 1 1/16 in to 1/16 in Flat Leaf Gauge,267",
      "",
    ].join("\n"));
    const chargeableWeightRows = [
      { GRAINGER_NO: "EXTRA1", CWeight: "2.5", Chargeable_Weight_kgs: "2.5" },
    ];

    const report = buildCWeightLocalReport({ graingerRows, pitm1Rows, chargeableWeightRows });

    expect(report.sourceRows).toEqual({
      graingerRows: 1,
      pitm1Rows: 1,
      chargeableWeightRows: 1,
      mergedGraingerRows: 2,
    });
    expect(report.exactKeyCoverage).toMatchObject({
      scenario: "exact_keys",
      totalInputRows: 3,
      matchedRows: 3,
      notFoundRows: 0,
    });
    expect(report.exactKeyCoverage.matchMethods.grainger_no_exact).toBe(2);
    expect(report.exactKeyCoverage.matchMethods.pitm1_vendor_stock_exact).toBe(1);
    expect(report.descriptionOnlyCoverage).toMatchObject({
      scenario: "description_only",
      totalInputRows: 2,
      matchedRows: 2,
      notFoundRows: 0,
    });
    expect(report.descriptionOnlyCoverage.matchMethods.description_exact).toBe(2);
  });

  it("dedupes PITM1 rows by TermID before report loading", () => {
    const rows = [
      { TermID: "1", VendorStockItemNo: "A", U_CalalogNo: "A1", ItemDescription: "First" },
      { TermID: "1", VendorStockItemNo: "A", U_CalalogNo: "A1", ItemDescription: "First duplicate" },
      { TermID: "2", VendorStockItemNo: "B", U_CalalogNo: "B1", ItemDescription: "Second" },
    ];

    expect(dedupePitm1Rows(rows)).toEqual([rows[0], rows[2]]);
  });
});
