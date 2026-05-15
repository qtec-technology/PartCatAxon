import { describe, expect, it } from 'vitest';
import { calculateAllocationPreview } from '@/features/bulk-cost/bulk-cost.calc';
import { buildBulkCostFormulaAudit } from '@/features/bulk-cost/bulk-cost.formula-audit';
import type { AllocationLineSource, BulkCostInput, FinalResultColumns } from '@/features/bulk-cost/bulk-cost.types';

function makeLine(overrides: Partial<AllocationLineSource> = {}): AllocationLineSource {
  return {
    lineKey: 'AUDIT-1',
    no: 1,
    itemGroup: '104',
    itemCategory: 'Tools',
    sapDescription: 'Audit source item',
    manufacturer: 'PROTO',
    mfgPartNumber: 'PN-001',
    supplierOrderCode: 'SUP-001',
    ggCode: '',
    itemCode: '',
    vendorCode: 'V-AUDIT',
    vendorName: 'Audit Vendor',
    qty: 2,
    uom: 'EA',
    unitPrice: 100,
    amount: 200,
    currency: 'USD',
    countryOfOrigin: 'US',
    hsCode: '',
    docFee: { coc: 2, millCert: 3, testCert: 4, coa: 5, coo: 6, anyOther: 7 },
    deliveryLeadTime: '4 Weeks',
    orderTerm: 'FCA',
    location: 'California',
    importPermit: 'No',
    shelfLifeRequire: 'No',
    itemWeightPerEach: 1,
    dimensionWeightPerEach: null,
    shippingWeightPerEach: 1,
    totalShippingWeight: 2,
    importDutyPercent: 10,
    termId: null,
    purchaseUOM: 'EA',
    stockUOM: 'EA',
    saleUOM: 'EA',
    stockConversion: 2,
    saleConversion: 3,
    moq: 2,
    insPercent: 1,
    shipModeNo: 1,
    freightRate: 0,
    dimUnit: 1,
    length: 0,
    width: 0,
    height: 0,
    zoneRate: 0,
    etPercent: 10,
    miscTax: 20,
    scc: 5,
    stkPercent: 3,
    markupPercent: 20,
    sspk: 11,
    qoc: 13,
    ...overrides,
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
    exchangeRate: 10,
    referenceNo: '',
    remark: '',
    orderTerm: 'FCA',
    location: 'California',
    shipModeNo: 1,
    contactPerson: '',
    saleIncharge: '',
    ...overrides,
  };
}

function auditLine(line: AllocationLineSource = makeLine(), costs: BulkCostInput = makeCosts()) {
  const preview = calculateAllocationPreview([line], costs);
  const allocationLine = preview.lines[0];
  const audit = buildBulkCostFormulaAudit(line, costs, allocationLine.finalResult, { allocationLine });
  return { allocationLine, audit, line };
}

function rowValue(rows: ReturnType<typeof buildBulkCostFormulaAudit>['rows'], key: string, side: 'expectedValue' | 'actualValue') {
  const row = rows.find((candidate) => candidate.stepKey === key);
  if (!row) throw new Error(`Missing audit row ${key}`);
  return row[side];
}

describe('Bulk Cost formula audit', () => {
  it('contains all important formula steps', () => {
    const { audit } = auditLine();

    expect(audit.rows.map((row) => row.stepKey)).toEqual([
      'op-source',
      'op1-thb',
      'op2',
      'ins',
      'fr-actual',
      'fr-zone',
      'cif-actual',
      'cif-zone',
      'dt-actual',
      'dt-zone',
      'selected-duty',
      'et',
      'mt',
      'pre-qlc',
      'stk',
      'qlc',
      'qlc2',
      'total-qlc',
      'markup',
      'sales-price',
    ]);
  });

  it('audits OP1 with per-each document fees included', () => {
    const { audit } = auditLine();

    const opSource = audit.rows.find((row) => row.stepKey === 'op-source');
    expect(opSource?.inputValues).toMatchObject({
      productCost: 100,
      docCOC: 2,
      docMill: 3,
      docTestCert: 4,
      docCOO: 11,
      docAnyOther: 7,
    });
    expect(opSource?.expectedValue).toBe(127);
    expect(opSource?.actualValue).toBe(127);
    expect(opSource?.status).toBe('pass');
  });

  it('keeps ET, MT, preQLC, and STK non-zero when source input has values', () => {
    const { audit } = auditLine();

    expect(rowValue(audit.rows, 'et', 'actualValue')).toBeGreaterThan(0);
    expect(rowValue(audit.rows, 'mt', 'actualValue')).toBeGreaterThan(0);
    expect(rowValue(audit.rows, 'pre-qlc', 'actualValue')).toBeGreaterThan(0);
    expect(rowValue(audit.rows, 'stk', 'actualValue')).toBeGreaterThan(0);
  });

  it('audits QLC2 as QLC divided by stockConversion', () => {
    const { allocationLine, audit } = auditLine();

    const expectedQlc2 = allocationLine.finalResult.qlc / allocationLine.finalResult.stockConversion;
    expect(rowValue(audit.rows, 'qlc2', 'actualValue')).toBeCloseTo(expectedQlc2, 6);
  });

  it('audits Total QLC as QLC2 times saleConversion plus SPK and QOC', () => {
    const { allocationLine, audit } = auditLine();

    const qlc2 = allocationLine.finalResult.qlc / allocationLine.finalResult.stockConversion;
    const expectedTotal = qlc2 * allocationLine.finalResult.saleConversion + allocationLine.finalResult.spk + allocationLine.finalResult.qocVal;
    expect(rowValue(audit.rows, 'total-qlc', 'expectedValue')).toBeCloseTo(expectedTotal, 6);
    expect(rowValue(audit.rows, 'total-qlc', 'actualValue')).toBeCloseTo(expectedTotal, 6);
  });

  it('fails when an actual final result value is incorrectly overridden', () => {
    const { allocationLine, line } = auditLine();
    const overridden: FinalResultColumns = {
      ...allocationLine.finalResult,
      qlc: 1,
      totalQLC: 1,
      roundUp: 1,
    };
    const audit = buildBulkCostFormulaAudit(line, makeCosts(), overridden, { allocationLine });

    expect(audit.status).toBe('fail');
    expect(audit.rows.find((row) => row.stepKey === 'qlc')?.status).toBe('fail');
    expect(audit.rows.find((row) => row.stepKey === 'total-qlc')?.status).toBe('fail');
    expect(audit.rows.find((row) => row.stepKey === 'sales-price')?.status).toBe('fail');
  });
});
