import { describe, expect, it } from 'vitest';
import {
    buildAuthoritativeBulkCostDraft,
    calculateBulkCostPreview,
} from '#src/services/bulk-cost-calculation.service.js';
import type { SaveBulkCostRunInput } from '#src/types/bulk-cost.types.js';

function makeLine(overrides: Record<string, unknown> = {}) {
    return {
        lineKey: 'L1',
        no: 1,
        qty: 2,
        unitPrice: 10,
        amount: 20,
        currency: 'USD',
        vendorCode: 'V-001',
        vendorName: 'Vendor',
        supplierOrderCode: 'SUP-1',
        docFee: { coc: 0, millCert: 0, testCert: 0, coa: 0, coo: 0, anyOther: 0 },
        itemWeightPerEach: 1,
        dimensionWeightPerEach: null,
        shippingWeightPerEach: 1,
        importDutyPercent: 5,
        insPercent: 1,
        shipModeNo: 1,
        freightRate: 0,
        dimUnit: 1,
        length: 0,
        width: 0,
        height: 0,
        zoneRate: 0,
        etPercent: 0,
        miscTax: 0,
        scc: 0,
        stkPercent: 0,
        markupPercent: 10,
        stockConversion: 1,
        saleConversion: 1,
        purchaseUOM: 'PCS',
        stockUOM: 'PCS',
        saleUOM: 'PCS',
        ...overrides,
    };
}

describe('calculateBulkCostPreview', () => {
    it('allocates selected manual lines through the backend calculation path', () => {
        const preview = calculateBulkCostPreview({
            costs: {
                pkh: 10,
                soc: 5,
                freight: 100,
                customs: 20,
                wireTT: 3,
                currency: 'USD',
                exchangeRate: 35,
                orderTerm: 'FCA',
                location: 'US',
                shipModeNo: 1,
            },
            lines: [makeLine()],
        });

        expect(preview.totalLines).toBe(1);
        expect(preview.totalQty).toBe(2);
        expect(preview.totalWeight).toBe(2);
        expect(preview.lines[0].pkhPerItem).toBe(10);
        expect(preview.lines[0].freightPerEach).toBe(50);
        expect(preview.lines[0].finalResult.op1Source).toBe(17.5);
        expect(preview.lines[0].finalResult.frQTEC).toBe(50);
        expect(preview.lines[0].status).toBe('ready');
    });

    it('returns warnings instead of calculating hidden frontend fallbacks', () => {
        const preview = calculateBulkCostPreview({
            costs: { currency: 'THB', exchangeRate: 1, orderTerm: 'Exwork', shipModeNo: 5 },
            lines: [makeLine({ shippingWeightPerEach: null, itemWeightPerEach: null, amount: 0 })],
        });

        expect(preview.weightMissing).toBe(1);
        expect(preview.lines[0].warnings.map((warning) => warning.code)).toContain('MISSING_WEIGHT');
        expect(preview.lines[0].warnings.map((warning) => warning.code)).toContain('MISSING_AMOUNT');
    });

    it('enforces one supplier and one currency per included run', () => {
        const preview = calculateBulkCostPreview({
            costs: { currency: 'USD', exchangeRate: 35, orderTerm: 'FCA', shipModeNo: 1 },
            lines: [
                makeLine({ lineKey: 'A', vendorCode: 'V-001', currency: 'USD' }),
                makeLine({ lineKey: 'B', vendorCode: 'V-002', currency: 'EUR' }),
            ],
        });

        expect(preview.runWarnings.map((warning) => warning.code)).toContain('MIXED_VENDOR');
        expect(preview.runWarnings.map((warning) => warning.code)).toContain('MIXED_CURRENCY');
    });

    it('excludes lines marked out of calculation and preserves VAT as a diagnostic', () => {
        const preview = calculateBulkCostPreview({
            costs: { freight: 100, customs: 20, wireTT: 10, currency: 'THB', exchangeRate: 1, orderTerm: 'Exwork', shipModeNo: 3 },
            lines: [
                makeLine({ lineKey: 'A', qty: 1, amount: 100, unitPrice: 100, vatPercent: 7 }),
                makeLine({ lineKey: 'B', includeInCalculation: false, vendorCode: 'OTHER', currency: 'EUR' }),
            ],
        });

        expect(preview.totalLines).toBe(1);
        expect(preview.excludedLineCount).toBe(1);
        expect(preview.runWarnings).toHaveLength(0);
        expect(preview.lines[0].finalResult.vatAmount).toBeCloseTo(preview.lines[0].finalResult.roundUp * 0.07, 6);
        expect(preview.lines[0].finalResult.roundUpWithVat).toBeCloseTo(
            preview.lines[0].finalResult.roundUp + preview.lines[0].finalResult.vatAmount,
            6,
        );
    });

    it('rebuilds stale client save payloads with backend calculation results', () => {
        const latest = makeLine();
        const draft = buildAuthoritativeBulkCostDraft({
            supplierCode: 'V-001',
            supplierName: 'Vendor',
            status: 'DRAFT',
            costs: { pkh: 10, soc: 5, freight: 100, customs: 20, wireTT: 3, currency: 'USD', exchangeRate: 35, orderTerm: 'FCA', shipModeNo: 1 },
            originLines: [latest],
            latestLines: [latest],
            preview: { totalLines: 999, lines: [] },
            lines: [{
                lineKey: 'L1',
                origin: latest,
                latest,
                result: { finalResult: { op1Source: 1, roundUp: 1 } },
            }],
        } satisfies SaveBulkCostRunInput);

        const result = draft.lines[0].result as Record<string, unknown>;
        const finalResult = result.finalResult as Record<string, unknown>;
        expect(draft.preview.totalLines).toBe(1);
        expect(finalResult.op1Source).toBe(17.5);
        expect(finalResult.roundUp).not.toBe(1);
    });

    it('recalculates only the lines in the save payload so unselected UI lines are not persisted', () => {
        const selected = makeLine({ lineKey: 'SELECTED', vendorCode: 'V-001', currency: 'USD' });
        const unselected = makeLine({ lineKey: 'UNSELECTED', vendorCode: 'V-002', currency: 'EUR' });
        const draft = buildAuthoritativeBulkCostDraft({
            supplierCode: 'V-001',
            supplierName: 'Vendor',
            status: 'DRAFT',
            costs: { freight: 100, customs: 20, wireTT: 3, currency: 'USD', exchangeRate: 35, orderTerm: 'FCA', shipModeNo: 1 },
            originLines: [selected, unselected],
            latestLines: [selected, unselected],
            preview: { totalLines: 1, lines: [] },
            lines: [{
                lineKey: 'SELECTED',
                origin: selected,
                latest: selected,
                result: { finalResult: {} },
            }],
        } satisfies SaveBulkCostRunInput);

        expect(draft.preview.totalLines).toBe(1);
        expect(draft.preview.runWarnings).toHaveLength(0);
        expect(draft.lines.map((line) => line.lineKey)).toEqual(['SELECTED']);
    });
});
