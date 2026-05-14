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
    });

    it('auto-accepts exact local Grainger matches when direct formula is incomplete', async () => {
        const match: CWeightLocalResearchMatch = {
            decision: 'AUTO_ACCEPT',
            chargeableWeightKg: 2.3,
            itemWeightKg: 1.4,
            dimensionL: 20,
            dimensionW: 10,
            dimensionH: 8,
            dimUnit: 'CM',
            source: 'local_exact_match',
            confidence: 0.97,
            reason: 'Resolved from local GRAINGER @GRAINGER_CWEIGHT exact Grainger code match: 5YR11.',
        };
        const repository: CWeightLookupRepository = {
            findGraingerCWeightExactMatch: vi.fn(async () => match),
        };

        const result = await resolveCWeightLookup({
            supplierOrderCode: '5YR11',
        }, repository);

        expect(repository.findGraingerCWeightExactMatch).toHaveBeenCalledWith({
            supplierOrderCode: '5YR11',
        });
        expect(result).toEqual({
            decision: 'AUTO_ACCEPT',
            chargeableWeightKg: 2.3,
            itemWeightKg: 1.4,
            dimensionL: 20,
            dimensionW: 10,
            dimensionH: 8,
            dimUnit: 'CM',
            source: 'local_exact_match',
            confidence: 0.97,
            reason: 'Resolved from local GRAINGER @GRAINGER_CWEIGHT exact Grainger code match: 5YR11.',
        });
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
    });
});
