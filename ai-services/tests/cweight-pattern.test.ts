import { describe, expect, it } from "vitest";
import {
  analyzeCWeightSample,
  calculateChargeableWeightKg,
  calculateDimensionalWeightKg,
  getShipModeDimensionalDivisor,
  normalizeDimUnit,
  normalizeShipModeNo,
} from "../src/index.js";

describe("cweight pattern research functions", () => {
  it("normalizes legacy dim units and ship modes", () => {
    expect(normalizeDimUnit(1)).toBe("CM");
    expect(normalizeDimUnit(2)).toBe("INCH");
    expect(normalizeDimUnit(" inch ")).toBe("INCH");
    expect(normalizeDimUnit("centimeters")).toBe("CM");
    expect(normalizeDimUnit("MM")).toBeNull();

    expect(normalizeShipModeNo("6")).toBe(6);
    expect(normalizeShipModeNo(2)).toBe(2);
    expect(normalizeShipModeNo(9)).toBeNull();
  });

  it("uses the Term engine divisor mapping by ship mode", () => {
    expect(getShipModeDimensionalDivisor(1)).toBe(6000);
    expect(getShipModeDimensionalDivisor(2)).toBe(1000);
    expect(getShipModeDimensionalDivisor(3)).toBe(5000);
    expect(getShipModeDimensionalDivisor(4)).toBe(6000);
    expect(getShipModeDimensionalDivisor(5)).toBe(6000);
    expect(getShipModeDimensionalDivisor(6)).toBe(5000);
  });

  it("calculates CM dimensional weight and CEILING 0.5 chargeable weight", () => {
    const result = calculateChargeableWeightKg({
      itemWeightKg: 10.1,
      length: 50,
      width: 40,
      height: 30,
      dimUnit: "CM",
      shipModeNo: 1,
    });

    expect(result.dimensionalWeightKg).toBe(10);
    expect(result.chargeableWeightKg).toBe(10.5);
    expect(result.divisor).toBe(6000);
    expect(result.rule).toBe("max_item_dim_ceiling_0_5");
  });

  it("matches legacy INCH volume approximation for Air Courier", () => {
    const result = calculateChargeableWeightKg({
      itemWeightKg: 0.08,
      length: 5,
      width: 2,
      height: 2,
      dimUnit: 2,
      shipModeNo: 6,
    });

    expect(result.dimensionalWeightKg).toBe(0.068);
    expect(result.chargeableWeightKg).toBe(0.5);
    expect(result.adjustedVolume).toBe(340);
  });

  it("applies the sea dimensional weight minimum from the Term engine", () => {
    const dimWeight = calculateDimensionalWeightKg({
      itemWeightKg: 3.2,
      length: 90,
      width: 35,
      height: 28,
      dimUnit: "CM",
      shipModeNo: 2,
    });

    expect(dimWeight).toBe(1000);
  });

  it("returns null chargeable weight when both item and dimensional inputs are missing", () => {
    const result = calculateChargeableWeightKg({
      itemWeightKg: null,
      length: null,
      width: null,
      height: null,
      dimUnit: null,
      shipModeNo: null,
    });

    expect(result.chargeableWeightKg).toBeNull();
    expect(result.rule).toBe("missing_required_fields");
  });

  it("identifies the divisor pattern from a legacy PITM1 INCH sample", () => {
    const analysis = analyzeCWeightSample({
      itemWeightKg: 0.08,
      length: 5,
      width: 2,
      height: 2,
      dimUnit: "INCH",
      shipModeNo: 6,
      expectedDimensionalWeightKg: 0.068,
      expectedChargeableWeightKg: 0.5,
    });

    expect(analysis.bestCandidate?.divisor).toBe(5000);
    expect(analysis.bestCandidate?.matchesDimWeight).toBe(true);
    expect(analysis.bestCandidate?.matchesChargeableWeight).toBe(true);
    expect(analysis.normalizedInput).toMatchObject({
      itemWeightKg: 0.08,
      dimensionalWeightKg: 0.068,
      chargeableWeightKg: 0.5,
      dimUnit: "INCH",
      shipModeNo: 6,
      divisor: 5000,
    });
  });
});
