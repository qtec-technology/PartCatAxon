// ─────────────────────────────────────────────────────────────────────────────
// Bulk Cost Allocation – Comprehensive Unit Tests
// ─────────────────────────────────────────────────────────────────────────────
// Tests cover:
//   1. Allocation ratios (weight + value based)
//   2. Residual rounding (last-line correction)
//   3. Final result pipeline (OP1 → Round Up)
//   4. Edge cases (zero weight, zero qty, single line)
//   5. Warning generation
//   6. Golden test cases (realistic scenarios)
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { calculateAllocationPreview } from '@/features/bulk-cost/bulk-cost.calc';
import type { AllocationLineSource, BulkCostInput } from '@/features/bulk-cost/bulk-cost.types';

// ─── Test Helpers ───────────────────────────────────────────────────────────

function makeLine(overrides: Partial<AllocationLineSource> = {}): AllocationLineSource {
  return {
    lineKey: 'LINE-001',
    no: 1,
    itemGroup: '104',
    itemCategory: 'Electrical',
    sapDescription: 'Test Item',
    manufacturer: 'Test MFG',
    mfgPartNumber: 'MPN-001',
    supplierOrderCode: 'SOC-001',
    ggCode: 'GG-001',
    itemCode: 'TEST-ITEM',
    vendorCode: 'V-TEST',
    vendorName: 'Test Vendor',
    qty: 100,
    uom: 'PCS',
    unitPrice: 1.00,
    amount: 100.00,
    currency: 'USD',
    countryOfOrigin: 'US',
    hsCode: '',
    docFee: { coc: 0, millCert: 0, testCert: 0, coa: 0, coo: 0, anyOther: 0 },
    deliveryLeadTime: '',
    orderTerm: 'FCA',
    location: 'TH',
    importPermit: '',
    shelfLifeRequire: '',
    itemWeightPerEach: 0.5,
    dimensionWeightPerEach: null,
    shippingWeightPerEach: null,
    totalShippingWeight: null,
    importDutyPercent: 5,
    termId: null,
    purchaseUOM: 'PCS',
    stockUOM: 'EA',
    saleUOM: 'EA',
    stockConversion: 1,
    saleConversion: 1,
    moq: 100,
    insPercent: 0.5,
    shipModeNo: 1,
    freightRate: 120,
    dimUnit: 1,
    length: 10,
    width: 10,
    height: 10,
    zoneRate: 0,
    etPercent: 0,
    miscTax: 0,
    scc: 0,
    stkPercent: 0,
    markupPercent: 15,
    sspk: 0,
    qoc: 0,
    ...overrides,
  };
}

function makeCosts(overrides: Partial<BulkCostInput> = {}): BulkCostInput {
  return {
    pkh: 500,
    soc: 300,
    freight: 2000,
    customs: 800,
    wireTT: 150,
    currency: 'USD',
    exchangeRate: 34.50,
    orderTerm: 'FCA',
    location: 'TH',
    shipModeNo: 1,
    contactPerson: '',
    saleIncharge: '',
    referenceNo: '',
    remark: '',
    ...overrides,
  };
}

// ─── 1. Basic Allocation ─────────────────────────────────────────────────────

describe('Basic Allocation', () => {
  it('should allocate 100% to single line', () => {
    const lines = [makeLine()];
    const costs = makeCosts();
    const result = calculateAllocationPreview(lines, costs);

    expect(result.lines).toHaveLength(1);
    const line = result.lines[0];

    // Single line = 100% of everything
    expect(line.pkhPerItem).toBeCloseTo(500, 4);
    expect(line.socPerItem).toBeCloseTo(300, 4);
    expect(line.freightPerItem).toBeCloseTo(2000, 4);
    expect(line.ccPerItem).toBeCloseTo(800, 4);
    expect(line.wireTTPerItem).toBeCloseTo(150, 4);
  });

  it('should split equally between two identical lines', () => {
    const lines = [
      makeLine({ lineKey: 'A', qty: 100, amount: 100, itemWeightPerEach: 0.5 }),
      makeLine({ lineKey: 'B', qty: 100, amount: 100, itemWeightPerEach: 0.5 }),
    ];
    const costs = makeCosts({ pkh: 1000, soc: 0, freight: 0, customs: 0, wireTT: 200 });
    const result = calculateAllocationPreview(lines, costs);

    expect(result.lines).toHaveLength(2);
    // Weight-based: 50/50
    expect(result.lines[0].pkhPerItem).toBeCloseTo(500, 4);
    expect(result.lines[1].pkhPerItem).toBeCloseTo(500, 4);
    // Value-based: 50/50
    expect(result.lines[0].wireTTPerItem).toBeCloseTo(100, 4);
    expect(result.lines[1].wireTTPerItem).toBeCloseTo(100, 4);
  });

  it('should allocate by weight ratio (not equal)', () => {
    const lines = [
      makeLine({ lineKey: 'HEAVY', qty: 10, amount: 50, itemWeightPerEach: 2.0 }),
      makeLine({ lineKey: 'LIGHT', qty: 10, amount: 50, itemWeightPerEach: 0.5 }),
    ];
    const costs = makeCosts({ pkh: 1000, soc: 0, freight: 0, customs: 0, wireTT: 0 });
    const result = calculateAllocationPreview(lines, costs);

    // Total weight: HEAVY=20, LIGHT=5, total=25
    // HEAVY ratio = 20/25 = 0.8, LIGHT ratio = 5/25 = 0.2
    expect(result.lines[0].pkhPerItem).toBeCloseTo(800, 4);
    expect(result.lines[1].pkhPerItem).toBeCloseTo(200, 4);
  });

  it('should compute per-each ratios as item ratio divided by qty', () => {
    const lines = [
      makeLine({ lineKey: 'A', qty: 2, amount: 20, unitPrice: 10, itemWeightPerEach: 5 }),
      makeLine({ lineKey: 'B', qty: 4, amount: 40, unitPrice: 10, itemWeightPerEach: 2.5 }),
    ];
    const result = calculateAllocationPreview(lines, makeCosts());

    // Excel source formulas:
    // AH = AG / Qty, AJ = AI / Qty
    expect(result.lines[0].weightRatioPerEach).toBeCloseTo(result.lines[0].weightRatioPerItem / 2, 5);
    expect(result.lines[1].weightRatioPerEach).toBeCloseTo(result.lines[1].weightRatioPerItem / 4, 5);
    expect(result.lines[0].valueRatioPerEach).toBeCloseTo(result.lines[0].valueRatioPerItem / 2, 5);
    expect(result.lines[1].valueRatioPerEach).toBeCloseTo(result.lines[1].valueRatioPerItem / 4, 5);
  });

  it('should allocate TT by value ratio', () => {
    const lines = [
      makeLine({ lineKey: 'EXPENSIVE', qty: 10, amount: 900, unitPrice: 90 }),
      makeLine({ lineKey: 'CHEAP', qty: 10, amount: 100, unitPrice: 10 }),
    ];
    const costs = makeCosts({ pkh: 0, soc: 0, freight: 0, customs: 0, wireTT: 1000 });
    const result = calculateAllocationPreview(lines, costs);

    // Value ratio: 900/1000 = 0.9, 100/1000 = 0.1
    expect(result.lines[0].wireTTPerItem).toBeCloseTo(900, 4);
    expect(result.lines[1].wireTTPerItem).toBeCloseTo(100, 4);
  });
});

// ─── 2. Residual Rounding ────────────────────────────────────────────────────

describe('Residual Rounding', () => {
  it('should have zero residual for clean splits', () => {
    const lines = [
      makeLine({ lineKey: 'A', qty: 50, amount: 50, itemWeightPerEach: 1 }),
      makeLine({ lineKey: 'B', qty: 50, amount: 50, itemWeightPerEach: 1 }),
    ];
    const costs = makeCosts({ pkh: 1000 });
    const result = calculateAllocationPreview(lines, costs);

    expect(Math.abs(result.roundingResidual.pkh)).toBeLessThan(0.001);
  });

  it('should have zero residual even for 3-way split', () => {
    const lines = [
      makeLine({ lineKey: 'A', qty: 33, amount: 33, itemWeightPerEach: 1 }),
      makeLine({ lineKey: 'B', qty: 33, amount: 33, itemWeightPerEach: 1 }),
      makeLine({ lineKey: 'C', qty: 34, amount: 34, itemWeightPerEach: 1 }),
    ];
    const costs = makeCosts({ pkh: 100, soc: 100, freight: 100, customs: 100, wireTT: 100 });
    const result = calculateAllocationPreview(lines, costs);

    // Last-line correction should ensure totals match exactly
    const totalPKH = result.lines.reduce((s, l) => s + l.pkhPerItem, 0);
    expect(totalPKH).toBeCloseTo(100, 4);
    const totalTT = result.lines.reduce((s, l) => s + l.wireTTPerItem, 0);
    expect(totalTT).toBeCloseTo(100, 4);
  });

  it('should sum allocated costs to input costs', () => {
    const lines = [
      makeLine({ lineKey: 'X', qty: 7, amount: 77.77, itemWeightPerEach: 0.33 }),
      makeLine({ lineKey: 'Y', qty: 13, amount: 123.45, itemWeightPerEach: 0.67 }),
      makeLine({ lineKey: 'Z', qty: 3, amount: 45.00, itemWeightPerEach: 1.50 }),
    ];
    const costs = makeCosts({ pkh: 999.99, soc: 333.33, freight: 1234.56, customs: 567.89, wireTT: 89.01 });
    const result = calculateAllocationPreview(lines, costs);

    const sumPKH = result.lines.reduce((s, l) => s + l.pkhPerItem, 0);
    const sumSOC = result.lines.reduce((s, l) => s + l.socPerItem, 0);
    const sumFR = result.lines.reduce((s, l) => s + l.freightPerItem, 0);
    const sumCC = result.lines.reduce((s, l) => s + l.ccPerItem, 0);
    const sumTT = result.lines.reduce((s, l) => s + l.wireTTPerItem, 0);

    expect(sumPKH).toBeCloseTo(999.99, 2);
    expect(sumSOC).toBeCloseTo(333.33, 2);
    expect(sumFR).toBeCloseTo(1234.56, 2);
    expect(sumCC).toBeCloseTo(567.89, 2);
    expect(sumTT).toBeCloseTo(89.01, 2);
  });
});

// ─── 3. Final Result Pipeline ────────────────────────────────────────────────

describe('Final Result (OP1 → Round Up)', () => {
  it('should compute OP1 = (PCS + PKH + SOC + document fees) * exchangeRate', () => {
    const lines = [makeLine({
      unitPrice: 10.00,
      docFee: { coc: 1, millCert: 2, testCert: 3, coa: 0, coo: 4, anyOther: 5 },
    })];
    const costs = makeCosts({ pkh: 200, soc: 100, exchangeRate: 35 });
    const result = calculateAllocationPreview(lines, costs);
    const fr = result.lines[0].finalResult;

    // PKH/each = 200/100 = 2, SOC/each = 100/100 = 1
    // OP1 = (10 + 2 + 1 + 1 + 2 + 3 + 4 + 5) * 35 = 980
    expect(fr.op1Source).toBeCloseTo(28, 2);
    expect(fr.op1).toBeCloseTo(980, 2);
  });

  it('should apply exwork case 1.03 for FCA + Truck (mode 3)', () => {
    const lines = [makeLine({ unitPrice: 10 })];
    const costs = makeCosts({ pkh: 0, soc: 0, exchangeRate: 10, orderTerm: 'FCA', shipModeNo: 3 });
    const result = calculateAllocationPreview(lines, costs);
    const fr = result.lines[0].finalResult;

    // OP1 = 10 * 10 = 100
    // OP2 = 100 * 1.03 = 103
    expect(fr.exworkCase).toBe(1.03);
    expect(fr.op2).toBeCloseTo(103, 2);
  });

  it('should apply exwork case 1.03 for hyphenated Ex-work + Truck (mode 3)', () => {
    const lines = [makeLine({ unitPrice: 10 })];
    const costs = makeCosts({ pkh: 0, soc: 0, exchangeRate: 10, orderTerm: 'Ex-work', shipModeNo: 3 });
    const result = calculateAllocationPreview(lines, costs);
    const fr = result.lines[0].finalResult;

    expect(fr.exworkCase).toBe(1.03);
    expect(fr.op2).toBeCloseTo(103, 2);
  });

  it('should apply exwork case 1.0 for CIF order term', () => {
    const lines = [makeLine()];
    const costs = makeCosts({ orderTerm: 'CIF', shipModeNo: 1 });
    const result = calculateAllocationPreview(lines, costs);
    const fr = result.lines[0].finalResult;

    expect(fr.exworkCase).toBe(1);
  });

  it('should compute markup and round up correctly', () => {
    const lines = [makeLine({ markupPercent: 20, unitPrice: 10, stockConversion: 1, saleConversion: 1, sspk: 0, qoc: 0 })];
    const costs = makeCosts({ pkh: 0, soc: 0, freight: 0, customs: 0, wireTT: 0, exchangeRate: 1 });
    const result = calculateAllocationPreview(lines, costs);
    const fr = result.lines[0].finalResult;

    // totalQLC / (1 - 0.20) = totalQLC / 0.80
    if (fr.totalQLC > 0) {
      const expected = fr.totalQLC / 0.80;
      expect(fr.roundUp).toBeCloseTo(expected, 2);
      expect(fr.markup).toBeCloseTo(expected - fr.totalQLC, 2);
    }
  });

  it('treats SPK as a THB amount added after QLC conversion, not a percentage', () => {
    const lines = [makeLine({
      unitPrice: 123,
      qty: 1,
      stockConversion: 1,
      saleConversion: 1,
      sspk: 5,
      qoc: 2,
      markupPercent: 0,
      insPercent: 0,
      importDutyPercent: 0,
    })];
    const costs = makeCosts({ pkh: 0, soc: 0, freight: 0, customs: 0, wireTT: 0, exchangeRate: 1 });
    const result = calculateAllocationPreview(lines, costs);
    const fr = result.lines[0].finalResult;

    expect(fr.totalQLC).toBeCloseTo(fr.qlc + 5 + 2, 4);
    expect(fr.totalQLC).not.toBeCloseTo(fr.qlc * 1.05 + 2, 4);
  });

  it('should pass through doc fees from source line', () => {
    const lines = [makeLine({
      docFee: { coc: 1.50, millCert: 2.00, testCert: 0.75, coa: 0, coo: 0, anyOther: 3.00 },
    })];
    const costs = makeCosts();
    const result = calculateAllocationPreview(lines, costs);
    const fr = result.lines[0].finalResult;

    expect(fr.docCOC).toBe(1.50);
    expect(fr.docMill).toBe(2.00);
    expect(fr.docTestCert).toBe(0.75);
    expect(fr.docCOO).toBe(0);
    expect(fr.docAnyOther).toBe(3.00);
  });

  it('should include doc fees in OP1 per Excel sample final result', () => {
    const lines = [makeLine({
      unitPrice: 10,
      docFee: { coc: 1.50, millCert: 2.00, testCert: 0.75, coa: 0.25, coo: 0.50, anyOther: 3.00 },
    })];
    const costs = makeCosts({ pkh: 0, soc: 0, freight: 0, customs: 0, wireTT: 0, exchangeRate: 1 });
    const result = calculateAllocationPreview(lines, costs);
    const fr = result.lines[0].finalResult;

    expect(fr.docCOO).toBe(0.75);
    expect(fr.op1).toBe(18);
  });
});

// ─── 4. Edge Cases ───────────────────────────────────────────────────────────

describe('Edge Cases', () => {
  it('should handle empty lines array', () => {
    const result = calculateAllocationPreview([], makeCosts());

    expect(result.lines).toHaveLength(0);
    expect(result.totalLines).toBe(0);
    expect(result.runWarnings.some((w) => w.code === 'ZERO_QTY')).toBe(true);
  });

  it('should handle line with zero weight', () => {
    const lines = [makeLine({
      itemWeightPerEach: 0,
      dimensionWeightPerEach: null,
      shippingWeightPerEach: null,
    })];
    const costs = makeCosts({ pkh: 1000 });
    const result = calculateAllocationPreview(lines, costs);

    // Still gets 100% via last-line residual correction
    expect(result.lines[0].pkhPerItem).toBeCloseTo(1000, 4);
    expect(result.lines[0].warnings.some((w) => w.code === 'MISSING_WEIGHT')).toBe(true);
  });

  it('should handle all zero costs', () => {
    const lines = [makeLine()];
    const costs = makeCosts({ pkh: 0, soc: 0, freight: 0, customs: 0, wireTT: 0 });
    const result = calculateAllocationPreview(lines, costs);

    expect(result.lines[0].pkhPerItem).toBe(0);
    expect(result.lines[0].pkhPerEach).toBe(0);
    expect(result.lines[0].status).toBe('ready');
  });

  it('should warn on negative costs', () => {
    const lines = [makeLine()];
    const costs = makeCosts({ pkh: -100 });
    const result = calculateAllocationPreview(lines, costs);

    expect(result.runWarnings.some((w) => w.code === 'NEGATIVE_COST')).toBe(true);
  });

  it('should handle line with zero qty', () => {
    const lines = [makeLine({ qty: 0, amount: 0 })];
    const costs = makeCosts();
    const result = calculateAllocationPreview(lines, costs);

    expect(result.lines[0].warnings.some((w) => w.code === 'ZERO_QTY')).toBe(true);
    expect(result.lines[0].status).toBe('error');
  });

  it('should prefer shippingWeight > dimensionWeight > itemWeight', () => {
    const lines = [makeLine({
      shippingWeightPerEach: 5.0,
      dimensionWeightPerEach: 3.0,
      itemWeightPerEach: 1.0,
    })];
    const costs = makeCosts();
    const result = calculateAllocationPreview(lines, costs);

    // shippingWeight takes priority → total weight should be 5.0 * 100 = 500
    expect(result.totalWeight).toBeCloseTo(500, 4);
  });

  it('should fall back to dimensionWeight when shippingWeight is null', () => {
    const lines = [makeLine({
      shippingWeightPerEach: null,
      dimensionWeightPerEach: 3.0,
      itemWeightPerEach: 1.0,
    })];
    const costs = makeCosts();
    const result = calculateAllocationPreview(lines, costs);

    expect(result.totalWeight).toBeCloseTo(300, 4);
  });
});

// ─── 5. Warnings ─────────────────────────────────────────────────────────────

describe('Warnings', () => {
  it('should warn on mixed vendors', () => {
    const lines = [
      makeLine({ lineKey: 'A', vendorCode: 'V-001' }),
      makeLine({ lineKey: 'B', vendorCode: 'V-002' }),
    ];
    const result = calculateAllocationPreview(lines, makeCosts());

    expect(result.runWarnings.some((w) => w.code === 'MIXED_VENDOR')).toBe(true);
  });

  it('should not warn when all same vendor', () => {
    const lines = [
      makeLine({ lineKey: 'A', vendorCode: 'V-001' }),
      makeLine({ lineKey: 'B', vendorCode: 'V-001' }),
    ];
    const result = calculateAllocationPreview(lines, makeCosts());

    expect(result.runWarnings.some((w) => w.code === 'MIXED_VENDOR')).toBe(false);
  });

  it('should warn on mixed currencies separately from mixed vendors', () => {
    const lines = [
      makeLine({ lineKey: 'A', vendorCode: 'V-001', currency: 'USD' }),
      makeLine({ lineKey: 'B', vendorCode: 'V-001', currency: 'EUR' }),
    ];
    const result = calculateAllocationPreview(lines, makeCosts());

    expect(result.runWarnings.some((w) => w.code === 'MIXED_VENDOR')).toBe(false);
    expect(result.runWarnings.some((w) => w.code === 'MIXED_CURRENCY')).toBe(true);
  });
});

// ─── 6. Golden Test Cases ────────────────────────────────────────────────────
// Realistic scenarios matching expected business outcomes.

describe('Golden Test Cases', () => {
  it('Golden 1: Standard FCA Air — 2 items, weight-based allocation', () => {
    const lines = [
      makeLine({
        lineKey: 'G1-A',
        itemCode: 'CAP-100UF',
        unitPrice: 0.85,
        qty: 1000,
        amount: 850,
        itemWeightPerEach: 0.002,
        orderTerm: 'FCA',
        shipModeNo: 1,
      }),
      makeLine({
        lineKey: 'G1-B',
        itemCode: 'RES-10K',
        unitPrice: 0.10,
        qty: 5000,
        amount: 500,
        itemWeightPerEach: 0.001,
        orderTerm: 'FCA',
        shipModeNo: 1,
      }),
    ];
    const costs = makeCosts({
      pkh: 200,
      soc: 100,
      freight: 1500,
      customs: 600,
      wireTT: 50,
      exchangeRate: 34.50,
    });

    const result = calculateAllocationPreview(lines, costs);

    // Total weight: A=0.002*1000=2, B=0.001*5000=5, total=7
    // Weight ratio: A=2/7≈0.2857, B=5/7≈0.7143
    expect(result.totalWeight).toBeCloseTo(7, 4);
    expect(result.lines[0].weightRatioPerItem).toBeCloseTo(2 / 7, 4);
    expect(result.lines[1].weightRatioPerItem).toBeCloseTo(5 / 7, 4);

    // PKH allocation: A≈57.14, B≈142.86
    expect(result.lines[0].pkhPerItem + result.lines[1].pkhPerItem).toBeCloseTo(200, 4);

    // TT by value: A=850/1350≈0.6296, B=500/1350≈0.3704
    expect(result.lines[0].valueRatioPerItem).toBeCloseTo(850 / 1350, 3);

    // Final result should have all fields populated
    expect(result.lines[0].finalResult.op1).toBeGreaterThan(0);
    expect(result.lines[0].finalResult.roundUp).toBeGreaterThan(0);
    expect(result.lines[0].status).toBe('ready');
    expect(result.runWarnings.filter((w) => w.severity === 'error')).toHaveLength(0);
  });

  it('Golden 2: Single line — all costs go to one item', () => {
    const lines = [
      makeLine({
        lineKey: 'G2-SINGLE',
        itemCode: 'MOTOR-500W',
        unitPrice: 125.00,
        qty: 20,
        amount: 2500,
        itemWeightPerEach: 3.5,
        orderTerm: 'Exwork',
        shipModeNo: 2,
        markupPercent: 18,
        importDutyPercent: 8,
        insPercent: 1.0,
      }),
    ];
    const costs = makeCosts({
      pkh: 800,
      soc: 400,
      freight: 5000,
      customs: 1200,
      wireTT: 300,
      exchangeRate: 34.50,
    });

    const result = calculateAllocationPreview(lines, costs);

    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].pkhPerItem).toBe(800);
    expect(result.lines[0].pkhPerEach).toBeCloseTo(40, 4);   // 800/20
    expect(result.lines[0].socPerEach).toBeCloseTo(20, 4);    // 400/20
    expect(result.lines[0].freightPerEach).toBeCloseTo(250, 4); // 5000/20
    expect(result.lines[0].ccPerEach).toBeCloseTo(60, 4);     // 1200/20
    expect(result.lines[0].wireTTPerEach).toBeCloseTo(15, 4); // 300/20

    const fr = result.lines[0].finalResult;
    // OP1 = (125 + 40 + 20) * 34.50 = 185 * 34.50 = 6382.50
    expect(fr.op1).toBeCloseTo(6382.50, 2);
    expect(fr.roundUp).toBeGreaterThan(fr.totalQLC);
    expect(fr.markup).toBeGreaterThan(0);
  });

  it('Golden 3: Excel sample allocation ratios match AXON extraction formulas', () => {
    const qty = [1, 2, 1, 5, 5, 1, 10, 1, 1, 1, 1, 1, 1, 1, 2, 1, 1, 5, 2, 2];
    const price = [
      1545.00, 1011.21, 710.00, 65.73, 6.87,
      20.68, 208.87, 9.02, 7.30, 15.60,
      18.22, 28.79, 961.00, 230.00, 1230.00,
      15.38, 15.87, 12.74, 20.96, 16.74,
    ];
    const shippingWeight = [
      52.21, 18.387, 13.205725, 0.448325, 0.051075,
      0.53345, 1.628725, 0.0681, 0.062425, 0.141875,
      0.153225, 0.46535, 1.2, 2.5, 33.31225,
      0.03405, 0.073775, 0.130525, 0.221325, 0.255375,
    ];

    const lines = qty.map((lineQty, index) => makeLine({
      lineKey: `EXCEL-${index + 1}`,
      no: index + 1,
      qty: lineQty,
      unitPrice: price[index],
      amount: lineQty * price[index],
      currency: 'USD',
      orderTerm: 'Ex-work',
      shippingWeightPerEach: shippingWeight[index],
      itemWeightPerEach: null,
      dimensionWeightPerEach: null,
      importDutyPercent: index === 12 ? 0 : 10,
    }));
    const costs = makeCosts({
      pkh: 75,
      soc: 125,
      freight: 40000,
      customs: 8000,
      wireTT: 1500,
      currency: 'USD',
      exchangeRate: 33,
    });

    const result = calculateAllocationPreview(lines, costs);

    expect(result.totalQty).toBe(45);
    expect(result.totalWeight).toBeCloseTo(194.43675, 6);
    expect(result.totalAmount).toBeCloseTo(10650.08, 2);

    const firstLine = result.lines[0];
    expect(firstLine.weightRatioPerItem).toBeCloseTo(52.21 / 194.43675, 6);
    expect(firstLine.weightRatioPerEach).toBeCloseTo(firstLine.weightRatioPerItem / 1, 6);
    expect(firstLine.valueRatioPerItem).toBeCloseTo(1545 / 10650.08, 6);
    expect(firstLine.valueRatioPerEach).toBeCloseTo(firstLine.valueRatioPerItem / 1, 6);

    expect(firstLine.pkhPerEach).toBeCloseTo(20.13894, 6);
    expect(firstLine.freightPerEach).toBeCloseTo(10740.768, 3);
    expect(firstLine.wireTTPerEach).toBeCloseTo(217.604, 3);
    expect(firstLine.ccPerEach).toBeCloseTo(2148.154, 3);
    expect(firstLine.finalResult.frQTEC).toBeCloseTo(firstLine.freightPerEach, 3);
    expect(firstLine.finalResult.shipWeightCal).toBeCloseTo(52.21, 2);

    expect(result.lines.reduce((sum, line) => sum + line.pkhPerItem, 0)).toBeCloseTo(75, 6);
    expect(result.lines.reduce((sum, line) => sum + line.socPerItem, 0)).toBeCloseTo(125, 6);
    expect(result.lines.reduce((sum, line) => sum + line.freightPerItem, 0)).toBeCloseTo(40000, 6);
    expect(result.lines.reduce((sum, line) => sum + line.ccPerItem, 0)).toBeCloseTo(8000, 6);
    expect(result.lines.reduce((sum, line) => sum + line.wireTTPerItem, 0)).toBeCloseTo(1500, 6);
  });
});

// ─── 7. ET / MT / MiscTax / SCC / STK ───────────────────────────────────────
// These fields match the Term engine. All values are synthetic (non-zero) to
// verify that the Bulk Cost engine routes them into QLC correctly.

describe('ET / MT / MiscTax / SCC / STK', () => {
  it('ET=0 produces mt=0 and does not affect QLC vs baseline', () => {
    const lines = [makeLine({ unitPrice: 100, qty: 1, etPercent: 0, miscTax: 0, scc: 0, stkPercent: 0, insPercent: 0, importDutyPercent: 0 })];
    const result = calculateAllocationPreview(lines, makeCosts({ pkh: 0, soc: 0, freight: 0, customs: 0, wireTT: 0, exchangeRate: 1 }));
    const fr = result.lines[0].finalResult;
    expect(fr.et).toBe(0);
    expect(fr.mt).toBe(0);
    expect(fr.stk).toBe(0);
    // QLC = CEILING(OP1 + 0, 0.01) = 100
    expect(fr.qlc).toBeCloseTo(100, 2);
  });

  it('MiscTax adds to preQLC', () => {
    const lines = [makeLine({ unitPrice: 100, qty: 1, miscTax: 50, etPercent: 0, scc: 0, stkPercent: 0, insPercent: 0, importDutyPercent: 0 })];
    const costs = makeCosts({ pkh: 0, soc: 0, freight: 0, customs: 0, wireTT: 0, exchangeRate: 1 });
    const result = calculateAllocationPreview(lines, costs);
    const fr = result.lines[0].finalResult;
    // preQLC = OP1(100) + miscTax(50) = 150
    expect(fr.preQLC).toBeCloseTo(150, 4);
    expect(fr.qlc).toBeCloseTo(150, 2);
    expect(fr.miscTaxVal).toBe(50);
  });

  it('SCC adds to preQLC', () => {
    const lines = [makeLine({ unitPrice: 100, qty: 1, scc: 200, etPercent: 0, miscTax: 0, stkPercent: 0, insPercent: 0, importDutyPercent: 0 })];
    const costs = makeCosts({ pkh: 0, soc: 0, freight: 0, customs: 0, wireTT: 0, exchangeRate: 1 });
    const result = calculateAllocationPreview(lines, costs);
    const fr = result.lines[0].finalResult;
    // preQLC = OP1(100) + SCC(200) = 300
    expect(fr.preQLC).toBeCloseTo(300, 4);
    expect(fr.qlc).toBeCloseTo(300, 2);
    expect(fr.scc).toBe(200);
  });

  it('STK% applies to preQLC and increases QLC', () => {
    // preQLC=1000, STK 10% => stk=100, QLC=1100
    const lines = [makeLine({ unitPrice: 1000, qty: 1, stkPercent: 10, etPercent: 0, miscTax: 0, scc: 0, insPercent: 0, importDutyPercent: 0 })];
    const costs = makeCosts({ pkh: 0, soc: 0, freight: 0, customs: 0, wireTT: 0, exchangeRate: 1 });
    const result = calculateAllocationPreview(lines, costs);
    const fr = result.lines[0].finalResult;
    expect(fr.preQLC).toBeCloseTo(1000, 4);
    expect(fr.stk).toBeCloseTo(100, 4);
    expect(fr.qlc).toBeCloseTo(1100, 2);
  });

  it('ET reverse formula with non-zero etPercent', () => {
    // DDP, mode 1, unitPrice=100, exRate=1, duty=10%, ET=10%, no INS/FR/MiscTax
    // OP1=100, CIF=100+0+0=100, DT=10
    // ET = (100+10+0)*0.10 / (1-1.1*0.10) = 11/0.89 ≈ 12.359551
    // MT = ET*0.10
    const lines = [makeLine({
      unitPrice: 100, qty: 1,
      etPercent: 10, importDutyPercent: 10,
      miscTax: 0, scc: 0, stkPercent: 0,
      insPercent: 0, shipModeNo: 1,
    })];
    const costs = makeCosts({
      pkh: 0, soc: 0, freight: 0, customs: 0, wireTT: 0,
      exchangeRate: 1, orderTerm: 'DDP', shipModeNo: 1,
    });
    const result = calculateAllocationPreview(lines, costs);
    const fr = result.lines[0].finalResult;

    const expectedET = (100 + 10 + 0) * 0.10 / (1 - 1.1 * 10 / 100);
    const expectedMT = expectedET * 0.10;
    expect(fr.et).toBeCloseTo(expectedET, 4);
    expect(fr.mt).toBeCloseTo(expectedMT, 4);
    // preQLC = 100 + 10 + ET + MT
    expect(fr.preQLC).toBeCloseTo(100 + 10 + expectedET + expectedMT, 4);
  });

  it('ET denominator guard: etPercent ≥ ~91 returns ET=0', () => {
    // denominator = 1 - 1.1*95/100 = 1-1.045 = -0.045 ≤ 0 → ET=0
    const lines = [makeLine({ unitPrice: 100, qty: 1, etPercent: 95, importDutyPercent: 0, miscTax: 0, scc: 0, stkPercent: 0 })];
    const costs = makeCosts({ pkh: 0, soc: 0, freight: 0, customs: 0, wireTT: 0, exchangeRate: 1, orderTerm: 'DDP', shipModeNo: 1 });
    const result = calculateAllocationPreview(lines, costs);
    const fr = result.lines[0].finalResult;
    expect(fr.et).toBe(0);
    expect(fr.mt).toBe(0);
  });

  it('combined: MiscTax + SCC + STK all together', () => {
    // OP1=100, miscTax=20, scc=30, stkPercent=5, no duty/ET/FR
    // preQLC = 100+20+30 = 150, stk = 150*5% = 7.5, qlc = ceil(157.5, 0.01) = 157.5
    const lines = [makeLine({
      unitPrice: 100, qty: 1,
      miscTax: 20, scc: 30, stkPercent: 5,
      etPercent: 0, importDutyPercent: 0, insPercent: 0,
    })];
    const costs = makeCosts({ pkh: 0, soc: 0, freight: 0, customs: 0, wireTT: 0, exchangeRate: 1, orderTerm: 'DDP', shipModeNo: 1 });
    const result = calculateAllocationPreview(lines, costs);
    const fr = result.lines[0].finalResult;
    expect(fr.miscTaxVal).toBe(20);
    expect(fr.scc).toBe(30);
    expect(fr.preQLC).toBeCloseTo(150, 4);
    expect(fr.stk).toBeCloseTo(7.5, 4);
    expect(fr.qlc).toBeCloseTo(157.5, 2);
  });
});
