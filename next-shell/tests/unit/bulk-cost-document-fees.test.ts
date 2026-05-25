import { describe, expect, it } from 'vitest';
import { calculateAllocationPreview } from '@/features/bulk-cost/bulk-cost.calc';
import {
  mapDocumentFeeCandidateToItemData,
  normalizeDocumentFeesForLine,
} from '@/features/bulk-cost/bulk-cost.document-fees';
import type { AllocationLineSource, BulkCostInput } from '@/features/bulk-cost/bulk-cost.types';

function makeLine(overrides: Partial<AllocationLineSource> = {}): AllocationLineSource {
  return {
    lineKey: 'L-DOC-1',
    no: 1,
    itemGroup: '104',
    itemCategory: 'Tools',
    sapDescription: 'Document fee source item',
    manufacturer: 'PROTO',
    mfgPartNumber: 'PN-001',
    supplierOrderCode: 'SUP-001',
    ggCode: '',
    qty: 5,
    uom: 'EA',
    unitPrice: 100,
    amount: 500,
    currency: 'USD',
    countryOfOrigin: 'US',
    hsCode: '',
    docFee: { coc: 0, millCert: 0, testCert: 0, coa: 0, coo: 0, anyOther: 0 },
    deliveryLeadTime: '6 Weeks',
    orderTerm: 'Ex-work',
    location: 'California',
    importPermit: 'No',
    shelfLifeRequire: 'No',
    itemWeightPerEach: 1,
    dimensionWeightPerEach: null,
    shippingWeightPerEach: 1,
    totalShippingWeight: 5,
    importDutyPercent: 0,
    vendorCode: 'V-GRA',
    vendorName: 'Grainger',
    termId: null,
    itemCode: '',
    purchaseUOM: 'EA',
    stockUOM: 'EA',
    saleUOM: 'EA',
    stockConversion: 1,
    saleConversion: 1,
    moq: null,
    insPercent: 0,
    shipModeNo: 5,
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
    markupPercent: 0,
    sspk: 0,
    qoc: 0,
    ...overrides,
    customerStockCode: overrides.customerStockCode ?? '',
    permitType: overrides.permitType ?? '',
    subLocation: overrides.subLocation ?? '',
  };
}

function makeCosts(overrides: Partial<BulkCostInput> = {}): BulkCostInput {
  return {
    pkh: 0,
    soc: 0,
    freight: 0,
    customs: 0,
    wireTT: 0,
    currency: 'USD',
    exchangeRate: 35,
    referenceNo: '',
    remark: '',
    orderTerm: 'Ex-work',
    location: 'California',
    shipModeNo: 5,
    contactPerson: '',
    saleIncharge: '',
    ...overrides,
    subLocation: overrides.subLocation ?? '',
  };
}

describe('Bulk Cost document fee basis', () => {
  it('leaves OP1 unchanged when there are no document fees', () => {
    const line = makeLine();
    const preview = calculateAllocationPreview([line], makeCosts());

    expect(preview.lines[0].finalResult.op1Source).toBe(100);
    expect(preview.lines[0].finalResult.op1).toBe(3500);
  });

  it('includes Per Each document fees directly in OP1', () => {
    const { line, separateLineCandidates } = normalizeDocumentFeesForLine(makeLine(), [
      { kind: 'coc', basis: 'PER_EACH', amount: 2 },
      { kind: 'testCert', basis: 'PER_EACH', amount: 3 },
    ]);
    const preview = calculateAllocationPreview([line], makeCosts());

    expect(separateLineCandidates).toHaveLength(0);
    expect(preview.lines[0].finalResult.docCOC).toBe(2);
    expect(preview.lines[0].finalResult.docTestCert).toBe(3);
    expect(preview.lines[0].finalResult.op1Source).toBe(105);
    expect(preview.lines[0].finalResult.op1).toBe(3675);
  });

  it('normalizes item-line document fee totals to per each before OP1', () => {
    const { line } = normalizeDocumentFeesForLine(makeLine({ qty: 5 }), [
      { kind: 'millCert', basis: 'ITEM_TOTAL', amount: 50 },
    ]);
    const preview = calculateAllocationPreview([line], makeCosts());

    expect(preview.lines[0].finalResult.docMill).toBe(10);
    expect(preview.lines[0].finalResult.op1Source).toBe(110);
  });

  it('keeps By Lot / Batch document fees out of product OP1 and creates separate line candidates', () => {
    const { line, separateLineCandidates } = normalizeDocumentFeesForLine(makeLine(), [
      { kind: 'coo', basis: 'BY_LOT_BATCH', amount: 120, label: 'COO Certificate' },
    ]);
    const preview = calculateAllocationPreview([line], makeCosts());

    expect(preview.lines[0].finalResult.docCOO).toBe(0);
    expect(preview.lines[0].finalResult.op1Source).toBe(100);
    expect(separateLineCandidates).toHaveLength(1);
    expect(separateLineCandidates[0]).toMatchObject({
      description: 'COO Certificate By Lot / Batch',
      qty: 1,
      unitPrice: 120,
      amount: 120,
      currency: 'USD',
      itemGroup: '107',
    });
  });

  it('maps a By Lot / Batch candidate to a PartCatalog add-item draft that sales can manually edit', () => {
    const { separateLineCandidates } = normalizeDocumentFeesForLine(makeLine(), [
      { kind: 'testCert', basis: 'BY_LOT_BATCH', amount: 250, label: 'Pressure Test Certificate' },
    ]);

    const itemData = mapDocumentFeeCandidateToItemData(separateLineCandidates[0], makeLine());

    expect(itemData.itemGroup).toBe('107');
    expect(itemData.itemCategory).toBe('Service');
    expect(itemData.catalogNo).toBe('');
    expect(itemData.b1ItemNo).toBe('');
    expect(itemData.certificateRequired).toBe(true);
    expect(itemData.itemDescription).toBe('Pressure Test Certificate By Lot / Batch');
    expect(itemData.remark).toContain('Sales can edit, delete, or redistribute manually');
  });
});
