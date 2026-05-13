import { describe, expect, it } from "vitest";
import { lookupLocalCWeight, normalizeLookupText, parseCsv } from "../src/index.js";

const graingerRows = parseCsv([
  "GRAINGER_NO,MFG_NAME,MFG_PART_NO,SHORT_DESC,Sell_Pack_Weight_kgs,Volumetric_Weight_kgs,Chargeable_Weight_kgs,SWeight,VWeight,CWeight",
  "100FN6,DISCO,10889PK,Worm Gear Hose Clamps #4 1/4-5/8 C PK10,0.09,0.02,0.09,0.09,0.02,0.09",
  "100G48,PROTO,100G48,Master Tool Set General Purpose 78 pcs.,32.38,15.36,32.38,32.38,15.36,32.38",
  "",
].join("\n"));

const pitm1Rows = parseCsv([
  "TermID,VendorCode,VendorStockItemNo,U_Length,U_Width,U_Height,U_DimWeight,U_Weight,U_ShipWeightCal,U_DimUnitNo,U_DimUnit,U_ShipModeNo,U_CWeight,ItemDescription,U_CalalogNo",
  "899195,VF0072,30C248,5,2,2,0.068,0.08,0.5,2,INCH,6,,Taper Gauge Set: 1 1/16 in to 1/16 in Flat Leaf Gauge,267",
  "899165,VF0072,,13,2,2,0.1768,1.3,1.5,2,INCH,6,,Bolt Cutters Steel For 5/16 in Max Dia Soft Steel,14213",
  "",
].join("\n"));

describe("local CWeight lookup", () => {
  it("calculates direct formula inputs before local matching", () => {
    const result = lookupLocalCWeight(
      {
        description: "Boxed component",
        itemWeightKg: 10.1,
        length: 50,
        width: 40,
        height: 30,
        dimUnit: "CM",
        shipModeNo: 1,
      },
      { graingerRows, pitm1Rows },
    );

    expect(result).toMatchObject({
      itemWeightKg: 10.1,
      chargeableWeightKg: 10.5,
      dimensionL: 50,
      dimensionW: 40,
      dimensionH: 30,
      dimUnit: "CM",
      source: "direct_formula",
      confidence: 0.99,
      matchMethod: "direct_formula",
      decision: "AUTO_ACCEPT",
    });
  });

  it("matches Grainger No exactly and returns known CWeight", () => {
    const result = lookupLocalCWeight(
      { supplierOrderCode: "100FN6", description: "unknown" },
      { graingerRows, pitm1Rows },
    );

    expect(result).toMatchObject({
      itemWeightKg: 0.09,
      chargeableWeightKg: 0.09,
      source: "grainger",
      confidence: 0.97,
      matchMethod: "grainger_no_exact",
      decision: "AUTO_ACCEPT",
      matchedKey: "100FN6",
    });
  });

  it("matches manufacturer part number against Grainger data", () => {
    const result = lookupLocalCWeight(
      { mfrCatalogNo: "100G48", description: "Master Tool Set" },
      { graingerRows },
    );

    expect(result).toMatchObject({
      itemWeightKg: 32.38,
      chargeableWeightKg: 32.38,
      source: "grainger",
      matchMethod: "grainger_mfg_part_exact",
    });
  });

  it("matches legacy VendorStockItemNo and returns ShipWeightCal", () => {
    const result = lookupLocalCWeight(
      { vendorStockItemNo: "30C248", description: "Taper Gauge Set" },
      { pitm1Rows },
    );

    expect(result).toMatchObject({
      itemWeightKg: 0.08,
      chargeableWeightKg: 0.5,
      dimensionL: 5,
      dimensionW: 2,
      dimensionH: 2,
      dimUnit: "INCH",
      source: "legacy_term",
      confidence: 0.9,
      matchMethod: "pitm1_vendor_stock_exact",
      decision: "AUTO_ACCEPT",
    });
  });

  it("matches legacy catalog number when vendor stock item is missing", () => {
    const result = lookupLocalCWeight(
      { mfrCatalogNo: "14213", description: "Bolt Cutters" },
      { pitm1Rows },
    );

    expect(result).toMatchObject({
      itemWeightKg: 1.3,
      chargeableWeightKg: 1.5,
      source: "legacy_term",
      matchMethod: "pitm1_catalog_exact",
    });
  });

  it("uses normalized description exact match when no key is available", () => {
    const result = lookupLocalCWeight(
      { description: "worm gear hose clamps 4 1 4 5 8 c pk10" },
      { graingerRows },
    );

    expect(result).toMatchObject({
      chargeableWeightKg: 0.09,
      source: "grainger",
      matchMethod: "description_exact",
      decision: "REVIEW_SUGGESTION",
    });
  });

  it("uses semantic description search as a lower-confidence local fallback", () => {
    const result = lookupLocalCWeight(
      { description: "flat leaf taper gauge set resolution inch" },
      { pitm1Rows },
    );

    expect(result.source).toBe("legacy_term");
    expect(result.matchMethod).toBe("description_semantic");
    expect(result.decision).toBe("REVIEW_SUGGESTION");
    expect(result.confidence).toBe(0.68);
    expect(result.chargeableWeightKg).toBe(0.5);
  });

  it("returns not_found when no local row is credible", () => {
    const result = lookupLocalCWeight(
      { supplierOrderCode: "NOPE", description: "unrelated custom fabricated pump skid" },
      { graingerRows, pitm1Rows },
    );

    expect(result).toEqual({
      itemWeightKg: null,
      chargeableWeightKg: null,
      dimensionL: null,
      dimensionW: null,
      dimensionH: null,
      dimUnit: null,
      source: "not_found",
      confidence: 0,
      matchMethod: "not_found",
      decision: "NOT_FOUND",
      matchedKey: null,
      matchedDescription: null,
    });
  });

  it("normalizes lookup text deterministically", () => {
    expect(normalizeLookupText(" Taper Gauge Set: 1 1/16 in ")).toBe("taper gauge set 1 1 16 in");
  });
});
