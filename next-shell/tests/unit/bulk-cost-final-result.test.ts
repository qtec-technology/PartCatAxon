import { describe, expect, it } from 'vitest';
import {
  BULK_COST_AY_CP_COLUMNS,
  BULK_COST_DIAGNOSTIC_COLUMNS,
  FINAL_RESULT_COLS,
  toAyCpFinalResultRow,
} from '@/features/bulk-cost/bulk-cost.final-result';
import { mapBulkCostToTermCalcResults, mapBulkCostToTermFormData } from '@/features/bulk-cost/bulk-cost.preview';
import type { AllocationLineSource, FinalResultColumns } from '@/features/bulk-cost/bulk-cost.types';

const AY_CP_COLUMNS = [
  'AY', 'AZ', 'BA', 'BB', 'BC', 'BD', 'BE', 'BF', 'BG', 'BH', 'BI', 'BJ', 'BK', 'BL', 'BM', 'BN',
  'BO', 'BP', 'BQ', 'BR', 'BS', 'BT', 'BU', 'BV', 'BW', 'BX', 'BY', 'BZ', 'CA', 'CB', 'CC', 'CD',
  'CE', 'CF', 'CG', 'CH', 'CI', 'CJ', 'CK', 'CL', 'CM', 'CN', 'CO', 'CP',
];

function makeFinalResult(overrides: Partial<FinalResultColumns> = {}): FinalResultColumns {
  return {
    supplierName: 'Supplier A',
    purchaseOrderTerm: 'FCA',
    termLocation: 'TH',
    productCost: 100,
    pkh: 1,
    soc: 2,
    docCOC: 0,
    docMill: 0,
    docTestCert: 0,
    docCOO: 0,
    docAnyOther: 0,
    docFees: 0,
    currency: 'USD',
    rateExchange: 35,
    shipWeightCal: 1.5,
    insPercent: 0.5,
    importDutyPercent: 10,
    purchaseUOM: 'EA',
    stockUOM: 'EA',
    saleUOM: 'EA',
    stockConversion: 2,
    saleConversion: 1,
    purchaseMOQ: 1,
    wireTT: 3,
    customClear: 4,
    op1Source: 103,
    op1: 3605,
    exworkCase: 1.03,
    op2: 3713.15,
    ins: 18.56575,
    frQTEC: 200,
    frZoneRate: 0,
    frZoneCost: 0,
    cifQTEC: 3931.71575,
    cifZone: 0,
    dtQTEC: 393.171575,
    dtZone: 0,
    selectedDuty: 393.171575,
    ttFinal: 3,
    ccFinal: 4,
    et: 12.34,
    mt: 1.234,
    miscTaxVal: 5,
    scc: 6,
    preQLC: 4048.311325,
    stk: 40.483113,
    qlc: 4088.8,
    spk: 7,
    qocVal: 8,
    totalQLC: 2059.4,
    markup: 200,
    roundUp: 2259.4,
    ...overrides,
  };
}

function makeSource(): AllocationLineSource {
  return {
    lineKey: 'L1',
    no: 1,
    itemGroup: '104',
    itemCategory: '',
    sapDescription: '',
    manufacturer: '',
    mfgPartNumber: '',
    supplierOrderCode: '',
    ggCode: '',
    itemCode: '',
    vendorCode: '',
    vendorName: '',
    qty: 1,
    uom: 'EA',
    unitPrice: 100,
    amount: 100,
    currency: 'USD',
    countryOfOrigin: '',
    hsCode: '',
    docFee: { coc: 0, millCert: 0, testCert: 0, coa: 0, coo: 0, anyOther: 0 },
    deliveryLeadTime: '',
    orderTerm: 'FCA',
    location: 'TH',
    importPermit: '',
    shelfLifeRequire: '',
    itemWeightPerEach: 1,
    dimensionWeightPerEach: null,
    shippingWeightPerEach: null,
    totalShippingWeight: null,
    importDutyPercent: 10,
    termId: null,
    purchaseUOM: 'EA',
    stockUOM: 'EA',
    saleUOM: 'EA',
    stockConversion: 2,
    saleConversion: 1,
    moq: 1,
    insPercent: 0.5,
    shipModeNo: 1,
    freightRate: 720,
    dimUnit: 1,
    length: 1,
    width: 1,
    height: 1,
    zoneRate: 0,
    etPercent: 0,
    miscTax: 0,
    scc: 0,
    stkPercent: 0,
    markupPercent: 0,
    sspk: 0,
    qoc: 0,
  };
}

describe('Bulk Cost final result schema', () => {
  it('keeps the final result table aligned to Excel AY-CP only', () => {
    expect(BULK_COST_AY_CP_COLUMNS).toHaveLength(44);
    expect(BULK_COST_AY_CP_COLUMNS.map((column) => column.excelColumn)).toEqual(AY_CP_COLUMNS);
    expect(FINAL_RESULT_COLS).toBe(BULK_COST_AY_CP_COLUMNS);
  });

  it('keeps diagnostics separate from the AY-CP table', () => {
    const ayCpKeys = new Set(BULK_COST_AY_CP_COLUMNS.map((column) => column.key));

    expect(ayCpKeys.has('op1Source')).toBe(false);
    expect(ayCpKeys.has('docFees')).toBe(false);
    expect(BULK_COST_DIAGNOSTIC_COLUMNS.map((column) => column.key)).toContain('op1Source');
    expect(BULK_COST_DIAGNOSTIC_COLUMNS.map((column) => column.key)).toContain('docFees');
    expect(BULK_COST_DIAGNOSTIC_COLUMNS.every((column) => !column.excelColumn)).toBe(true);
  });

  it('labels OP1 source diagnostics for Term mapping', () => {
    const labelsByKey = new Map(BULK_COST_DIAGNOSTIC_COLUMNS.map((column) => [column.key, column.label]));

    expect(labelsByKey.get('docFees')).toBe('Documents Fees (FEES)');
    expect(labelsByKey.get('op1Source')).toBe('OP1 (PSC)');
  });

  it('labels final-result money fields for Step 3 mapping', () => {
    const labelsByKey = new Map(BULK_COST_AY_CP_COLUMNS.map((column) => [column.key, column.label]));

    expect(labelsByKey.get('frQTEC')).toBe('FR QTEC');
    expect(labelsByKey.get('wireTT')).toBe('TT (THB)');
    expect(labelsByKey.get('customClear')).toBe('CC (THB)');
    expect(labelsByKey.get('ttFinal')).toBe('TT Final (THB)');
    expect(labelsByKey.get('ccFinal')).toBe('CC Final (THB)');
    expect(labelsByKey.get('spk')).toBe('SPK (THB)');
    expect(labelsByKey.get('qocVal')).toBe('QOC (THB)');
  });

  it('exports AY-CP rows by Excel column letter', () => {
    const row = toAyCpFinalResultRow(makeFinalResult());

    expect(Object.keys(row)).toEqual(AY_CP_COLUMNS);
    expect(row.BW).toBe(3605);
    expect(row.CP).toBe(2259.4);
    expect(row).not.toHaveProperty('op1Source');
  });
});

describe('Bulk Cost Term preview mapping', () => {
  it('passes ET/MT/preQLC/STK and QLC2 through to the Term preview', () => {
    const termResults = mapBulkCostToTermCalcResults(makeSource(), makeFinalResult());

    expect(termResults.ET).toBe(12.34);
    expect(termResults.MT).toBe(1.234);
    expect(termResults.PRE_QLC).toBe(4048.311325);
    expect(termResults.STK).toBe(40.483113);
    expect(termResults.QLC2).toBe(2044.4);
    expect(termResults.QLC3).toBe(2059.4);
    expect(termResults.TOTAL_PRICE).toBe(2059.4);
  });

  it('splits actual Freight FR from Freight to QTEC WH reference in Term preview', () => {
    const source = makeSource();
    const finalResult = makeFinalResult({ frQTEC: 200, shipWeightCal: 1.5 });

    const formData = mapBulkCostToTermFormData(source, {
      pkh: 0,
      soc: 0,
      freight: 0,
      customs: 0,
      wireTT: 0,
      currency: 'USD',
      exchangeRate: 35,
      referenceNo: '',
      remark: '',
      orderTerm: 'FCA',
      location: 'TH',
      shipModeNo: 1,
      contactPerson: '',
      saleIncharge: '',
    }, finalResult);
    const calcResults = mapBulkCostToTermCalcResults(source, finalResult);

    expect(formData.fr).toBe(200);
    expect(formData.validFrom).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(calcResults.FR_QTEC).toBe(1080);
  });
});
