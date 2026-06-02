import { describe, expect, it } from 'vitest';
import { toCWeightLocalResearchMatch, extractKeywords } from '#src/repositories/cweight.repository.js';

describe('cweight.repository', () => {
    it('maps GRAINGER @GRAINGER_CWEIGHT rows to exact local CWeight matches', () => {
        const result = toCWeightLocalResearchMatch({
            GraingerNo: '100G64',
            MfgPartNo: '1292G',
            MfgName: 'LIBMAN',
            ItemWeightKg: '2.72',
            DimsWeightKg: '53.92',
            ChargeableWeightKg: '53.92',
            MatchMethod: 'grainger_order_code',
            ShortDesc: null,
            GraingerWebLink: null,
        });

        expect(result).toEqual({
            decision: 'AUTO_ACCEPT',
            chargeableWeightKg: 53.92,
            itemWeightKg: 2.72,
            dimensionalWeightKg: 53.92,
            dimensionL: null,
            dimensionW: null,
            dimensionH: null,
            dimUnit: null,
            source: 'local_exact_match',
            confidence: 0.97,
            reason: 'Exact Grainger code match: 100G64.',
            matchedGraingerNo: '100G64',
            matchedMfgPartNo: '1292G',
            matchedBrand: 'LIBMAN',
            evidence: null,
        });
    });

    it('falls back to max actual or volumetric weight when explicit chargeable weight is unavailable', () => {
        const result = toCWeightLocalResearchMatch({
            GraingerNo: '100G64',
            MfgPartNo: '1292G',
            MfgName: 'LIBMAN',
            ItemWeightKg: '2.72',
            DimsWeightKg: '53.92',
            ChargeableWeightKg: null,
            MatchMethod: 'manufacturer_part_no_brand',
            ShortDesc: null,
            GraingerWebLink: null,
        });

        expect(result?.decision).toBe('AUTO_ACCEPT');
        expect(result?.chargeableWeightKg).toBe(53.92);
        expect(result?.itemWeightKg).toBe(2.72);
        expect(result?.dimensionalWeightKg).toBe(53.92); // from DimsWeightKg fallback
        expect(result?.confidence).toBe(0.94);
        expect(result?.matchedGraingerNo).toBe('100G64');
        expect(result?.matchedMfgPartNo).toBe('1292G');
        expect(result?.matchedBrand).toBe('LIBMAN');
    });

    it('rejects rows without usable weight evidence instead of inventing CWeight', () => {
        const result = toCWeightLocalResearchMatch({
            GraingerNo: '100G64',
            MfgPartNo: '1292G',
            MfgName: 'LIBMAN',
            ItemWeightKg: null,
            DimsWeightKg: null,
            ChargeableWeightKg: null,
            MatchMethod: 'manufacturer_part_no',
            ShortDesc: null,
            GraingerWebLink: null,
        });

        expect(result).toBeNull();
    });

    it('returns REVIEW_SUGGESTION for ambiguous manufacturer part number matches', () => {
        const result = toCWeightLocalResearchMatch({
            GraingerNo: '5YR11',
            MfgPartNo: 'PT1234',
            MfgName: 'ACME',
            ItemWeightKg: '1.5',
            DimsWeightKg: '3.0',
            ChargeableWeightKg: '3.0',
            MatchMethod: 'manufacturer_part_no_ambiguous',
            ShortDesc: null,
            GraingerWebLink: null,
        });

        expect(result).not.toBeNull();
        expect(result?.decision).toBe('REVIEW_SUGGESTION');
        expect(result?.chargeableWeightKg).toBe(3.0);
        expect(result?.confidence).toBe(0.7);
        expect(result?.source).toBe('local_semantic_match');
        expect(result?.matchedGraingerNo).toBe('5YR11');
        expect(result?.matchedMfgPartNo).toBe('PT1234');
        expect(result?.matchedBrand).toBe('ACME');
        expect(result?.reason).toContain('PT1234');
        expect(result?.reason).toContain('review required');
    });

    it('maps unique manufacturer part number (no brand) to AUTO_ACCEPT', () => {
        const result = toCWeightLocalResearchMatch({
            GraingerNo: '7AB99',
            MfgPartNo: 'UNIQUE-P/N',
            MfgName: 'VENDOR',
            ItemWeightKg: '0.5',
            DimsWeightKg: null,
            ChargeableWeightKg: '0.5',
            MatchMethod: 'manufacturer_part_no',
            ShortDesc: null,
            GraingerWebLink: null,
        });

        expect(result?.decision).toBe('AUTO_ACCEPT');
        expect(result?.confidence).toBe(0.9);
        expect(result?.dimensionalWeightKg).toBeNull();
    });

    it('maps normalized MFG part + brand match to REVIEW_SUGGESTION with source local_semantic_match', () => {
        const result = toCWeightLocalResearchMatch({
            GraingerNo: '7AB99',
            MfgPartNo: '1875208BL',
            MfgName: 'QUANTUM',
            ItemWeightKg: '2.0',
            DimsWeightKg: null,
            ChargeableWeightKg: '166.15',
            MatchMethod: 'normalized_mfg_part_no_brand',
            ShortDesc: 'Wire Basket',
            GraingerWebLink: null,
        });

        expect(result?.decision).toBe('REVIEW_SUGGESTION');
        expect(result?.source).toBe('local_semantic_match');
        expect(result?.confidence).toBe(0.82);
        expect(result?.chargeableWeightKg).toBe(166.15);
    });

    it('maps normalized MFG part (unique) to REVIEW_SUGGESTION confidence 0.75', () => {
        const result = toCWeightLocalResearchMatch({
            GraingerNo: '7AB99',
            MfgPartNo: '1875208BL',
            MfgName: null,
            ItemWeightKg: '2.0',
            DimsWeightKg: null,
            ChargeableWeightKg: '166.15',
            MatchMethod: 'normalized_mfg_part_no',
            ShortDesc: null,
            GraingerWebLink: null,
        });

        expect(result?.decision).toBe('REVIEW_SUGGESTION');
        expect(result?.source).toBe('local_semantic_match');
        expect(result?.confidence).toBe(0.75);
    });

    it('maps description keyword match to REVIEW_SUGGESTION confidence 0.55', () => {
        const result = toCWeightLocalResearchMatch({
            GraingerNo: '10E979',
            MfgPartNo: '1875-208BL',
            MfgName: 'QUANTUM',
            ItemWeightKg: '2.0',
            DimsWeightKg: null,
            ChargeableWeightKg: '166.15',
            MatchMethod: 'description_keyword',
            ShortDesc: 'Wire Basket Chrome',
            GraingerWebLink: 'https://www.grainger.com/product/10E979',
        });

        expect(result?.decision).toBe('REVIEW_SUGGESTION');
        expect(result?.source).toBe('local_semantic_match');
        expect(result?.confidence).toBe(0.55);
    });
});

describe('extractKeywords', () => {
    it('splits on delimiters and returns up to 3 significant words', () => {
        expect(extractKeywords('WIRE BASKET, CHROME, 18WX18DX48H')).toEqual(['WIRE', 'BASKET', 'CHROME']);
    });

    it('filters out stop words and short tokens', () => {
        expect(extractKeywords('for the fan with a 12 volt motor')).toEqual(['FAN', 'VOLT', 'MOTOR']);
    });

    it('returns empty array for a description with no significant words', () => {
        expect(extractKeywords('a b c')).toEqual([]);
    });
});
