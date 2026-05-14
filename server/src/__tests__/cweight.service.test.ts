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
            dimensionL: 50,
            dimensionW: 40,
            dimensionH: 30,
            dimUnit: 'CM',
            source: 'direct_formula',
            confidence: 0.99,
            reason: 'Calculated locally from supplied actual weight and/or dimensional weight inputs.',
        });
    });

    it('preserves local semantic matches as review suggestions', () => {
        const result = resolveChargeableWeight({
            localMatch: {
                decision: 'REVIEW_SUGGESTION',
                chargeableWeightKg: 0.5,
                itemWeightKg: 0.08,
                dimensionL: 5,
                dimensionW: 2,
                dimensionH: 2,
                dimUnit: 'INCH',
                source: 'local_semantic_match',
                confidence: 0.68,
                reason: 'Description-only local match requires user review.',
            },
        });

        expect(result).toEqual({
            decision: 'REVIEW_SUGGESTION',
            chargeableWeightKg: 0.5,
            itemWeightKg: 0.08,
            dimensionL: 5,
            dimensionW: 2,
            dimensionH: 2,
            dimUnit: 'INCH',
            source: 'local_semantic_match',
            confidence: 0.68,
            reason: 'Description-only local match requires user review.',
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
            dimensionL: null,
            dimensionW: null,
            dimensionH: null,
            dimUnit: null,
            source: 'not_found',
            confidence: 0,
            reason: 'No direct weight/dimension formula inputs or approved local match were provided.',
        });
    });
});
