/**
 * Excel-based test fixture — Example_Cal_Cost.xlsx (20 Grainger items).
 *
 * IMPORTANT:
 * - `orderTerm` must be `'Exwork'` (no hyphen) to match calculation.service.ts
 * - All EXCEL_EXPECTED values are PER-LINE totals (not per-each).
 *   For multi-qty items, per-each = value / qty.
 * - Tolerance for comparison: ±2.00 THB (due to weight precision differences)
 */

// ─── Global bulk cost input ─────────────────────────────────────────────────
export const EXCEL_COSTS = {
  pkh: 75,        // USD (weight-allocated)
  soc: 125,       // USD (weight-allocated)
  freight: 40000, // THB (weight-allocated)
  customs: 8000,  // THB (weight-allocated)
  wireTT: 1500,   // THB (value-allocated)
  currency: 'USD',
  exchangeRate: 33.30,
  referenceNo: 'EXCEL-TEST-001',
  remark: 'Playwright E2E test from Example_Cal_Cost.xlsx',
  orderTerm: 'Exwork',  // Must match calculation service (no hyphen)
  location: 'US',
  subLocation: '',
  shipModeNo: 6,  // Air Courier
  contactPerson: 'Test',
  saleIncharge: 'Test',
};

// ─── Shared defaults for each line ──────────────────────────────────────────
const LINE_DEFAULTS = {
  itemGroup: '104',
  itemCategory: '',
  customerStockCode: '',
  countryOfOrigin: 'US',
  hsCode: '',
  docFee: { coc: 0, millCert: 0, testCert: 0, coa: 0, coo: 0, anyOther: 0 },
  deliveryLeadTime: '6 Weeks',
  orderTerm: 'Exwork',
  location: 'US',
  subLocation: '',
  importPermit: 'No',
  permitType: '',
  shelfLifeRequire: 'No',
  vendorCode: 'V-GRA-001',
  vendorName: 'Grainger',
  termId: null,
  itemCode: '',
  purchaseUOM: 'EA',
  stockUOM: 'EA',
  saleUOM: 'EA',
  stockConversion: 1,
  saleConversion: 1,
  dimUnit: 1,
  length: 0,
  width: 0,
  height: 0,
  etPercent: 0,
  miscTax: 0,
  scc: 0,
  stkPercent: 0,
  spkPercent: 0,
  qocRate: 0,
  shipModeNo: 6,
  zoneRate: 720,
  freightRate: 0,
  insPercent: 1,
  markupPercent: 10,
  importDutyPercent: 10,
} as const;

function line(
  overrides: {
    no: number; lineKey: string;
    sapDescription: string; manufacturer: string; mfgPartNumber: string;
    supplierOrderCode: string; ggCode: string;
    qty: number; unitPrice: number; amount: number;
    shippingWeightPerEach: number; itemWeightPerEach: number;
    totalShippingWeight: number;
    moq: string;
    importDutyPercent?: number;
  },
) {
  return {
    ...LINE_DEFAULTS,
    ...overrides,
    uom: 'EA',
    currency: 'USD',
    dimensionWeightPerEach: null,
    importDutyPercent: overrides.importDutyPercent ?? LINE_DEFAULTS.importDutyPercent,
  };
}

// ─── 20 line items ──────────────────────────────────────────────────────────
export const EXCEL_LINES = [
  line({ no: 1, lineKey: 'EXCEL-001', sapDescription: 'PROTO Socket Set: 3/4 in Drive, 42 Piece', manufacturer: 'PROTO', mfgPartNumber: 'PN-AXON-001', supplierOrderCode: 'GG-01001', ggCode: 'GG-01001', qty: 1, unitPrice: 1545.00, amount: 1545.00, shippingWeightPerEach: 52.21, itemWeightPerEach: 52.21, totalShippingWeight: 52.21, moq: '1' }),
  line({ no: 2, lineKey: 'EXCEL-002', sapDescription: 'PROTO Socket Wrench Set: 1/2 in Drive, 65 Piece', manufacturer: 'PROTO', mfgPartNumber: 'PN-AXON-002', supplierOrderCode: 'GG-01002', ggCode: 'GG-01002', qty: 2, unitPrice: 1011.21, amount: 2022.42, shippingWeightPerEach: 18.387, itemWeightPerEach: 18.387, totalShippingWeight: 36.774, moq: '2' }),
  line({ no: 3, lineKey: 'EXCEL-003', sapDescription: 'PROTO Socket Bit Set: 3/8 in Drive, 58 Piece', manufacturer: 'PROTO', mfgPartNumber: 'PN-AXON-003', supplierOrderCode: 'GG-01003', ggCode: 'GG-01003', qty: 1, unitPrice: 710.00, amount: 710.00, shippingWeightPerEach: 13.205725, itemWeightPerEach: 13.205725, totalShippingWeight: 13.205725, moq: '1' }),
  line({ no: 4, lineKey: 'EXCEL-004', sapDescription: 'PROTO Hand Ratchet: Round, Reversible, 8 1/2 in Overall Lg', manufacturer: 'PROTO', mfgPartNumber: 'PN-AXON-004', supplierOrderCode: 'GG-01004', ggCode: 'GG-01004', qty: 5, unitPrice: 65.73, amount: 328.65, shippingWeightPerEach: 0.448325, itemWeightPerEach: 0.448325, totalShippingWeight: 2.241625, moq: '5' }),
  line({ no: 5, lineKey: 'EXCEL-005', sapDescription: 'PROTO Socket Extension: 3/8 in, 1 3/4 in Overall Lg', manufacturer: 'PROTO', mfgPartNumber: 'PN-AXON-005', supplierOrderCode: 'GG-01005', ggCode: 'GG-01005', qty: 5, unitPrice: 6.87, amount: 34.35, shippingWeightPerEach: 0.051075, itemWeightPerEach: 0.051075, totalShippingWeight: 0.255375, moq: '5' }),
  line({ no: 6, lineKey: 'EXCEL-006', sapDescription: 'PROTO Socket Extension: 3/8 in, 17 3/16 in Overall Lg', manufacturer: 'PROTO', mfgPartNumber: 'PN-AXON-006', supplierOrderCode: 'GG-01006', ggCode: 'GG-01006', qty: 1, unitPrice: 20.68, amount: 20.68, shippingWeightPerEach: 0.53345, itemWeightPerEach: 0.53345, totalShippingWeight: 0.53345, moq: '1' }),
  line({ no: 7, lineKey: 'EXCEL-007', sapDescription: 'PROTO Socket Set: 1/4 in Drive, 25 Piece', manufacturer: 'PROTO', mfgPartNumber: 'PN-AXON-007', supplierOrderCode: 'GG-01007', ggCode: 'GG-01007', qty: 10, unitPrice: 208.87, amount: 2088.70, shippingWeightPerEach: 1.628725, itemWeightPerEach: 1.628725, totalShippingWeight: 16.28725, moq: '10' }),
  line({ no: 8, lineKey: 'EXCEL-008', sapDescription: 'PROTO Socket Adapter: 3/8 in Output, 1 3/8 in Overall Lg', manufacturer: 'PROTO', mfgPartNumber: 'PN-AXON-008', supplierOrderCode: 'GG-01008', ggCode: 'GG-01008', qty: 1, unitPrice: 9.02, amount: 9.02, shippingWeightPerEach: 0.0681, itemWeightPerEach: 0.0681, totalShippingWeight: 0.0681, moq: '1' }),
  line({ no: 9, lineKey: 'EXCEL-009', sapDescription: 'PROTO Socket Adapter: 1/2 in Output, 1 7/16 in Overall Lg', manufacturer: 'PROTO', mfgPartNumber: 'PN-AXON-009', supplierOrderCode: 'GG-01009', ggCode: 'GG-01009', qty: 1, unitPrice: 7.30, amount: 7.30, shippingWeightPerEach: 0.062425, itemWeightPerEach: 0.062425, totalShippingWeight: 0.062425, moq: '1' }),
  line({ no: 10, lineKey: 'EXCEL-010', sapDescription: 'PROTO Socket Adapter: 3/4 in Output, 1 11/16 in Overall Lg', manufacturer: 'PROTO', mfgPartNumber: 'PN-AXON-010', supplierOrderCode: 'GG-01010', ggCode: 'GG-01010', qty: 1, unitPrice: 15.60, amount: 15.60, shippingWeightPerEach: 0.141875, itemWeightPerEach: 0.141875, totalShippingWeight: 0.141875, moq: '1' }),
  line({ no: 11, lineKey: 'EXCEL-011', sapDescription: 'PROTO Socket Adapter: 1/2 in Output, 1 7/8 in Overall Lg', manufacturer: 'PROTO', mfgPartNumber: 'PN-AXON-011', supplierOrderCode: 'GG-01011', ggCode: 'GG-01011', qty: 1, unitPrice: 18.22, amount: 18.22, shippingWeightPerEach: 0.153225, itemWeightPerEach: 0.153225, totalShippingWeight: 0.153225, moq: '1' }),
  line({ no: 12, lineKey: 'EXCEL-012', sapDescription: 'PROTO Socket Adapter: 1 in Output, 2 1/2 in Overall Lg, Locking', manufacturer: 'PROTO', mfgPartNumber: 'PN-AXON-012', supplierOrderCode: 'GG-01012', ggCode: 'GG-01012', qty: 1, unitPrice: 28.79, amount: 28.79, shippingWeightPerEach: 0.46535, itemWeightPerEach: 0.46535, totalShippingWeight: 0.46535, moq: '1' }),
  // Line 13 — SPECIAL: 0% duty
  line({ no: 13, lineKey: 'EXCEL-013', sapDescription: 'INGERSOLL RAND Air-Powered Drill: 1/4 in Chuck', manufacturer: 'INGERSOLL RAND', mfgPartNumber: 'PN-AXON-013', supplierOrderCode: 'GG-01013', ggCode: 'GG-01013', qty: 1, unitPrice: 961.00, amount: 961.00, shippingWeightPerEach: 1.20, itemWeightPerEach: 1.20, totalShippingWeight: 1.20, moq: '1', importDutyPercent: 0 }),
  line({ no: 14, lineKey: 'EXCEL-014', sapDescription: 'SPEEDAIRE Air Hose: 1/4 in Hose Inside Dia', manufacturer: 'SPEEDAIRE', mfgPartNumber: 'PN-AXON-014', supplierOrderCode: 'GG-01014', ggCode: 'GG-01014', qty: 1, unitPrice: 230.00, amount: 230.00, shippingWeightPerEach: 2.50, itemWeightPerEach: 2.50, totalShippingWeight: 2.50, moq: '1' }),
  line({ no: 15, lineKey: 'EXCEL-015', sapDescription: 'PROTO Combination Wrench Set: 26 Tools', manufacturer: 'PROTO', mfgPartNumber: 'PN-AXON-015', supplierOrderCode: 'GG-01015', ggCode: 'GG-01015', qty: 2, unitPrice: 1230.00, amount: 2460.00, shippingWeightPerEach: 33.31225, itemWeightPerEach: 33.31225, totalShippingWeight: 66.6245, moq: '2' }),
  line({ no: 16, lineKey: 'EXCEL-016', sapDescription: 'PROTO Open End Wrench: 1/4 in_5/15 in Head', manufacturer: 'PROTO', mfgPartNumber: 'PN-AXON-016', supplierOrderCode: 'GG-01016', ggCode: 'GG-01016', qty: 1, unitPrice: 15.38, amount: 15.38, shippingWeightPerEach: 0.03405, itemWeightPerEach: 0.03405, totalShippingWeight: 0.03405, moq: '1' }),
  line({ no: 17, lineKey: 'EXCEL-017', sapDescription: 'PROTO Open End Wrench: 3/8 in_7/16 in Head', manufacturer: 'PROTO', mfgPartNumber: 'PN-AXON-017', supplierOrderCode: 'GG-01017', ggCode: 'GG-01017', qty: 1, unitPrice: 15.87, amount: 15.87, shippingWeightPerEach: 0.073775, itemWeightPerEach: 0.073775, totalShippingWeight: 0.073775, moq: '1' }),
  line({ no: 18, lineKey: 'EXCEL-018', sapDescription: 'PROTO Open End Wrench: 1/2 in_9/16 in Head', manufacturer: 'PROTO', mfgPartNumber: 'PN-AXON-018', supplierOrderCode: 'GG-01018', ggCode: 'GG-01018', qty: 5, unitPrice: 12.74, amount: 63.70, shippingWeightPerEach: 0.130525, itemWeightPerEach: 0.130525, totalShippingWeight: 0.652625, moq: '5' }),
  line({ no: 19, lineKey: 'EXCEL-019', sapDescription: 'PROTO Open End Wrench: 3/4 in_5/8 in Head', manufacturer: 'EXLIND', mfgPartNumber: 'PN-AXON-019', supplierOrderCode: 'GG-01019', ggCode: 'GG-01019', qty: 2, unitPrice: 20.96, amount: 41.92, shippingWeightPerEach: 0.221325, itemWeightPerEach: 0.221325, totalShippingWeight: 0.44265, moq: '2' }),
  line({ no: 20, lineKey: 'EXCEL-020', sapDescription: 'PROTO Open End Wrench: 3/4 in_11/16 in Head', manufacturer: 'PROTO', mfgPartNumber: 'PN-AXON-020', supplierOrderCode: 'GG-01020', ggCode: 'GG-01020', qty: 2, unitPrice: 16.74, amount: 33.48, shippingWeightPerEach: 0.255375, itemWeightPerEach: 0.255375, totalShippingWeight: 0.51075, moq: '2' }),
];

// ─── Expected outputs (API corrected values matching total-weight allocation) ────────────
// lineKey matches EXCEL_LINES[i].lineKey
// Fields: op1, op2, cifQTEC, cifZone, selectedDuty, ttFinal, ccFinal, qlc, salePrice(=roundUp)
export const EXCEL_EXPECTED = [
  { lineKey: 'EXCEL-001', no: 1, qty: 1, op1: 53236.84, op2: 54833.94, cifQTEC: 66123.05, cifZone: 92973.48, selectedDuty: 9297.35, ttFinal: 217.60, ccFinal: 2148.15, qlc: 76189.06, salePrice: 84654.51 },
  { lineKey: 'EXCEL-002', no: 2, qty: 2, op1: 34303.10, op2: 35332.19, cifQTEC: 39468.13, cifZone: 48924.15, selectedDuty: 4892.42, ttFinal: 142.42, ccFinal: 756.52, qlc: 44230.41, salePrice: 49144.90 },
  { lineKey: 'EXCEL-003', no: 3, qty: 1, op1: 24095.33, op2: 24818.19, cifQTEC: 27783.09, cifZone: 34574.50, selectedDuty: 3457.45, ttFinal: 100.00, ccFinal: 543.34, qlc: 31161.03, salePrice: 34623.37 },
  { lineKey: 'EXCEL-004', no: 4, qty: 5, op1: 2204.17, op2: 2270.29, cifQTEC: 2385.22, cifZone: 2615.79, selectedDuty: 261.58, ttFinal: 9.26, ccFinal: 18.45, qlc: 2608.39, salePrice: 2898.21 },
  { lineKey: 'EXCEL-005', no: 5, qty: 5, op1: 230.52, op2: 237.44, cifQTEC: 250.32, cifZone: 276.58, selectedDuty: 27.66, ttFinal: 0.97, ccFinal: 2.10, qlc: 274.13, salePrice: 304.59 },
  { lineKey: 'EXCEL-006', no: 6, qty: 1, op1: 706.92, op2: 728.12, cifQTEC: 845.15, cifZone: 1119.49, selectedDuty: 111.95, ttFinal: 2.91, ccFinal: 21.95, qlc: 960.76, salePrice: 1067.51 },
  { lineKey: 'EXCEL-007', no: 7, qty: 10, op1: 7011.16, op2: 7221.49, cifQTEC: 7628.77, cifZone: 8466.39, selectedDuty: 846.64, ttFinal: 29.42, ccFinal: 67.01, qlc: 8361.51, salePrice: 9290.57 },
  { lineKey: 'EXCEL-008', no: 8, qty: 1, op1: 302.70, op2: 311.78, cifQTEC: 328.91, cifZone: 363.93, selectedDuty: 36.39, ttFinal: 1.27, ccFinal: 2.80, qlc: 360.30, salePrice: 400.33 },
  { lineKey: 'EXCEL-009', no: 9, qty: 1, op1: 245.23, op2: 252.59, cifQTEC: 267.95, cifZone: 300.06, selectedDuty: 30.01, ttFinal: 1.03, ccFinal: 2.57, qlc: 294.20, salePrice: 326.89 },
  { lineKey: 'EXCEL-010', no: 10, qty: 1, op1: 524.34, op2: 540.07, cifQTEC: 574.66, cifZone: 647.62, selectedDuty: 64.76, ttFinal: 2.20, ccFinal: 5.84, qlc: 631.73, salePrice: 701.92 },
  { lineKey: 'EXCEL-011', no: 11, qty: 1, op1: 611.97, op2: 630.33, cifQTEC: 668.16, cifZone: 746.96, selectedDuty: 74.70, ttFinal: 2.57, ccFinal: 6.30, qlc: 733.37, salePrice: 814.86 },
  { lineKey: 'EXCEL-012', no: 12, qty: 1, op1: 974.65, op2: 1003.89, cifQTEC: 1109.66, cifZone: 1348.98, selectedDuty: 134.90, ttFinal: 4.05, ccFinal: 19.15, qlc: 1238.52, salePrice: 1376.13 },
  { lineKey: 'EXCEL-013', no: 13, qty: 1, op1: 32042.40, op2: 33003.68, cifQTEC: 33580.58, cifZone: 34197.71, selectedDuty: 0.00, ttFinal: 135.35, ccFinal: 49.37, qlc: 32804.04, salePrice: 36448.93 },
  { lineKey: 'EXCEL-014', no: 14, qty: 1, op1: 7744.63, op2: 7976.97, cifQTEC: 8571.05, cifZone: 9856.74, selectedDuty: 985.67, ttFinal: 32.39, ccFinal: 102.86, qlc: 9459.64, salePrice: 10510.71 },
  { lineKey: 'EXCEL-015', no: 15, qty: 2, op1: 42100.04, op2: 43363.04, cifQTEC: 50649.75, cifZone: 67781.49, selectedDuty: 6778.15, ttFinal: 173.24, ccFinal: 1370.62, qlc: 57708.75, salePrice: 64120.83 },
  { lineKey: 'EXCEL-016', no: 16, qty: 1, op1: 513.32, op2: 528.72, cifQTEC: 541.01, cifZone: 558.52, selectedDuty: 55.85, ttFinal: 2.17, ccFinal: 1.40, qlc: 585.04, salePrice: 650.04 },
  { lineKey: 'EXCEL-017', no: 17, qty: 1, op1: 531.00, op2: 546.93, cifQTEC: 567.57, cifZone: 605.52, selectedDuty: 60.55, ttFinal: 2.24, ccFinal: 3.04, qlc: 617.47, salePrice: 686.08 },
  { lineKey: 'EXCEL-018', no: 18, qty: 5, op1: 428.71, op2: 441.57, cifQTEC: 472.84, cifZone: 539.97, selectedDuty: 54.00, ttFinal: 1.79, ccFinal: 5.37, qlc: 521.15, salePrice: 579.06 },
  { lineKey: 'EXCEL-019', no: 19, qty: 2, op1: 705.55, op2: 726.72, cifQTEC: 779.51, cifZone: 893.34, selectedDuty: 89.33, ttFinal: 2.95, ccFinal: 9.11, qlc: 859.74, salePrice: 955.27 },
  { lineKey: 'EXCEL-020', no: 20, qty: 2, op1: 566.19, op2: 583.18, cifQTEC: 641.54, cifZone: 772.88, selectedDuty: 77.29, ttFinal: 2.36, ccFinal: 10.51, qlc: 714.72, salePrice: 794.13 },
];
