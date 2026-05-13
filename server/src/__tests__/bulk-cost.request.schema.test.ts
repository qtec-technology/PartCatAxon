import { describe, expect, it } from 'vitest';
import { saveBulkCostRunBodySchema } from '#src/dtos/bulk-cost/bulk-cost.request.schema.js';

function makePayload(overrides: Record<string, unknown> = {}) {
    return {
        supplierCode: 'V-001',
        supplierName: 'Supplier',
        status: 'DRAFT',
        costs: { currency: 'USD', exchangeRate: 35, referenceNo: 'Q-1' },
        originLines: [{ lineKey: 'L1', no: 1 }],
        latestLines: [{ lineKey: 'L1', no: 1, qty: 2, unitPrice: 10 }],
        preview: { totalLines: 1, totalQty: 2, totalAmount: 20, totalWeight: 3, lines: [] },
        lines: [{
            lineKey: 'L1',
            origin: { lineKey: 'L1', no: 1 },
            latest: { lineKey: 'L1', no: 1, qty: 2, unitPrice: 10 },
            result: { lineKey: 'L1', finalResult: { op1: 350, roundUp: 400 } },
            axon: { uniqueLineId: 'AXON-L1', matchMethod: 'ITEM_CODE_HINT', matchConfidence: 0.91 },
        }],
        ...overrides,
    };
}

describe('saveBulkCostRunBodySchema', () => {
    it('accepts a DRAFT snapshot payload with hidden AXON hints', () => {
        const result = saveBulkCostRunBodySchema.safeParse(makePayload());

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.status).toBe('DRAFT');
            expect(result.data.lines[0].axon?.uniqueLineId).toBe('AXON-L1');
        }
    });

    it('rejects non-DRAFT statuses in Phase 3A', () => {
        const result = saveBulkCostRunBodySchema.safeParse(makePayload({ status: 'AWARDED' }));

        expect(result.success).toBe(false);
    });

    it('requires at least one latest line and save line', () => {
        const result = saveBulkCostRunBodySchema.safeParse(makePayload({
            latestLines: [],
            lines: [],
        }));

        expect(result.success).toBe(false);
    });
});
