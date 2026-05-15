import { describe, expect, it } from 'vitest';
import { buildBulkCostRunDraftPayload } from '@/features/bulk-cost/bulk-cost.api';
import type {
  AllocationLineResult,
  AllocationLineSource,
  AllocationPreview,
  BulkCostInput,
  FinalResultColumns,
} from '@/features/bulk-cost/bulk-cost.types';

function makeLine(overrides: Partial<AllocationLineSource> = {}): AllocationLineSource {
  return {
    lineKey: 'L1',
    no: 1,
    itemGroup: '104',
    itemCategory: 'Electrical',
    sapDescription: 'Test item',
    manufacturer: 'MFG',
    mfgPartNumber: 'MPN-1',
    supplierOrderCode: 'SUP-1',
    ggCode: 'GG-1',
    qty: 2,
    uom: 'PCS',
    unitPrice: 10,
    amount: 20,
    currency: 'USD',
    countryOfOrigin: 'US',
    hsCode: '8536',
    docFee: { coc: 0, millCert: 0, testCert: 0, coa: 0, coo: 0, anyOther: 0 },
    deliveryLeadTime: '10D',
    orderTerm: 'FCA',
    location: 'US',
    importPermit: 'No',
    shelfLifeRequire: 'No',
    itemWeightPerEach: 1,
    dimensionWeightPerEach: null,
    shippingWeightPerEach: 1,
    totalShippingWeight: 2,
    importDutyPercent: 5,
    vendorCode: 'V-001',
    vendorName: 'Vendor',
    termId: 123,
    itemCode: 'ITEM-1',
    purchaseUOM: 'PCS',
    stockUOM: 'PCS',
    saleUOM: 'PCS',
    stockConversion: 1,
    saleConversion: 1,
    moq: 1,
    insPercent: 1,
    shipModeNo: 1,
    freightRate: 100,
    dimUnit: 1,
    length: 1,
    width: 1,
    height: 1,
    zoneRate: 0,
    etPercent: 0,
    miscTax: 0,
    scc: 0,
    stkPercent: 0,
    markupPercent: 10,
    sspk: 0,
    qoc: 0,
    ...overrides,
  };
}

function makeCosts(): BulkCostInput {
  return {
    pkh: 10,
    soc: 5,
    freight: 100,
    customs: 20,
    wireTT: 3,
    currency: 'USD',
    exchangeRate: 35,
    referenceNo: 'Q-1',
    remark: '',
    orderTerm: 'FCA',
    location: 'US',
    shipModeNo: 1,
    contactPerson: '',
    saleIncharge: '',
  };
}

function makeFinalResult(overrides: Partial<FinalResultColumns> = {}): FinalResultColumns {
  return {
    supplierName: 'Vendor',
    purchaseOrderTerm: 'FCA',
    termLocation: 'US',
    productCost: 10,
    pkh: 1,
    soc: 1,
    docCOC: 0,
    docMill: 0,
    docTestCert: 0,
    docCOO: 0,
    docAnyOther: 0,
    docFees: 0,
    currency: 'USD',
    rateExchange: 35,
    shipWeightCal: 1,
    insPercent: 1,
    importDutyPercent: 5,
    purchaseUOM: 'PCS',
    stockUOM: 'PCS',
    saleUOM: 'PCS',
    stockConversion: 1,
    saleConversion: 1,
    purchaseMOQ: 1,
    wireTT: 1,
    customClear: 1,
    op1Source: 12,
    op1: 420,
    exworkCase: 1,
    op2: 420,
    ins: 4.2,
    frQTEC: 100,
    frZoneRate: 0,
    frZoneCost: 0,
    cifQTEC: 424.2,
    cifZone: 0,
    dtQTEC: 21.21,
    dtZone: 0,
    selectedDuty: 21.21,
    ttFinal: 1,
    ccFinal: 1,
    et: 0,
    mt: 0,
    miscTaxVal: 0,
    scc: 0,
    preQLC: 447,
    stk: 0,
    qlc: 448,
    spk: 0,
    qocVal: 0,
    totalQLC: 448,
    markup: 49.78,
    roundUp: 497.78,
    ...overrides,
  };
}

function makePreview(result: AllocationLineResult): AllocationPreview {
  return {
    previewedAt: '2026-05-08T00:00:00.000Z',
    vendorCode: 'V-001',
    vendorName: 'Vendor',
    totalLines: 1,
    totalQty: 2,
    totalAmount: 20,
    totalWeight: 2,
    weightAvailable: 1,
    weightMissing: 0,
    lines: [result],
    runWarnings: [],
    roundingResidual: { pkh: 0, soc: 0, freight: 0, customs: 0, wireTT: 0 },
  };
}

describe('buildBulkCostRunDraftPayload', () => {
  it('keeps origin/latest/result snapshots and hidden AXON hints', () => {
    const origin = makeLine({ sapDescription: 'Origin description' });
    const latest = makeLine({
      sapDescription: 'Latest description',
      axonUniqueLineId: 'AXON-1',
      axonMatchMethod: 'HYBRID_SEARCH',
      axonMatchConfidence: 0.88,
    });
    const result: AllocationLineResult = {
      lineKey: 'L1',
      weightRatioPerItem: 1,
      weightRatioPerEach: 0.5,
      valueRatioPerItem: 1,
      valueRatioPerEach: 0.5,
      pkhPerEach: 1,
      pkhPerItem: 2,
      socPerEach: 1,
      socPerItem: 2,
      freightPerEach: 1,
      freightPerItem: 2,
      wireTTPerEach: 1,
      wireTTPerItem: 2,
      ccPerEach: 1,
      ccPerItem: 2,
      finalResult: makeFinalResult(),
      warnings: [],
      status: 'ready',
    };

    const payload = buildBulkCostRunDraftPayload({
      supplierCode: 'V-001',
      supplierName: 'Vendor',
      costs: makeCosts(),
      originLines: [origin],
      latestLines: [latest],
      preview: makePreview(result),
      getFinalResultForLine: () => makeFinalResult({ roundUp: 500 }),
    });

    expect(payload.status).toBe('DRAFT');
    expect(payload.lines).toHaveLength(1);
    expect(payload.lines[0].origin?.sapDescription).toBe('Origin description');
    expect(payload.lines[0].latest.sapDescription).toBe('Latest description');
    expect(payload.lines[0].result.finalResult.roundUp).toBe(500);
    expect(payload.lines[0].axon).toEqual({
      uniqueLineId: 'AXON-1',
      matchMethod: 'HYBRID_SEARCH',
      matchConfidence: 0.88,
    });
  });
});
