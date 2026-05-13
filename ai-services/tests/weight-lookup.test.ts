import { describe, expect, it } from "vitest";
import type { JsonProvider } from "../src/providers/openai.provider.js";
import type { WeightLookupResult } from "../src/services/weight-lookup.service.js";
import { lookupWeight } from "../src/services/weight-lookup.service.js";

const requiredKeys = [
  "itemWeightKg",
  "chargeableWeightKg",
  "dimensionL",
  "dimensionW",
  "dimensionH",
  "dimUnit",
  "source",
  "confidence",
];

describe("lookupWeight", () => {
  it("maps a pre-fetched Grainger row without calling AI", async () => {
    const provider: JsonProvider = {
      async generateJson() {
        throw new Error("AI provider should not be called when graingerRow is present");
      },
    };

    const result = await lookupWeight(
      {
        supplierOrderCode: "6K321",
        mfrBrand: "Dayton",
        description: "Motor 1HP 1725RPM TEFC",
        uom: "EA",
        graingerRow: {
          VendorStockItemNo: "6K321",
          CWeight: 24,
          ItemWeight: 21.8,
          DimL: 46,
          DimW: 30,
          DimH: 34,
          DimUnit: "CM",
        },
      },
      provider,
    );

    expect(result).toEqual({
      itemWeightKg: 21.8,
      chargeableWeightKg: 24,
      dimensionL: 46,
      dimensionW: 30,
      dimensionH: 34,
      dimUnit: "CM",
      source: "grainger",
      confidence: 0.95,
    });
    expect(Object.keys(result)).toEqual(requiredKeys);
  });

  it("uses AI estimate when Grainger row is null", async () => {
    const provider: JsonProvider = {
      async generateJson<T>() {
        return {
          itemWeightKg: 0.35,
          chargeableWeightKg: 0.5,
          dimensionL: 18,
          dimensionW: 10,
          dimensionH: 8,
          dimUnit: "CM",
          source: "ai_estimate",
          confidence: 0.52,
        } satisfies WeightLookupResult as T;
      },
    };

    const result = await lookupWeight(
      {
        supplierOrderCode: "A9D11810",
        mfrBrand: "Schneider Electric",
        mfrCatalogNo: "A9D11810",
        description: "Acti9 iC60 RCBO 10A 1P+N 30mA",
        uom: "EA",
        graingerRow: null,
      },
      provider,
    );

    expect(result).toEqual({
      itemWeightKg: 0.35,
      chargeableWeightKg: 0.5,
      dimensionL: 18,
      dimensionW: 10,
      dimensionH: 8,
      dimUnit: "CM",
      source: "ai_estimate",
      confidence: 0.52,
    });
    expect(Object.keys(result)).toEqual(requiredKeys);
  });

  it("does not create a default external provider when no provider is injected", async () => {
    const result = await lookupWeight({
      supplierOrderCode: "A9D11810",
      mfrBrand: "Schneider Electric",
      mfrCatalogNo: "A9D11810",
      description: "Acti9 iC60 RCBO 10A 1P+N 30mA",
      uom: "EA",
      graingerRow: null,
    });

    expect(result).toEqual({
      itemWeightKg: null,
      chargeableWeightKg: null,
      dimensionL: null,
      dimensionW: null,
      dimensionH: null,
      dimUnit: null,
      source: "not_found",
      confidence: 0,
    });
  });
});
