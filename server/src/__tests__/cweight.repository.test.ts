import { describe, expect, it } from 'vitest';
import { toCWeightLocalResearchMatch } from '#src/repositories/cweight.repository.js';

describe('cweight.repository', () => {
    it('maps GraingerWeightData rows to exact local CWeight matches', () => {
        const result = toCWeightLocalResearchMatch({
            GraingerOrderCode: '5YR11',
            ManufacturerPartNo: 'ABC-123',
            ManufacturerName: 'ACME',
            ItemWeightKg: '1.4',
            LengthCm: '20',
            WidthCm: '10',
            HeightCm: '8',
            DimWeightKg: '2.3',
            MatchMethod: 'grainger_order_code',
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
            reason: 'Resolved from local GraingerWeightData exact Grainger code match: 5YR11.',
        });
    });

    it('rejects rows without usable weight evidence instead of inventing CWeight', () => {
        const result = toCWeightLocalResearchMatch({
            GraingerOrderCode: '5YR11',
            ManufacturerPartNo: 'ABC-123',
            ManufacturerName: 'ACME',
            ItemWeightKg: null,
            LengthCm: '20',
            WidthCm: '10',
            HeightCm: '8',
            DimWeightKg: null,
            MatchMethod: 'manufacturer_part_no',
        });

        expect(result).toBeNull();
    });
});
