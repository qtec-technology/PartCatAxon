import { describe, expect, it, vi } from 'vitest';
import {
    resolveBulkCostCWeightPrefill,
    toCWeightLookupInput,
} from '#src/services/bulk-cost-cweight.service.js';
import type { CWeightResult } from '#src/services/cweight.service.js';

const cweightResult: CWeightResult = {
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
};

describe('bulk-cost-cweight.service', () => {
    it('maps Bulk Cost draft line fields into CWeight lookup input', () => {
        const result = toCWeightLookupInput({
            supplierOrderCode: ' 100G64 ',
            mfgPartNumber: ' 1292G ',
            manufacturer: ' LIBMAN ',
            itemWeightPerEach: '2.72',
            length: '10',
            width: '20',
            height: '30',
            dimUnit: 'CM',
        }, { shipModeNo: 1 });

        expect(result).toEqual({
            supplierOrderCode: '100G64',
            manufacturerPartNo: '1292G',
            manufacturerName: 'LIBMAN',
            itemWeightKg: 2.72,
            length: 10,
            width: 20,
            height: 30,
            dimUnit: 'CM',
            shipModeNo: 1,
        });
    });

    it('returns reviewable suggestions without saving or overwriting line data', async () => {
        const resolveCWeight = vi.fn(async () => cweightResult);

        const result = await resolveBulkCostCWeightPrefill({
            lines: [{
                lineKey: 'L1',
                latest: { supplierOrderCode: '100G64' },
            }],
        }, resolveCWeight);

        expect(resolveCWeight).toHaveBeenCalledWith({
            supplierOrderCode: '100G64',
            manufacturerPartNo: null,
            manufacturerName: null,
            itemWeightKg: null,
            length: null,
            width: null,
            height: null,
            dimUnit: null,
            shipModeNo: null,
        });
        expect(result).toEqual([{ lineKey: 'L1', prefillAllowed: true, ...cweightResult }]);
    });

    it('keeps a resolved suggestion from being auto-prefilled when the line is locked by user edit', async () => {
        const result = await resolveBulkCostCWeightPrefill({
            lines: [{
                lineKey: 'L1',
                latest: { supplierOrderCode: '100G64' },
                lockedByUser: true,
            }],
        }, async () => cweightResult);

        expect(result[0].decision).toBe('AUTO_ACCEPT');
        expect(result[0].prefillAllowed).toBe(false);
    });
});
