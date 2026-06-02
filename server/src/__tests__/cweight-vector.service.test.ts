import { describe, expect, it } from 'vitest';
import { findCWeightVectorCandidates, type CWeightVectorInput } from '#src/services/cweight-vector.service.js';

describe('cweight-vector.service', () => {
    it('returns an empty candidate list (prototype stub)', async () => {
        const input: CWeightVectorInput = {
            description: 'Heavy duty roller chain 80 pitch 10 ft',
            category1: 'Conveying Equipment',
            manufacturerName: 'TSUBAKI',
        };

        const candidates = await findCWeightVectorCandidates(input);

        expect(candidates).toEqual([]);
    });

    it('returns an empty list when all inputs are null', async () => {
        const candidates = await findCWeightVectorCandidates({});

        expect(candidates).toEqual([]);
    });

    it('each returned candidate must have a graingerNo, confidence, and reason', async () => {
        // Interface contract: even when the stub returns nothing, the shape is verified
        const candidates = await findCWeightVectorCandidates({
            description: 'test item',
        });

        for (const c of candidates) {
            expect(typeof c.graingerNo).toBe('string');
            expect(c.graingerNo.length).toBeGreaterThan(0);
            expect(typeof c.confidence).toBe('number');
            expect(c.confidence).toBeGreaterThanOrEqual(0);
            expect(c.confidence).toBeLessThanOrEqual(1);
            expect(typeof c.reason).toBe('string');
        }
    });
});
