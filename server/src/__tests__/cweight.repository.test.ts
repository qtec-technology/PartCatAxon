import { describe, expect, it } from 'vitest';
import { toCWeightLocalResearchMatch } from '#src/repositories/cweight.repository.js';

describe('cweight.repository', () => {
    it('maps GRAINGER @GRAINGER_CWEIGHT rows to exact local CWeight matches', () => {
        const result = toCWeightLocalResearchMatch({
            GraingerNo: '100G64',
            MfgPartNo: '1292G',
            MfgName: 'LIBMAN',
            SellPackWeightKg: '2.72',
            VolumetricWeightKg: '53.92',
            ChargeableWeightKg: '53.92',
            SWeight: '2.72',
            VWeight: '53.92',
            CWeight: '53.92',
            MatchMethod: 'grainger_order_code',
        });

        expect(result).toEqual({
            decision: 'AUTO_ACCEPT',
            chargeableWeightKg: 53.92,
            itemWeightKg: 2.72,
            dimensionL: null,
            dimensionW: null,
            dimensionH: null,
            dimUnit: null,
            source: 'local_exact_match',
            confidence: 0.97,
            reason: 'Resolved from local GRAINGER @GRAINGER_CWEIGHT exact Grainger code match: 100G64.',
        });
    });

    it('falls back to max actual or volumetric weight when explicit chargeable weight is unavailable', () => {
        const result = toCWeightLocalResearchMatch({
            GraingerNo: '100G64',
            MfgPartNo: '1292G',
            MfgName: 'LIBMAN',
            SellPackWeightKg: '2.72',
            VolumetricWeightKg: '53.92',
            ChargeableWeightKg: null,
            SWeight: null,
            VWeight: null,
            CWeight: null,
            MatchMethod: 'manufacturer_part_no_brand',
        });

        expect(result?.chargeableWeightKg).toBe(53.92);
        expect(result?.itemWeightKg).toBe(2.72);
        expect(result?.confidence).toBe(0.94);
    });

    it('rejects rows without usable weight evidence instead of inventing CWeight', () => {
        const result = toCWeightLocalResearchMatch({
            GraingerNo: '100G64',
            MfgPartNo: '1292G',
            MfgName: 'LIBMAN',
            SellPackWeightKg: null,
            VolumetricWeightKg: null,
            ChargeableWeightKg: null,
            SWeight: null,
            VWeight: null,
            CWeight: null,
            MatchMethod: 'manufacturer_part_no',
        });

        expect(result).toBeNull();
    });
});
