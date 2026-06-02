import { describe, expect, it } from 'vitest';
import { resolveChargeableWeight } from '#src/services/cweight.service.js';

describe('cweight.service', () => {
    it('auto-accepts direct formula input using the Term dimensional-weight rules', () => {
        const result = resolveChargeableWeight({
            itemWeightKg: 10.1,
            length: 50,
            width: 40,
            height: 30,
            dimUnit: 'CM',
            shipModeNo: 1,
        });

        expect(result).toEqual({
            decision: 'AUTO_ACCEPT',
            chargeableWeightKg: 10.5,
            itemWeightKg: 10.1,
            dimensionalWeightKg: 10,
            dimensionL: 50,
            dimensionW: 40,
            dimensionH: 30,
            dimUnit: 'CM',
            source: 'direct_formula',
            confidence: 0.99,
            reason: 'Calculated locally from supplied actual weight and/or dimensional weight inputs.',
            matchedGraingerNo: null,
            matchedMfgPartNo: null,
            matchedBrand: null,
            evidence: null,
        });
    });

    it('returns dimensionalWeightKg null when only itemWeightKg is supplied', () => {
        const result = resolveChargeableWeight({
            itemWeightKg: 5.0,
        });

        expect(result.decision).toBe('AUTO_ACCEPT');
        expect(result.source).toBe('direct_formula');
        expect(result.chargeableWeightKg).toBe(5.0);
        expect(result.dimensionalWeightKg).toBeNull();
        expect(result.matchedGraingerNo).toBeNull();
    });

    it('preserves local semantic matches as review suggestions', () => {
        const result = resolveChargeableWeight({
            localMatch: {
                decision: 'REVIEW_SUGGESTION',
                chargeableWeightKg: 0.5,
                itemWeightKg: 0.08,
                dimensionalWeightKg: null,
                dimensionL: 5,
                dimensionW: 2,
                dimensionH: 2,
                dimUnit: 'INCH',
                source: 'local_semantic_match',
                confidence: 0.68,
                reason: 'Description-only local match requires user review.',
                matchedGraingerNo: null,
                matchedMfgPartNo: null,
                matchedBrand: null,
                evidence: null,
            },
        });

        expect(result).toEqual({
            decision: 'REVIEW_SUGGESTION',
            chargeableWeightKg: 0.5,
            itemWeightKg: 0.08,
            dimensionalWeightKg: null,
            dimensionL: 5,
            dimensionW: 2,
            dimensionH: 2,
            dimUnit: 'INCH',
            source: 'local_semantic_match',
            confidence: 0.68,
            reason: 'Description-only local match requires user review.',
            matchedGraingerNo: null,
            matchedMfgPartNo: null,
            matchedBrand: null,
            evidence: null,
        });
    });

    it('returns not found instead of guessing when no local evidence is available', () => {
        const result = resolveChargeableWeight({
            itemWeightKg: null,
            length: null,
            width: null,
            height: null,
            dimUnit: null,
            shipModeNo: null,
        });

        expect(result).toEqual({
            decision: 'NOT_FOUND',
            chargeableWeightKg: null,
            itemWeightKg: null,
            dimensionalWeightKg: null,
            dimensionL: null,
            dimensionW: null,
            dimensionH: null,
            dimUnit: null,
            source: 'not_found',
            confidence: 0,
            reason: 'No direct weight/dimension formula inputs or approved local match were provided.',
            matchedGraingerNo: null,
            matchedMfgPartNo: null,
            matchedBrand: null,
            evidence: null,
        });
    });

    it('does not use the local match when the user already supplied itemWeightKg (locked weight protection)', () => {
        // Direct formula must take precedence over any lookup result
        const result = resolveChargeableWeight({
            itemWeightKg: 3.5,
            localMatch: {
                decision: 'AUTO_ACCEPT',
                chargeableWeightKg: 99.9,
                itemWeightKg: 99.9,
                dimensionalWeightKg: null,
                dimensionL: null,
                dimensionW: null,
                dimensionH: null,
                dimUnit: null,
                source: 'local_exact_match',
                confidence: 0.97,
                reason: 'Lookup result that should not overwrite user input.',
                matchedGraingerNo: 'XYZ00',
                matchedMfgPartNo: null,
                matchedBrand: null,
                evidence: null,
            },
        });

        expect(result.source).toBe('direct_formula');
        expect(result.chargeableWeightKg).toBe(3.5);
        expect(result.itemWeightKg).toBe(3.5);
        expect(result.matchedGraingerNo).toBeNull();
    });
});
