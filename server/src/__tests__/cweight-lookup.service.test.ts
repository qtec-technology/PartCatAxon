import { describe, expect, it, vi } from 'vitest';
import { resolveCWeightLookup, type CWeightLookupRepository } from '#src/services/cweight-lookup.service.js';
import type { CWeightLocalResearchMatch } from '#src/services/cweight.service.js';

describe('cweight-lookup.service', () => {
    it('uses direct formula inputs before querying local Grainger data', async () => {
        const repository: CWeightLookupRepository = {
            findGraingerCWeightExactMatch: vi.fn(),
        };

        const result = await resolveCWeightLookup({
            itemWeightKg: 10.1,
            length: 50,
            width: 40,
            height: 30,
            dimUnit: 'CM',
            shipModeNo: 1,
            supplierOrderCode: '5YR11',
        }, repository);

        expect(repository.findGraingerCWeightExactMatch).not.toHaveBeenCalled();
        expect(result.decision).toBe('AUTO_ACCEPT');
        expect(result.source).toBe('direct_formula');
        expect(result.chargeableWeightKg).toBe(10.5);
        expect(result.matchedGraingerNo).toBeNull();
    });

    it('auto-accepts exact local Grainger matches when direct formula is incomplete', async () => {
        const match: CWeightLocalResearchMatch = {
            decision: 'AUTO_ACCEPT',
            chargeableWeightKg: 2.3,
            itemWeightKg: 1.4,
            dimensionalWeightKg: null,
            dimensionL: 20,
            dimensionW: 10,
            dimensionH: 8,
            dimUnit: 'CM',
            source: 'local_exact_match',
            confidence: 0.97,
            reason: 'Exact Grainger code match: 5YR11.',
            matchedGraingerNo: '5YR11',
            matchedMfgPartNo: null,
            matchedBrand: null,
            evidence: null,
        };
        const repository: CWeightLookupRepository = {
            findGraingerCWeightExactMatch: vi.fn(async () => match),
        };

        const result = await resolveCWeightLookup({
            supplierOrderCode: '5YR11',
        }, repository);

        expect(repository.findGraingerCWeightExactMatch).toHaveBeenCalledWith(
            expect.objectContaining({ supplierOrderCode: '5YR11' }),
        );
        expect(result).toEqual({
            decision: 'AUTO_ACCEPT',
            chargeableWeightKg: 2.3,
            itemWeightKg: 1.4,
            dimensionalWeightKg: null,
            dimensionL: 20,
            dimensionW: 10,
            dimensionH: 8,
            dimUnit: 'CM',
            source: 'local_exact_match',
            confidence: 0.97,
            reason: 'Exact Grainger code match: 5YR11.',
            matchedGraingerNo: '5YR11',
            matchedMfgPartNo: null,
            matchedBrand: null,
            evidence: null,
        });
    });

    it('uses graingerNo as supplierOrderCode when supplierOrderCode is absent', async () => {
        const repository: CWeightLookupRepository = {
            findGraingerCWeightExactMatch: vi.fn(async () => null),
        };

        await resolveCWeightLookup({ graingerNo: 'GRN-001' }, repository);

        expect(repository.findGraingerCWeightExactMatch).toHaveBeenCalledWith(
            expect.objectContaining({ supplierOrderCode: 'GRN-001' }),
        );
    });

    it('returns not found when neither formula nor exact local lookup can resolve CWeight', async () => {
        const repository: CWeightLookupRepository = {
            findGraingerCWeightExactMatch: vi.fn(async () => null),
        };

        const result = await resolveCWeightLookup({
            supplierOrderCode: 'UNKNOWN',
        }, repository);

        expect(repository.findGraingerCWeightExactMatch).toHaveBeenCalledOnce();
        expect(result.decision).toBe('NOT_FOUND');
        expect(result.source).toBe('not_found');
        expect(result.chargeableWeightKg).toBeNull();
        expect(result.matchedGraingerNo).toBeNull();
    });

    it('falls back to vector candidate when exact lookup returns null', async () => {
        const vectorMatch: CWeightLocalResearchMatch = {
            decision: 'AUTO_ACCEPT',
            chargeableWeightKg: 1.8,
            itemWeightKg: 0.9,
            dimensionalWeightKg: 1.2,
            dimensionL: null,
            dimensionW: null,
            dimensionH: null,
            dimUnit: null,
            source: 'local_exact_match',
            confidence: 0.97,
            reason: 'Exact match for GRN-VEC.',
            matchedGraingerNo: 'GRN-VEC',
            matchedMfgPartNo: null,
            matchedBrand: null,
            evidence: null,
        };

        const repository: CWeightLookupRepository = {
            findGraingerCWeightExactMatch: vi.fn(async (input) => {
                // Returns null for original input, matches the vector candidate Grainger No
                return input.supplierOrderCode === 'GRN-VEC' ? vectorMatch : null;
            }),
            findCWeightVectorCandidates: vi.fn(async () => [
                { graingerNo: 'GRN-VEC', confidence: 0.75, reason: 'Description token match.' },
            ]),
        };

        const result = await resolveCWeightLookup({
            description: 'Heavy duty chain link 3/8 in',
            category1: 'Material Handling',
        }, repository);

        expect(repository.findCWeightVectorCandidates).toHaveBeenCalledOnce();
        expect(result.decision).toBe('REVIEW_SUGGESTION');
        expect(result.source).toBe('vector_candidate');
        expect(result.chargeableWeightKg).toBe(1.8);
        // confidence capped by vector candidate confidence (0.75)
        expect(result.confidence).toBe(0.75);
        expect(result.matchedGraingerNo).toBe('GRN-VEC');
    });

    it('does not auto-overwrite user-supplied itemWeightKg even when a lookup match exists', async () => {
        const repository: CWeightLookupRepository = {
            findGraingerCWeightExactMatch: vi.fn(),
        };

        // User has a locked weight of 4.2 kg
        const result = await resolveCWeightLookup({
            itemWeightKg: 4.2,
            supplierOrderCode: '5YR11',
        }, repository);

        // Direct formula must fire before any lookup is attempted
        expect(repository.findGraingerCWeightExactMatch).not.toHaveBeenCalled();
        expect(result.source).toBe('direct_formula');
        expect(result.chargeableWeightKg).toBe(4.5); // ceil to 0.5 step
        expect(result.itemWeightKg).toBe(4.2);
        expect(result.matchedGraingerNo).toBeNull();
    });

    it('falls back to normalized MFG match when exact lookup finds nothing', async () => {
        const normalizedMatch: CWeightLocalResearchMatch = {
            decision: 'REVIEW_SUGGESTION',
            chargeableWeightKg: 166.15,
            itemWeightKg: 2.0,
            dimensionalWeightKg: null,
            dimensionL: null,
            dimensionW: null,
            dimensionH: null,
            dimUnit: null,
            source: 'local_semantic_match',
            confidence: 0.82,
            reason: 'Normalized MFG part + brand match: 1875208BL / QUANTUM; review recommended.',
            matchedGraingerNo: '10E979',
            matchedMfgPartNo: '1875-208BL',
            matchedBrand: 'QUANTUM',
            evidence: null,
        };
        const repository: CWeightLookupRepository = {
            findGraingerCWeightExactMatch: vi.fn(async () => null),
            findGraingerCWeightNormalizedMatch: vi.fn(async () => normalizedMatch),
        };

        const result = await resolveCWeightLookup({
            manufacturerPartNo: '1875208BL',
            manufacturerName: 'QUANTUM',
        }, repository);

        expect(repository.findGraingerCWeightExactMatch).toHaveBeenCalledOnce();
        expect(repository.findGraingerCWeightNormalizedMatch).toHaveBeenCalledOnce();
        expect(result.decision).toBe('REVIEW_SUGGESTION');
        expect(result.source).toBe('local_semantic_match');
        expect(result.confidence).toBe(0.82);
        expect(result.chargeableWeightKg).toBe(166.15);
    });

    it('falls back to description keyword match when both exact and normalized lookups find nothing', async () => {
        const descMatch: CWeightLocalResearchMatch = {
            decision: 'REVIEW_SUGGESTION',
            chargeableWeightKg: 8.5,
            itemWeightKg: 3.0,
            dimensionalWeightKg: null,
            dimensionL: null,
            dimensionW: null,
            dimensionH: null,
            dimUnit: null,
            source: 'local_semantic_match',
            confidence: 0.55,
            reason: 'Description keyword match (GG: 10E979, MFG: SOMEPART); review required.',
            matchedGraingerNo: '10E979',
            matchedMfgPartNo: 'SOMEPART',
            matchedBrand: 'BRAND',
            evidence: null,
        };
        const repository: CWeightLookupRepository = {
            findGraingerCWeightExactMatch: vi.fn(async () => null),
            findGraingerCWeightNormalizedMatch: vi.fn(async () => null),
            findGraingerCWeightByDescription: vi.fn(async () => descMatch),
        };

        const result = await resolveCWeightLookup({
            description: 'WIRE BASKET CHROME SHELF',
            category1: 'Storage',
        }, repository);

        expect(repository.findGraingerCWeightByDescription).toHaveBeenCalledOnce();
        expect(result.decision).toBe('REVIEW_SUGGESTION');
        expect(result.source).toBe('local_semantic_match');
        expect(result.confidence).toBe(0.55);
        expect(result.chargeableWeightKg).toBe(8.5);
    });
});
