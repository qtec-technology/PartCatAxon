import type { AllocationLineSource, BulkCostInput } from './bulk-cost.types';
import { EMPTY_BULK_COST_INPUT, EMPTY_DOCUMENT_FEES } from './bulk-cost.types';

export const DEMO_VENDOR = {
  code: 'V-GRA-001',
  name: 'Grainger',
};

const CURRENCY_RATE: Record<string, number> = {
  AUD: 24.3,
  CNY: 5.5,
  EUR: 39,
  GBP: 45,
  JPY: 0.26,
  SGD: 26.4,
  THB: 1,
  USD: 33.3,
};

const LOCATION_ZONE_RATE: Record<string, number> = {
  TH: 1,
  US: 720,
  SG: 130,
  UK: 590,
  DE: 260,
  JP: 590,
  CN: 260,
  CA: 650,
  California: 720,
};

const SHIP_MODE_DEFAULT_FREIGHT_RATE: Record<number, number> = {
  1: 250,
  2: 0,
  3: 0,
  4: 0,
  5: 0,
  6: 300,
};

const BASE_CALC_DEFAULTS = {
  insPercent: 1,
  dimUnit: 1,
  etPercent: 0,
  miscTax: 0,
  scc: 0,
  stkPercent: 0,
  markupPercent: 15,
  sspk: 0,
} as const;

export interface BulkCostMockQuote {
  vendor: {
    code: string;
    name: string;
  };
  saleIncharge: string;
  contactPerson: string;
  updatedAt: string;
  currency: string;
  exchangeRate: number;
  paymentTerms: string;
  validityDays: string;
  costs: BulkCostInput;
  lines: AllocationLineSource[];
}

type MockQuoteSeed = {
  vendorCode: string;
  vendorName: string;
  orderCodePrefix: string;
  saleIncharge: string;
  contactPerson: string;
  updatedAt: string;
  currency: string;
  orderTerm: string;
  location: string;
  shipModeNo: number;
  deliveryLeadTime: string;
  itemGroup?: string;
  itemCategory?: string;
  uom?: string;
  countryOfOrigin?: string;
  importDutyPercent?: number;
  importPermit?: string;
  shelfLifeRequire?: string;
  paymentTerms?: string;
  validityDays?: string;
  freightRate?: number;
  costs: MockQuoteCostSeed;
  lines: MockLineSeed[];
};

type MockQuoteCostSeed =
  Pick<BulkCostInput, 'pkh' | 'soc' | 'freight' | 'customs' | 'wireTT' | 'referenceNo' | 'remark'>
  & Partial<Pick<BulkCostInput, 'currency' | 'exchangeRate'>>;

type MockLineSeed = {
  sapDescription: string;
  manufacturer: string;
  mfgPartNumber: string;
  qty: number;
  unitPrice: number;
  shippingWeightPerEach: number | null;
  itemWeightPerEach?: number | null;
  dimensionWeightPerEach?: number | null;
  itemGroup?: string;
  itemCategory?: string;
  itemCode?: string;
  supplierOrderCode?: string;
  uom?: string;
  currency?: string;
  countryOfOrigin?: string;
  hsCode?: string;
  docFee?: Partial<AllocationLineSource['docFee']>;
  deliveryLeadTime?: string;
  orderTerm?: string;
  location?: string;
  shipModeNo?: number;
  importPermit?: string;
  shelfLifeRequire?: string;
  importDutyPercent?: number;
  termId?: number | null;
  purchaseUOM?: string;
  stockUOM?: string;
  saleUOM?: string;
  stockConversion?: number;
  saleConversion?: number;
  moq?: number | null;
  insPercent?: number;
  freightRate?: number;
  dimUnit?: number;
  length?: number;
  width?: number;
  height?: number;
  zoneRate?: number;
  etPercent?: number;
  miscTax?: number;
  scc?: number;
  stkPercent?: number;
  markupPercent?: number;
  sspk?: number;
  qoc?: number;
};

function buildQuote(seed: MockQuoteSeed, quoteIndex: number): BulkCostMockQuote {
  const exchangeRate = seed.costs.exchangeRate ?? CURRENCY_RATE[seed.currency] ?? 1;
  const costs: BulkCostInput = {
    pkh: seed.costs.pkh,
    soc: seed.costs.soc,
    freight: seed.costs.freight,
    customs: seed.costs.customs,
    wireTT: seed.costs.wireTT,
    currency: seed.costs.currency ?? 'THB',
    exchangeRate,
    referenceNo: seed.costs.referenceNo,
    remark: seed.costs.remark,
    orderTerm: seed.orderTerm,
    location: seed.location,
    shipModeNo: seed.shipModeNo,
    contactPerson: seed.contactPerson,
    saleIncharge: seed.saleIncharge,
  };

  const lines = seed.lines.map((line, index): AllocationLineSource => {
    const no = index + 1;
    const currency = line.currency ?? seed.currency;
    const orderTerm = line.orderTerm ?? seed.orderTerm;
    const location = line.location ?? seed.location;
    const shipModeNo = line.shipModeNo ?? seed.shipModeNo;
    const qty = line.qty;
    const amount = Number((qty * line.unitPrice).toFixed(6));
    const totalShippingWeight = line.shippingWeightPerEach === null
      ? null
      : Number((line.shippingWeightPerEach * qty).toFixed(6));
    const supplierOrderCode = line.supplierOrderCode ?? `${seed.orderCodePrefix}-${String(no).padStart(4, '0')}`;
    const docFee = { ...EMPTY_DOCUMENT_FEES, ...(line.docFee ?? {}) };
    const itemWeight = line.itemWeightPerEach === undefined
      ? line.shippingWeightPerEach
      : line.itemWeightPerEach;
    const dimWeight = line.dimensionWeightPerEach === undefined
      ? null
      : line.dimensionWeightPerEach;
    const resolvedWeight = line.shippingWeightPerEach ?? dimWeight ?? itemWeight ?? 0;

    return {
      lineKey: `${seed.vendorCode}-${String(no).padStart(3, '0')}`,
      no,
      itemGroup: line.itemGroup ?? seed.itemGroup ?? '104',
      itemCategory: line.itemCategory ?? seed.itemCategory ?? 'Industrial',
      itemCode: line.itemCode ?? '',
      sapDescription: line.sapDescription,
      manufacturer: line.manufacturer,
      mfgPartNumber: line.mfgPartNumber,
      supplierOrderCode,
      ggCode: supplierOrderCode,
      vendorCode: seed.vendorCode,
      vendorName: seed.vendorName,
      qty,
      uom: line.uom ?? seed.uom ?? 'EA',
      unitPrice: line.unitPrice,
      amount,
      currency,
      countryOfOrigin: line.countryOfOrigin ?? seed.countryOfOrigin ?? location,
      hsCode: line.hsCode ?? '',
      docFee,
      deliveryLeadTime: line.deliveryLeadTime ?? seed.deliveryLeadTime,
      orderTerm,
      location,
      importPermit: line.importPermit ?? seed.importPermit ?? 'No',
      shelfLifeRequire: line.shelfLifeRequire ?? seed.shelfLifeRequire ?? 'No',
      itemWeightPerEach: itemWeight,
      dimensionWeightPerEach: dimWeight,
      shippingWeightPerEach: line.shippingWeightPerEach,
      totalShippingWeight,
      importDutyPercent: line.importDutyPercent ?? seed.importDutyPercent ?? 10,
      termId: line.termId ?? 90000 + (quoteIndex * 1000) + no,
      purchaseUOM: line.purchaseUOM ?? line.uom ?? seed.uom ?? 'EA',
      stockUOM: line.stockUOM ?? line.uom ?? seed.uom ?? 'EA',
      saleUOM: line.saleUOM ?? line.uom ?? seed.uom ?? 'EA',
      stockConversion: line.stockConversion ?? 1,
      saleConversion: line.saleConversion ?? 1,
      moq: line.moq ?? qty,
      insPercent: line.insPercent ?? BASE_CALC_DEFAULTS.insPercent,
      shipModeNo,
      freightRate: line.freightRate ?? seed.freightRate ?? SHIP_MODE_DEFAULT_FREIGHT_RATE[shipModeNo] ?? 0,
      dimUnit: line.dimUnit ?? BASE_CALC_DEFAULTS.dimUnit,
      length: line.length ?? 0,
      width: line.width ?? 0,
      height: line.height ?? 0,
      zoneRate: line.zoneRate ?? LOCATION_ZONE_RATE[location] ?? 0,
      etPercent: line.etPercent ?? BASE_CALC_DEFAULTS.etPercent,
      miscTax: line.miscTax ?? BASE_CALC_DEFAULTS.miscTax,
      scc: line.scc ?? BASE_CALC_DEFAULTS.scc,
      stkPercent: line.stkPercent ?? BASE_CALC_DEFAULTS.stkPercent,
      markupPercent: line.markupPercent ?? BASE_CALC_DEFAULTS.markupPercent,
      sspk: line.sspk ?? BASE_CALC_DEFAULTS.sspk,
      qoc: line.qoc ?? Number((resolvedWeight * 10).toFixed(6)),
    };
  });

  return {
    vendor: {
      code: seed.vendorCode,
      name: seed.vendorName,
    },
    saleIncharge: seed.saleIncharge,
    contactPerson: seed.contactPerson,
    updatedAt: seed.updatedAt,
    currency: seed.currency,
    exchangeRate,
    paymentTerms: seed.paymentTerms ?? 'Net 30 days',
    validityDays: seed.validityDays ?? '30 days',
    costs,
    lines,
  };
}

const GRAINGER_MANAGER_SAMPLE_LINES: MockLineSeed[] = [
  { sapDescription: 'PROTO Socket Set: 3/4 in Drive, 42 Piece, 12-Point/Point, SAE, 3/4 in to 2 3/8 in', manufacturer: 'PROTO', mfgPartNumber: 'PROTO-SKT-42', qty: 1, unitPrice: 1545.00, shippingWeightPerEach: 52.21 },
  { sapDescription: 'PROTO Socket Wrench Set: 1/2 in Drive, 65 Piece, 12 Point/8-Point, SAE, 3/8 in to 1 1/2 in', manufacturer: 'PROTO', mfgPartNumber: 'PROTO-SKT-65', qty: 2, unitPrice: 1011.21, shippingWeightPerEach: 18.387 },
  { sapDescription: 'PROTO Socket Bit Set: 3/8 in Drive, 58 Piece, 12-Point, SAE, 1/4 in to 1 in', manufacturer: 'PROTO', mfgPartNumber: 'PROTO-BIT-58', qty: 1, unitPrice: 710.00, shippingWeightPerEach: 13.205725 },
  { sapDescription: "PROTO Hand Ratchet: Round, Reversible, 8 1/2 in Overall Lg, Chrome, 5' Min Arc Swing, Proto", manufacturer: 'PROTO', mfgPartNumber: 'PROTO-RATCH-085', qty: 5, unitPrice: 65.73, shippingWeightPerEach: 0.448325 },
  { sapDescription: 'PROTO Socket Extension: 3/8 in Input Drive Size, 3/8 in Output Drive Size, 1 3/4 in Overall Lg, Std', manufacturer: 'PROTO', mfgPartNumber: 'PROTO-EXT-0134', qty: 5, unitPrice: 6.87, shippingWeightPerEach: 0.051075 },
  { sapDescription: 'PROTO Socket Extension: 3/8 in Input Drive Size, 3/8 in Output Drive Size, 17 3/16 in Overall Lg', manufacturer: 'PROTO', mfgPartNumber: 'PROTO-EXT-1716', qty: 1, unitPrice: 20.68, shippingWeightPerEach: 0.53345 },
  { sapDescription: 'PROTO Socket Socket Set: 1/4 in Drive, 25 Piece, SAE, 3/16 in to 9/16 in', manufacturer: 'PROTO', mfgPartNumber: 'PROTO-SKT-25', qty: 10, unitPrice: 208.87, shippingWeightPerEach: 1.628725 },
  { sapDescription: 'PROTO Socket Adapter: 3/8 in Output Drive Size, Square, 1 3/8 in Overall Lg, Chrome', manufacturer: 'PROTO', mfgPartNumber: 'PROTO-ADP-038', qty: 1, unitPrice: 9.02, shippingWeightPerEach: 0.0681 },
  { sapDescription: 'PROTO Socket Adapter: 1/2 in Output Drive Size, Square, 1 7/16 in Overall Lg, Chrome', manufacturer: 'PROTO', mfgPartNumber: 'PROTO-ADP-012', qty: 1, unitPrice: 7.30, shippingWeightPerEach: 0.062425 },
  { sapDescription: 'PROTO Socket Adapter: 3/4 in Output Drive Size, Square, 1 11/16 in Overall Lg, Chrome', manufacturer: 'PROTO', mfgPartNumber: 'PROTO-ADP-034', qty: 1, unitPrice: 15.60, shippingWeightPerEach: 0.141875 },
  { sapDescription: 'PROTO Socket Adapter: 1/2 in Output Drive Size, Square, 1 7/8 in Overall Lg, Chrome', manufacturer: 'PROTO', mfgPartNumber: 'PROTO-ADP-187', qty: 1, unitPrice: 18.22, shippingWeightPerEach: 0.153225 },
  { sapDescription: 'PROTO Socket Adapter: 1 in Output Drive Size, Square, 2 1/2 in Overall Lg, Chrome, Locking Included', manufacturer: 'PROTO', mfgPartNumber: 'PROTO-ADP-1IN', qty: 1, unitPrice: 28.79, shippingWeightPerEach: 0.46535 },
  { sapDescription: 'INGERSOLL RAND Air-Powered Drill: 1/4 in Chuck, Heavy Duty, 3,000 RPM, 0.25 hp, Keyed', manufacturer: 'INGERSOLL RAND', mfgPartNumber: 'IR-DRILL-3000', qty: 1, unitPrice: 961.00, shippingWeightPerEach: 1.20, importDutyPercent: 0 },
  { sapDescription: 'SPEEDAIRE Air Hose: 1/4 in Hose Inside Dia., Yellow, 300 psi Max. Working Pressure @ 70 F', manufacturer: 'SPEEDAIRE', mfgPartNumber: 'SPD-HOSE-025', qty: 1, unitPrice: 230.00, shippingWeightPerEach: 2.50 },
  { sapDescription: 'PROTO Combination Wrench Set: Alloy Steel, Satin, 26 Tools, 1/4 in to 2 in Range of Head Sizes', manufacturer: 'PROTO', mfgPartNumber: 'PROTO-WRENCH-26', qty: 2, unitPrice: 1230.00, shippingWeightPerEach: 33.31225 },
  { sapDescription: 'PROTO Open End Wrench: Alloy Steel, Satin, 1/4 in_5/15 in Head Size, 4 31/63 in Overall Lg, Std', manufacturer: 'PROTO', mfgPartNumber: 'PROTO-OEW-001', qty: 1, unitPrice: 15.38, shippingWeightPerEach: 0.03405 },
  { sapDescription: 'PROTO Open End Wrench: Alloy Steel, Satin, 3/8 in_7/16 in Head Size, 5 3/4 in Overall Lg, Std', manufacturer: 'PROTO', mfgPartNumber: 'PROTO-OEW-002', qty: 1, unitPrice: 15.87, shippingWeightPerEach: 0.073775 },
  { sapDescription: 'PROTO Open End Wrench: Alloy Steel, Satin, 1/2 in_9/16 in Head Size, 7 in Overall Lg, Std', manufacturer: 'PROTO', mfgPartNumber: 'PROTO-OEW-003', qty: 5, unitPrice: 12.74, shippingWeightPerEach: 0.130525 },
  { sapDescription: 'PROTO Open End Wrench: Alloy Steel, Satin, 3/4 in_5/8 in Head Size, 8 9/16 in Overall Lg, Std', manufacturer: 'EXLIND', mfgPartNumber: 'EXLIND-OEW-004', qty: 2, unitPrice: 20.96, shippingWeightPerEach: 0.221325 },
  { sapDescription: 'PROTO Open End Wrench: Alloy Steel, Satin, 3/4 in_11/16 in Head Size, 8 7/8 in Overall Lg, Std', manufacturer: 'PROTO', mfgPartNumber: 'PROTO-OEW-005', qty: 2, unitPrice: 16.74, shippingWeightPerEach: 0.255375 },
];

const DEMO_QUOTE_SEEDS: MockQuoteSeed[] = [
  {
    vendorCode: DEMO_VENDOR.code,
    vendorName: DEMO_VENDOR.name,
    orderCodePrefix: 'GRA-SUP',
    saleIncharge: 'Kittipat Milawan',
    contactPerson: 'David Marshall',
    updatedAt: '2026-05-04T10:07:00',
    currency: 'USD',
    orderTerm: 'Ex-work',
    location: 'California',
    shipModeNo: 5,
    deliveryLeadTime: '6 Weeks',
    paymentTerms: 'Net 30 days',
    validityDays: '30 days',
    itemCategory: 'Tools',
    countryOfOrigin: 'US',
    importDutyPercent: 10,
    costs: {
      pkh: 75,
      soc: 125,
      freight: 40000,
      customs: 8000,
      wireTT: 1500,
      currency: 'USD',
      exchangeRate: 33,
      referenceNo: 'ALLOC-GRAINGER-MANAGER-2026-0430',
      remark: 'Manager baseline Grainger quote from Excel calculation sample.',
    },
    lines: GRAINGER_MANAGER_SAMPLE_LINES,
  },
  {
    vendorCode: 'V-MCM-EXW-COUR',
    vendorName: 'McMaster-Carr Supply Co.',
    orderCodePrefix: 'MCM-US',
    saleIncharge: 'Kittipat Milawan',
    contactPerson: 'Sarah Adams',
    updatedAt: '2026-05-06T09:12:00',
    currency: 'USD',
    orderTerm: 'Exwork',
    location: 'US',
    shipModeNo: 6,
    deliveryLeadTime: '2 Weeks',
    paymentTerms: 'Net 30 days',
    validityDays: '30 days',
    itemCategory: 'Mechanical',
    countryOfOrigin: 'US',
    importDutyPercent: 10,
    costs: { pkh: 120, soc: 85, freight: 900, customs: 240, wireTT: 35, referenceNo: 'ALLOC-MCM-EXW-COUR-2026-0506', remark: 'Exwork + Air Courier branch with zone freight.' },
    lines: [
      { sapDescription: 'Stainless steel hex head cap screw, 1/2-13 thread, pack of 100', manufacturer: 'MCMASTER-CARR', mfgPartNumber: '91257A624', qty: 3, unitPrice: 42.80, shippingWeightPerEach: 1.9, hsCode: '7318.15' },
      { sapDescription: 'Oil-resistant Buna-N O-ring assortment kit', manufacturer: 'MCMASTER-CARR', mfgPartNumber: '9452K67', qty: 2, unitPrice: 64.25, shippingWeightPerEach: 0.8, hsCode: '4016.93' },
      { sapDescription: 'Ultra-corrosion-resistant 316 stainless steel shim stock roll', manufacturer: 'MCMASTER-CARR', mfgPartNumber: '9709K41', qty: 1, unitPrice: 188.00, shippingWeightPerEach: 2.6, hsCode: '7220.20', docFee: { coo: 18 } },
    ],
  },
  {
    vendorCode: 'V-RSC-FCA-TRUCK',
    vendorName: 'RS Components Ltd.',
    orderCodePrefix: 'RSC-UK',
    saleIncharge: 'Kittipat Milawan',
    contactPerson: 'James Powell',
    updatedAt: '2026-05-06T09:28:00',
    currency: 'GBP',
    orderTerm: 'FCA',
    location: 'UK',
    shipModeNo: 3,
    deliveryLeadTime: '3 Weeks',
    paymentTerms: 'Net 30 days',
    validityDays: '30 days',
    itemCategory: 'Electrical',
    countryOfOrigin: 'UK',
    importDutyPercent: 5,
    costs: { pkh: 95, soc: 110, freight: 650, customs: 180, wireTT: 28, referenceNo: 'ALLOC-RSC-FCA-TRUCK-2026-0506', remark: 'FCA + Truck branch, FR Zone uses 10% OP2.' },
    lines: [
      { sapDescription: 'RS PRO VDE diagonal cutter, 160 mm', manufacturer: 'RS PRO', mfgPartNumber: '125-3070', qty: 6, unitPrice: 18.40, shippingWeightPerEach: 0.22, hsCode: '8203.20' },
      { sapDescription: 'RS PRO DIN rail terminal block, 2.5 mm2, grey', manufacturer: 'RS PRO', mfgPartNumber: '501-752', qty: 50, unitPrice: 0.86, shippingWeightPerEach: 0.02, hsCode: '8536.90' },
      { sapDescription: 'RS PRO handheld tachometer with certificate', manufacturer: 'RS PRO', mfgPartNumber: '123-8778', qty: 1, unitPrice: 142.00, shippingWeightPerEach: 0.7, hsCode: '9029.20', docFee: { testCert: 22 } },
    ],
  },
  {
    vendorCode: 'V-SMC-FOB-AIR',
    vendorName: 'SMC Corporation Japan',
    orderCodePrefix: 'SMC-JP',
    saleIncharge: 'Kittipat Milawan',
    contactPerson: 'Yuki Tanaka',
    updatedAt: '2026-05-06T09:45:00',
    currency: 'JPY',
    orderTerm: 'FOB',
    location: 'JP',
    shipModeNo: 1,
    deliveryLeadTime: '5 Weeks',
    paymentTerms: 'Net 60 days',
    validityDays: '60 days',
    itemCategory: 'Pneumatic',
    countryOfOrigin: 'JP',
    importDutyPercent: 5,
    costs: { pkh: 1500, soc: 1200, freight: 18000, customs: 3500, wireTT: 450, referenceNo: 'ALLOC-SMC-FOB-AIR-2026-0506', remark: 'FOB + Air FWD branch.' },
    lines: [
      { sapDescription: 'SMC compact cylinder, 40 mm bore, 100 mm stroke', manufacturer: 'SMC', mfgPartNumber: 'CDQ2B40-100DMZ', qty: 4, unitPrice: 13800, shippingWeightPerEach: 1.4, hsCode: '8412.31' },
      { sapDescription: 'SMC solenoid valve, 5 port, 24 VDC', manufacturer: 'SMC', mfgPartNumber: 'SY5120-5DZ-01', qty: 8, unitPrice: 4200, shippingWeightPerEach: 0.28, hsCode: '8481.80' },
      { sapDescription: 'SMC air filter regulator with gauge', manufacturer: 'SMC', mfgPartNumber: 'AW30-F03E-B', qty: 3, unitPrice: 6700, shippingWeightPerEach: 0.85, hsCode: '8421.39' },
    ],
  },
  {
    vendorCode: 'V-PARKER-CN-SEA',
    vendorName: 'Parker China Distribution',
    orderCodePrefix: 'PKR-CN',
    saleIncharge: 'Kittipat Milawan',
    contactPerson: 'Chen Wei',
    updatedAt: '2026-05-06T10:02:00',
    currency: 'CNY',
    orderTerm: 'Exwork',
    location: 'CN',
    shipModeNo: 2,
    deliveryLeadTime: '8 Weeks',
    paymentTerms: 'Net 45 days',
    validityDays: '45 days',
    itemCategory: 'Filter',
    countryOfOrigin: 'CN',
    importDutyPercent: 5,
    costs: { pkh: 420, soc: 380, freight: 5200, customs: 900, wireTT: 120, referenceNo: 'ALLOC-PARKER-CN-SEA-2026-0506', remark: 'Exwork + Sea branch with sea dimensional weight behavior.' },
    lines: [
      { sapDescription: 'Parker hydraulic filter element, 10 micron', manufacturer: 'PARKER', mfgPartNumber: '937859Q', qty: 12, unitPrice: 260, shippingWeightPerEach: 1.0, hsCode: '8421.99' },
      { sapDescription: 'Parker high pressure hydraulic hose assembly', manufacturer: 'PARKER', mfgPartNumber: '471TC-8-RL', qty: 5, unitPrice: 410, shippingWeightPerEach: null, itemWeightPerEach: 3.2, dimensionWeightPerEach: 4.6, length: 90, width: 35, height: 28, hsCode: '4009.22' },
      { sapDescription: 'Parker brass ball valve, full port, 1 inch', manufacturer: 'PARKER', mfgPartNumber: 'BVL-16', qty: 10, unitPrice: 95, shippingWeightPerEach: 0.75, hsCode: '8481.80' },
    ],
  },
  {
    vendorCode: 'V-LOCAL-DDP-QTRUCK',
    vendorName: 'Thai Industrial Supply Co., Ltd.',
    orderCodePrefix: 'TIS-TH',
    saleIncharge: 'Kittipat Milawan',
    contactPerson: 'Somchai Jaiyen',
    updatedAt: '2026-05-06T10:18:00',
    currency: 'THB',
    orderTerm: 'DDP',
    location: 'TH',
    shipModeNo: 5,
    deliveryLeadTime: '1 Week',
    paymentTerms: 'Net 30 days',
    validityDays: '30 days',
    itemCategory: 'Chemical',
    countryOfOrigin: 'TH',
    importDutyPercent: 0,
    costs: { pkh: 300, soc: 250, freight: 1800, customs: 0, wireTT: 0, referenceNo: 'ALLOC-LOCAL-DDP-QTRUCK-2026-0506', remark: 'Domestic DDP + QTEC-Truck branch.' },
    lines: [
      { sapDescription: 'Industrial gear oil ISO VG 220, 20 L pail', manufacturer: 'SHELL', mfgPartNumber: 'OMALA-S2-G220', qty: 5, unitPrice: 4100, shippingWeightPerEach: 20, uom: 'PAIL', hsCode: '2710.19', shelfLifeRequire: 'Yes' },
      { sapDescription: 'Two-part epoxy adhesive, 200 ml cartridge', manufacturer: '3M', mfgPartNumber: 'DP420', qty: 12, unitPrice: 980, shippingWeightPerEach: 0.5, hsCode: '3506.91', importPermit: 'Yes', shelfLifeRequire: 'Yes', docFee: { coc: 35 } },
      { sapDescription: 'Nitrile coated cut resistant glove, pair', manufacturer: 'CONDOR', mfgPartNumber: '5NPG4', qty: 48, unitPrice: 95, shippingWeightPerEach: 0.12, uom: 'PR', hsCode: '6116.10' },
    ],
  },
  {
    vendorCode: 'V-SICK-SG-DAP',
    vendorName: 'SICK Singapore Pte. Ltd.',
    orderCodePrefix: 'SICK-SG',
    saleIncharge: 'Kittipat Milawan',
    contactPerson: 'Kevin Lim',
    updatedAt: '2026-05-06T10:34:00',
    currency: 'SGD',
    orderTerm: 'DAP',
    location: 'SG',
    shipModeNo: 6,
    deliveryLeadTime: '2 Weeks',
    paymentTerms: 'Net 30 days',
    validityDays: '30 days',
    itemCategory: 'Automation',
    countryOfOrigin: 'SG',
    importDutyPercent: 0,
    costs: { pkh: 80, soc: 60, freight: 320, customs: 140, wireTT: 24, referenceNo: 'ALLOC-SICK-SG-DAP-2026-0506', remark: 'DAP + Air Courier delivered branch.' },
    lines: [
      { sapDescription: 'Photoelectric sensor, WTB series, PNP, M12 connector', manufacturer: 'SICK', mfgPartNumber: 'WTB4-3P2161', qty: 6, unitPrice: 118, shippingWeightPerEach: 0.18, hsCode: '8536.50' },
      { sapDescription: 'Safety light curtain receiver, 600 mm protective height', manufacturer: 'SICK', mfgPartNumber: 'C4C-SA06010A10000', qty: 1, unitPrice: 1280, shippingWeightPerEach: 2.8, hsCode: '8543.70', importPermit: 'Yes' },
      { sapDescription: 'Incremental encoder, 1024 PPR, solid shaft', manufacturer: 'SICK', mfgPartNumber: 'DFS60B-S4PA01024', qty: 2, unitPrice: 420, shippingWeightPerEach: 0.55, hsCode: '9031.49' },
    ],
  },
  {
    vendorCode: 'V-RITTAL-DE-FCA',
    vendorName: 'Rittal GmbH & Co. KG',
    orderCodePrefix: 'RTL-DE',
    saleIncharge: 'Kittipat Milawan',
    contactPerson: 'Hans Weber',
    updatedAt: '2026-05-06T10:52:00',
    currency: 'EUR',
    orderTerm: 'FCA',
    location: 'DE',
    shipModeNo: 6,
    deliveryLeadTime: '4 Weeks',
    paymentTerms: 'Net 60 days',
    validityDays: '60 days',
    itemCategory: 'Electrical',
    countryOfOrigin: 'DE',
    importDutyPercent: 10,
    costs: { pkh: 100, soc: 120, freight: 540, customs: 170, wireTT: 32, referenceNo: 'ALLOC-RITTAL-DE-FCA-2026-0506', remark: 'FCA Germany + Air Courier branch.' },
    lines: [
      { sapDescription: 'Rittal enclosure cooling fan, 230 VAC filter fan unit', manufacturer: 'RITTAL', mfgPartNumber: '3238.100', qty: 2, unitPrice: 185.60, shippingWeightPerEach: 2.6, hsCode: '8414.59' },
      { sapDescription: 'Rittal enclosure thermostat, adjustable, 0 to 60 C', manufacturer: 'RITTAL', mfgPartNumber: '3110.000', qty: 5, unitPrice: 38.20, shippingWeightPerEach: 0.2, hsCode: '9032.10' },
      { sapDescription: 'Rittal cable gland plate, sheet steel', manufacturer: 'RITTAL', mfgPartNumber: '8617.500', qty: 3, unitPrice: 74.90, shippingWeightPerEach: 1.8, hsCode: '7326.90' },
    ],
  },
  {
    vendorCode: 'V-BRAMMER-FAS-UK',
    vendorName: 'Brammer UK Industrial Parts',
    orderCodePrefix: 'BRM-UK',
    saleIncharge: 'Kittipat Milawan',
    contactPerson: 'Peter Thompson',
    updatedAt: '2026-05-06T11:05:00',
    currency: 'GBP',
    orderTerm: 'FAS',
    location: 'UK',
    shipModeNo: 6,
    deliveryLeadTime: '5 Weeks',
    paymentTerms: 'Net 30 days',
    validityDays: '30 days',
    itemCategory: 'Mechanical',
    countryOfOrigin: 'UK',
    importDutyPercent: 10,
    costs: { pkh: 75, soc: 95, freight: 410, customs: 130, wireTT: 26, referenceNo: 'ALLOC-BRAMMER-FAS-UK-2026-0506', remark: 'FAS + Air Courier branch.' },
    lines: [
      { sapDescription: 'SKF deep groove ball bearing, 25 mm bore', manufacturer: 'SKF', mfgPartNumber: '6205-2RS1', qty: 20, unitPrice: 12.80, shippingWeightPerEach: 0.16, hsCode: '8482.10' },
      { sapDescription: 'Fenner V-belt, classical A section, 48 inch outside length', manufacturer: 'FENNER', mfgPartNumber: 'A46', qty: 12, unitPrice: 8.40, shippingWeightPerEach: 0.22, hsCode: '4010.32' },
      { sapDescription: 'Renold roller chain, simplex, 10 ft box', manufacturer: 'RENOLD', mfgPartNumber: '06B-1', qty: 2, unitPrice: 72.00, shippingWeightPerEach: 3.1, hsCode: '7315.11' },
    ],
  },
  {
    vendorCode: 'V-TH-CPT-AIR',
    vendorName: 'Thai Automation Trading',
    orderCodePrefix: 'TAT-TH',
    saleIncharge: 'Kittipat Milawan',
    contactPerson: 'Nattawee Somsak',
    updatedAt: '2026-05-06T11:18:00',
    currency: 'THB',
    orderTerm: 'CPT',
    location: 'TH',
    shipModeNo: 1,
    deliveryLeadTime: '10 Days',
    paymentTerms: 'Net 15 days',
    validityDays: '15 days',
    itemCategory: 'Automation',
    countryOfOrigin: 'TH',
    importDutyPercent: 0,
    costs: { pkh: 180, soc: 140, freight: 950, customs: 0, wireTT: 0, referenceNo: 'ALLOC-TH-CPT-AIR-2026-0506', remark: 'CPT + Air FWD branch.' },
    lines: [
      { sapDescription: 'PLC digital input module, 16 point, 24 VDC', manufacturer: 'MITSUBISHI', mfgPartNumber: 'QX41', qty: 3, unitPrice: 5200, shippingWeightPerEach: 0.42, hsCode: '8538.90' },
      { sapDescription: 'Touch screen HMI, 7 inch, Ethernet', manufacturer: 'WEINTEK', mfgPartNumber: 'MT8071iE', qty: 2, unitPrice: 8900, shippingWeightPerEach: 1.1, hsCode: '8537.10' },
    ],
  },
  {
    vendorCode: 'V-CIF-TH-SEA',
    vendorName: 'Global Pump Importer',
    orderCodePrefix: 'GPI-SEA',
    saleIncharge: 'Kittipat Milawan',
    contactPerson: 'Alex Rodriguez',
    updatedAt: '2026-05-06T11:31:00',
    currency: 'USD',
    orderTerm: 'CIF',
    location: 'TH',
    shipModeNo: 2,
    deliveryLeadTime: '7 Weeks',
    paymentTerms: 'Net 45 days',
    validityDays: '45 days',
    itemCategory: 'Pump',
    countryOfOrigin: 'US',
    importDutyPercent: 5,
    costs: { pkh: 210, soc: 180, freight: 2400, customs: 650, wireTT: 45, referenceNo: 'ALLOC-CIF-TH-SEA-2026-0506', remark: 'CIF + Sea branch.' },
    lines: [
      { sapDescription: 'Centrifugal pump, stainless steel, 2 HP, 230/460 VAC', manufacturer: 'GOULDS', mfgPartNumber: 'NPE-2ST', qty: 1, unitPrice: 1850, shippingWeightPerEach: 85, hsCode: '8413.70' },
      { sapDescription: 'Mechanical seal kit for centrifugal pump', manufacturer: 'GOULDS', mfgPartNumber: 'SEAL-NPE-2ST', qty: 2, unitPrice: 145, shippingWeightPerEach: 0.8, hsCode: '8484.20' },
    ],
  },
  {
    vendorCode: 'V-QTEC-PICK-MC',
    vendorName: 'QTEC Local Pickup Mock Supplier',
    orderCodePrefix: 'QPK-TH',
    saleIncharge: 'Kittipat Milawan',
    contactPerson: 'Weerapong Nakorn',
    updatedAt: '2026-05-06T11:46:00',
    currency: 'THB',
    orderTerm: 'QTEC PICK UP',
    location: 'TH',
    shipModeNo: 4,
    deliveryLeadTime: '1 Day',
    paymentTerms: 'Cash on Delivery',
    validityDays: '7 days',
    itemCategory: 'Service',
    countryOfOrigin: 'TH',
    importDutyPercent: 0,
    costs: { pkh: 25, soc: 20, freight: 120, customs: 0, wireTT: 0, referenceNo: 'ALLOC-QTEC-PICK-MC-2026-0506', remark: 'QTEC pickup + motorcycle branch.' },
    lines: [
      { sapDescription: 'Emergency replacement proximity sensor, M12, PNP', manufacturer: 'OMRON', mfgPartNumber: 'E2E-X5ME1', qty: 2, unitPrice: 780, shippingWeightPerEach: 0.12, hsCode: '8536.50' },
      { sapDescription: 'Local delivery and handling service', manufacturer: 'QTEC', mfgPartNumber: 'LOCAL-HANDLING', qty: 1, unitPrice: 250, shippingWeightPerEach: 0.01, itemGroup: '107', uom: 'LOT', importDutyPercent: 0 },
    ],
  },
  {
    vendorCode: 'V-EXFACT-TH',
    vendorName: 'Thai Factory Direct',
    orderCodePrefix: 'TFD-TH',
    saleIncharge: 'Kittipat Milawan',
    contactPerson: 'Pattama Nilkarn',
    updatedAt: '2026-05-06T12:02:00',
    currency: 'THB',
    orderTerm: 'EX-FACTORY-Thailand',
    location: 'TH',
    shipModeNo: 3,
    deliveryLeadTime: '2 Weeks',
    paymentTerms: 'Net 30 days',
    validityDays: '30 days',
    itemCategory: 'Fabrication',
    countryOfOrigin: 'TH',
    importDutyPercent: 0,
    costs: { pkh: 160, soc: 100, freight: 1300, customs: 0, wireTT: 0, referenceNo: 'ALLOC-EXFACT-TH-2026-0506', remark: 'EX-FACTORY-Thailand branch for rule confirmation.' },
    lines: [
      { sapDescription: 'Custom stainless steel mounting bracket, 304, drawing supplied', manufacturer: 'THAI FACTORY DIRECT', mfgPartNumber: 'BRK-304-CUSTOM', qty: 15, unitPrice: 420, shippingWeightPerEach: 0.9, hsCode: '7326.90' },
      { sapDescription: 'Powder coated equipment guard panel, 600 x 400 mm', manufacturer: 'THAI FACTORY DIRECT', mfgPartNumber: 'GUARD-PNL-6040', qty: 6, unitPrice: 1250, shippingWeightPerEach: 4.8, hsCode: '7326.90' },
    ],
  },
];

export const DEMO_QUOTES: BulkCostMockQuote[] = DEMO_QUOTE_SEEDS.map(buildQuote);

export const DEMO_LINES: AllocationLineSource[] = DEMO_QUOTES[0].lines;

export const DEMO_COSTS: BulkCostInput = DEMO_QUOTES[0].costs;

export function getDemoQuoteForSupplier(supplierCode: string): BulkCostMockQuote {
  return DEMO_QUOTES.find((quote) => quote.vendor.code === supplierCode) ?? DEMO_QUOTES[0];
}

export function getDemoLinesForSupplier(supplierCode: string): AllocationLineSource[] {
  return DEMO_QUOTES.find((quote) => quote.vendor.code === supplierCode)?.lines ?? [];
}

export function getDemoCostsForSupplier(supplierCode: string): BulkCostInput {
  return DEMO_QUOTES.find((quote) => quote.vendor.code === supplierCode)?.costs ?? { ...EMPTY_BULK_COST_INPUT };
}
