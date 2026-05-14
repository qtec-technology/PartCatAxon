import { describe, expect, it } from "vitest";
import {
  analyzeGraingerCWeightCsv,
  analyzePitm1Csv,
  analyzePitm1Record,
  parseCsv,
} from "../src/index.js";

describe("cweight sample analyzer", () => {
  it("parses quoted CSV values without external dependencies", () => {
    const records = parseCsv('ID,Name,Description\n1,ACME,"Valve, stainless steel"\n');

    expect(records).toEqual([
      { ID: "1", Name: "ACME", Description: "Valve, stainless steel" },
    ]);
  });

  it("analyzes a PITM1 Air Courier INCH row against legacy formula fields", () => {
    const row = analyzePitm1Record({
      TermID: "899195",
      VendorCode: "VF0072",
      VendorStockItemNo: "30C248",
      U_Length: "5",
      U_Width: "2",
      U_Height: "2",
      U_DimWeight: "0.068",
      U_Weight: "0.08",
      U_ShipWeightCal: "0.5",
      U_DimUnitNo: "2",
      U_DimUnit: "INCH",
      U_ShipModeNo: "6",
      U_CWeight: "",
      ItemDescription: "Taper Gauge Set",
    });

    expect(row).toMatchObject({
      rowKey: "899195",
      vendorCode: "VF0072",
      vendorStockItemNo: "30C248",
      calculatedDimensionalWeightKg: 0.068,
      calculatedChargeableWeightKg: 0.5,
      expectedShipWeightCalKg: 0.5,
      expectedCWeightKg: null,
      dimensionalWeightMatches: true,
      shipWeightCalMatches: true,
      cWeightMatches: null,
      bestDivisor: 5000,
      issue: "ok",
    });
  });

  it("summarizes PITM1 rows into match and data-quality buckets", () => {
    const csv = [
      "TermID,VendorCode,VendorStockItemNo,U_Length,U_Width,U_Height,U_DimWeight,U_Weight,U_ShipWeightCal,U_DimUnitNo,U_DimUnit,U_ShipModeNo,U_CWeight,ItemDescription",
      "1,VF0072,30C248,5,2,2,0.068,0.08,0.5,2,INCH,6,,Taper Gauge Set",
      "2,VX0001,,0,0,0,0,25,25,1,CM,3,,Chemical pail",
      "3,VX0002,,50,40,30,10,10.1,10.5,1,CM,1,,Boxed component",
      "",
    ].join("\n");

    const summary = analyzePitm1Csv(csv, { includeRows: false });

    expect(summary).toEqual({
      totalRows: 3,
      analyzableRows: 2,
      missingDimensions: 1,
      missingItemWeight: 0,
      missingExpectedWeight: 0,
      dimensionalWeightMatches: 2,
      shipWeightCalMatches: 2,
      cWeightMatches: 0,
      divisorMatches: {
        "5000": 1,
        "6000": 1,
        "1000": 0,
      },
      formulaMismatches: 0,
      rows: [],
    });
  });

  it("summarizes Grainger rows where CWeight equals max shipping and volumetric weight", () => {
    const csv = [
      "GRAINGER_NO,MFG_NAME,MFG_PART_NO,SHORT_DESC,Sell_Pack_Weight_kgs,Volumetric_Weight_kgs,Chargeable_Weight_kgs,SWeight,VWeight,CWeight",
      "100FN6,DISCO,10889PK,Worm Gear Hose Clamps,0.09,0.02,0.09,0.09,0.02,0.09",
      "100G48,PROTO,100G48,Master Tool Set,32.38,15.36,32.38,32.38,15.36,32.38",
      "BAD1,TEST,BAD1,Mismatch,1,2,1,1,2,1",
      "",
    ].join("\n");

    const summary = analyzeGraingerCWeightCsv(csv, { includeRows: false });

    expect(summary).toEqual({
      totalRows: 3,
      analyzableRows: 3,
      chargeableMatchesMaxWeight: 2,
      missingWeightFields: 0,
      mismatches: 1,
      rows: [],
    });
  });
});
