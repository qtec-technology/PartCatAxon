/**
 * Column definitions, presets, and labels for the Bulk Cost Workspace tables.
 * No React — safe to import from .ts and .tsx files.
 */

import type { BulkCostInput, DocumentFees } from './bulk-cost.types';
import {
  FINAL_RESULT_COLS,
  FINAL_RESULT_COLS_BY_KEY,
  type FinalResultKey,
} from './bulk-cost.final-result';
import type { ResizableTableColumn } from './useResizableTableColumns';

// ---------------------------------------------------------------------------
// Field metadata
// ---------------------------------------------------------------------------

export const COST_FIELDS: {
  key: keyof Pick<BulkCostInput, 'pkh' | 'soc' | 'freight' | 'customs' | 'wireTT'>;
  code: string;
  label: string;
  rule: string;
}[] = [
  { key: 'pkh',     code: 'PKH',     label: 'Packing Handling (PKH)',    rule: 'Weight-based' },
  { key: 'soc',     code: 'SOC',     label: 'Supplier Outb Cost (SOC)', rule: 'Weight-based' },
  { key: 'freight', code: 'FR',      label: 'Freight (FR)',           rule: 'Weight-based' },
  { key: 'customs', code: 'CC',      label: 'Customs Clear (CC)',        rule: 'Weight-based' },
  { key: 'wireTT',  code: 'TT',      label: 'Wire T/T (TT)',           rule: 'Value-based'  },
];

export const DOC_FEE_FIELDS: { key: keyof DocumentFees; label: string }[] = [
  { key: 'coc', label: 'COC' },
  { key: 'millCert', label: 'Mill' },
  { key: 'testCert', label: 'Test Cert' },
  { key: 'coa', label: 'COA' },
  { key: 'coo', label: 'COO' },
  { key: 'anyOther', label: 'Any Other' },
];

export const ALLOC_COLS = [
  { key: 'weightRatioPerItem', label: 'Wt Ratio/Item' },
  { key: 'weightRatioPerEach', label: 'Wt Ratio/Each' },
  { key: 'valueRatioPerItem', label: 'Val Ratio/Item' },
  { key: 'valueRatioPerEach', label: 'Val Ratio/Each' },
  { key: 'pkhPerEach', label: 'PKH/Ea' },
  { key: 'socPerEach', label: 'SOC/Ea' },
  { key: 'freightPerEach', label: 'Freight/Ea' },
  { key: 'ccPerEach', label: 'CC/Ea' },
  { key: 'wireTTPerEach', label: 'TT/Ea' },
] as const;

// ---------------------------------------------------------------------------
// Column key helpers
// ---------------------------------------------------------------------------

export const getDocFeeColumnKey = (key: keyof DocumentFees) => `doc-${key}`;
export const getFinalResultColumnKey = (key: FinalResultKey) => `final-${key}`;
export const LINE_STICKY_KEYS = ['select', 'delete', 'no', 'description'] as const;

// ---------------------------------------------------------------------------
// Table column definitions
// ---------------------------------------------------------------------------

export const LINE_TABLE_COLUMNS: ResizableTableColumn[] = [
  { key: 'select', defaultWidth: 72, minWidth: 64 },
  { key: 'delete', defaultWidth: 78, minWidth: 72 },
  { key: 'no', defaultWidth: 58, minWidth: 48 },
  // Reserved for AXON Awarded Reverse Mapping — do not remove
  { key: 'matchStatus', defaultWidth: 112, minWidth: 96 },
  { key: 'itemGroup', defaultWidth: 116, minWidth: 96 },
  { key: 'manufacturer', defaultWidth: 138, minWidth: 110, maxWidth: 260 },
  { key: 'mfgPartNumber', defaultWidth: 150, minWidth: 120, maxWidth: 320 },
  { key: 'description', defaultWidth: 360, minWidth: 180, maxWidth: 720 },
  { key: 'itemCategory', defaultWidth: 144, minWidth: 116, maxWidth: 280 },
  { key: 'customerStockCode', defaultWidth: 150, minWidth: 122, maxWidth: 280 },
  { key: 'qty', defaultWidth: 78, minWidth: 68 },
  { key: 'uom', defaultWidth: 104, minWidth: 84 },
  { key: 'unitPrice', defaultWidth: 120, minWidth: 100 },
  { key: 'amount', defaultWidth: 126, minWidth: 108 },
  { key: 'currency', defaultWidth: 88, minWidth: 78 },
  { key: 'countryOfOrigin', defaultWidth: 160, minWidth: 130, maxWidth: 260 },
  { key: 'leadTime', defaultWidth: 122, minWidth: 104 },
  { key: 'orderTerm', defaultWidth: 112, minWidth: 96 },
  { key: 'location', defaultWidth: 150, minWidth: 118, maxWidth: 320 },
  { key: 'subLocation', defaultWidth: 132, minWidth: 112, maxWidth: 280 },
  { key: 'shipMode', defaultWidth: 116, minWidth: 98 },
  { key: 'salesTerm', defaultWidth: 126, minWidth: 106 },
  { key: 'salesSubLocation', defaultWidth: 150, minWidth: 122, maxWidth: 280 },
  { key: 'hsCode', defaultWidth: 118, minWidth: 100, maxWidth: 220 },
  { key: 'importPermit', defaultWidth: 118, minWidth: 104 },
  { key: 'permitType', defaultWidth: 118, minWidth: 104 },
  { key: 'shelfLife', defaultWidth: 134, minWidth: 116 },
  { key: 'itemWeight', defaultWidth: 118, minWidth: 104 },
  { key: 'length', defaultWidth: 90, minWidth: 76 },
  { key: 'width', defaultWidth: 90, minWidth: 76 },
  { key: 'height', defaultWidth: 90, minWidth: 76 },
  { key: 'dimUnit', defaultWidth: 82, minWidth: 70 },
  { key: 'dimWeight', defaultWidth: 118, minWidth: 104 },
  { key: 'chargeableWeight', defaultWidth: 140, minWidth: 118 },
  { key: 'shipWeight', defaultWidth: 122, minWidth: 108 },
  { key: 'freightRate', defaultWidth: 150, minWidth: 120 },
  { key: 'supplierOrderCode', defaultWidth: 154, minWidth: 124, maxWidth: 320 },
  { key: 'purchaseUOM', defaultWidth: 110, minWidth: 90 },
  { key: 'stockConversion', defaultWidth: 118, minWidth: 102 },
  { key: 'saleUOM', defaultWidth: 110, minWidth: 90 },
  { key: 'saleConversion', defaultWidth: 118, minWidth: 102 },
  { key: 'importDuty', defaultWidth: 104, minWidth: 92 },
  { key: 'moq', defaultWidth: 96, minWidth: 82 },
  { key: 'insPercent', defaultWidth: 96, minWidth: 84 },
  { key: 'stkPercent', defaultWidth: 96, minWidth: 84 },
  { key: 'zoneRate', defaultWidth: 110, minWidth: 94 },
  { key: 'etPercent', defaultWidth: 92, minWidth: 82 },
  { key: 'miscTax', defaultWidth: 104, minWidth: 90 },
  { key: 'scc', defaultWidth: 104, minWidth: 90 },
  { key: 'spkPercent', defaultWidth: 96, minWidth: 84 },
  { key: 'qocRate', defaultWidth: 96, minWidth: 84 },
  { key: 'markupPercent', defaultWidth: 104, minWidth: 92 },
  ...DOC_FEE_FIELDS.map((field) => ({ key: getDocFeeColumnKey(field.key), defaultWidth: 106, minWidth: 92 })),
  // Allocated Bulk Costs per-line (read-only, from Step 1 after CAL)
  { key: 'pkhEa', defaultWidth: 108, minWidth: 92 },
  { key: 'socEa', defaultWidth: 108, minWidth: 92 },
  { key: 'frEa', defaultWidth: 108, minWidth: 92 },
  { key: 'ccEa', defaultWidth: 108, minWidth: 92 },
  { key: 'ttEa', defaultWidth: 108, minWidth: 92 },
  // Computed Order Price columns (read-only)
  { key: 'docFeeTotal', defaultWidth: 112, minWidth: 96 },
  { key: 'op1Fcy', defaultWidth: 120, minWidth: 104 },
  { key: 'exRateCol', defaultWidth: 96, minWidth: 82 },
  { key: 'op1Thb', defaultWidth: 120, minWidth: 104 },
  { key: 'insAmount', defaultWidth: 108, minWidth: 92 },
  { key: 'cifQTEC', defaultWidth: 120, minWidth: 104 },
  // Calculated Landed & Sales price columns
  { key: 'preQLC', defaultWidth: 112, minWidth: 96 },
  { key: 'qlc', defaultWidth: 112, minWidth: 96 },
  { key: 'totalQLC', defaultWidth: 120, minWidth: 104 },
  { key: 'roundUp', defaultWidth: 128, minWidth: 108 },
  // Custom Registration columns
  { key: 'eccn', defaultWidth: 110, minWidth: 90 },
  { key: 'unspsc', defaultWidth: 110, minWidth: 90 },
  { key: 'eProcurementCode', defaultWidth: 130, minWidth: 100 },
  { key: 'sdsRequired', defaultWidth: 110, minWidth: 90 },
  { key: 'certificateRequired', defaultWidth: 130, minWidth: 100 },
  { key: 'status', defaultWidth: 120, minWidth: 106 },
];

export const FINAL_PREVIEW_TABLE_COLUMNS = [
  { key: 'rowNo', defaultWidth: 58, minWidth: 48 },
  { key: 'itemGroup', defaultWidth: 116, minWidth: 96 },
  { key: 'supplierOrderCode', defaultWidth: 154, minWidth: 124, maxWidth: 320 },
  { key: 'description', defaultWidth: 360, minWidth: 180, maxWidth: 720 },
  { key: 'qty', defaultWidth: 96, minWidth: 76 },
  { key: 'uom', defaultWidth: 76, minWidth: 64 },
  { key: 'amount', defaultWidth: 126, minWidth: 104 },
  ...ALLOC_COLS.map((column) => ({ key: `alloc-${column.key}`, defaultWidth: 112, minWidth: 96 })),
  ...FINAL_RESULT_COLS.map((column) => ({
    key: getFinalResultColumnKey(column.key),
    defaultWidth: column.kind === 'text' ? 132 : 112,
    minWidth: column.kind === 'text' ? 104 : 96,
    maxWidth: column.kind === 'text' ? 320 : 180,
  })),
  { key: 'status', defaultWidth: 116, minWidth: 104 },
];

// ---------------------------------------------------------------------------
// Line column preset types and definitions
// ---------------------------------------------------------------------------

export type LineColumnPreset =
  | 'item-data'
  | 'purchase-order-price'
  | 'import-freight-cif'
  | 'landed-sales-price'
  | 'uom-selling-terms'
  | 'registration-details'
  | 'all';

export type ResultView = 'review' | 'formula' | 'full';
export type DraftPreviewMode = 'item' | 'term';

export const LINE_COLUMN_PRESETS: Record<LineColumnPreset, string[]> = {
  'item-data': [
    'select',
    'delete',
    'no',
    'itemGroup',
    'manufacturer',
    'mfgPartNumber',
    'description',
    'itemCategory',
    'customerStockCode',
    'countryOfOrigin',
    'uom',
    'status'
  ],
  'purchase-order-price': [
    'select',
    'delete',
    'no',
    'description',
    'qty',
    'unitPrice',
    'currency',
    'amount',
    'pkhEa',       // allocated PKH
    'socEa',       // allocated SOC
    'docFeeTotal', // Doc(ea)
    'op1Fcy',      // OP1 (foreign currency)
    'op1Thb',      // OP1 THB / OP2 THB
    'status'
  ],
  'import-freight-cif': [
    'select',
    'delete',
    'no',
    'description',
    'orderTerm',
    'location',
    'subLocation',
    'shipMode',
    'insPercent',
    'itemWeight',
    'dimWeight',
    'chargeableWeight',
    'shipWeight',
    'frEa',
    'insAmount',
    'cifQTEC',
    'freightRate',
    'zoneRate',
    'status'
  ],
  'landed-sales-price': [
    'select',
    'delete',
    'no',
    'description',
    'importDuty',
    'stkPercent',
    'etPercent',
    'miscTax',
    'scc',
    'ccEa',
    'ttEa',
    'frEa',
    'markupPercent',
    // After CAL, read-only
    'preQLC',
    'qlc',
    'totalQLC',
    'roundUp',
    'status'
  ],
  'uom-selling-terms': [
    'select',
    'delete',
    'no',
    'description',
    'purchaseUOM',
    'uom', // Stock UOM (ReadOnly/Mirror)
    'stockConversion',
    'salesTerm',
    'salesSubLocation',
    'saleUOM',
    'saleConversion',
    'spkPercent',
    'qocRate',
    'moq',
    'status'
  ],
  'registration-details': [
    'select',
    'delete',
    'no',
    'description',
    'eccn',
    'unspsc',
    'eProcurementCode',
    'sdsRequired',
    'certificateRequired',
    'status'
  ],
  'all': LINE_TABLE_COLUMNS.filter((c) => c.key !== 'matchStatus').map((column) => column.key),
};

export const EDITABLE_LINE_COLUMNS_BY_PRESET: Record<LineColumnPreset, string[]> = {
  'item-data': [
    'select',
    'delete',
    'itemGroup',
    'manufacturer',
    'mfgPartNumber',
    'itemCategory',
    'customerStockCode',
    'countryOfOrigin',
    'sapDescription',
    'uom', // editable here!
  ],
  'purchase-order-price': [
    'select',
    'delete',
    'qty',
    'unitPrice',
    'currency',
  ],
  'import-freight-cif': [
    'select',
    'delete',
    'orderTerm',
    'location',
    'subLocation',
    'shipModeNo',
    'insPercent',
    'length',
    'width',
    'height',
    'dimUnit',
    'itemWeightPerEach',
    'freightRate',
    'zoneRate',
  ],
  'landed-sales-price': [
    'select',
    'delete',
    'importDutyPercent',
    'stkPercent',
    'etPercent',
    'miscTax',
    'scc',
    'markupPercent',
  ],
  'uom-selling-terms': [
    'select',
    'delete',
    'purchaseUOM',
    // stock UOM ('uom') is read-only here!
    'stockConversion',
    'salesTerm',
    'salesSubLocation',
    'saleUOM',
    'saleConversion',
    'spkPercent',
    'qocRate',
    'moq',
  ],
  'registration-details': [
    'select',
    'delete',
    'eccn',
    'unspsc',
    'eProcurementCode',
    'longDesc1',
    'longDesc2',
    'longDesc3',
    'longDesc4',
    'generalSpec',
    'referenceUrl',
    'sdsRequired',
    'certificateRequired',
    'customerBpa',
    'qtecStock',
    'serialRequired',
    'dgRequired',
    'eCommerce',
    'importPermit',
    'permitType',
    'shelfLifeRequire',
  ],
  'all': [],
};

export function canEditLineColumnInPreset(preset: LineColumnPreset, columnKey: string): boolean {
  return EDITABLE_LINE_COLUMNS_BY_PRESET[preset]?.includes(columnKey) ?? false;
}

// ---------------------------------------------------------------------------
// Column labels
// ---------------------------------------------------------------------------

export const LINE_COLUMN_LABELS: Record<string, string> = {
  select: 'Select',
  delete: 'Action',
  no: 'No',
  itemGroup: 'Item Group',
  itemCategory: 'Item Category',
  customerStockCode: 'Cust Stock Code',
  matchStatus: 'Match',
  description: 'Item Description',
  manufacturer: 'Mfr Brand',
  mfgPartNumber: 'Mfr Catalog No',
  supplierOrderCode: 'Supp Order Code',
  qty: 'Qty',
  uom: 'Stock UOM',
  unitPrice: 'PCS/Ea',
  amount: 'Amount',
  currency: 'Currency',
  hsCode: 'Harmonized Code',
  countryOfOrigin: 'Country of Origin',
  leadTime: 'Lead Time',
  orderTerm: 'Purchase Term',
  location: 'Term Location',
  subLocation: 'Sub Location',
  shipMode: 'Ship Mode',
  salesTerm: 'Sales Term',
  salesSubLocation: 'Sales Sub Loc',
  importPermit: 'Permit Required',
  permitType: 'Permit Type',
  shelfLife: 'Shelf Life',
  itemWeight: 'Item Wt/Ea',
  dimWeight: 'Dim Wt/Ea',
  chargeableWeight: 'Chargeable Wt/Ea',
  shipWeight: 'Ship Wt/Ea',
  freightRate: 'Freight/Courier Rate',
  length: 'Length',
  width: 'Width',
  height: 'Height',
  dimUnit: 'Dim Unit',
  importDuty: 'Duty %',
  moq: 'MOQ',
  insPercent: 'INS %',
  insAmount: 'INS',
  stkPercent: 'Stock Fee (SF) (%)',
  zoneRate: 'Zone Rate',
  etPercent: 'Excise Tax (%ET)',
  miscTax: 'Misc Tax (ETC) (THB)',
  scc: 'SCC',
  spkPercent: 'SPK (%)',
  qocRate: 'QOC (THB/kg)',
  markupPercent: 'Markup %',
  purchaseUOM: 'Pur. UOM',
  stockConversion: 'Stock Conv.',
  saleUOM: 'Sales UOM',
  saleConversion: 'Sales Conv.',
  pkhEa: 'PKH/Ea',
  socEa: 'SOC/Ea',
  frEa: 'FR/Ea',
  ccEa: 'CC/Ea',
  ttEa: 'TT/Ea',
  docFeeTotal: 'DOC Fee',
  op1Fcy: 'OP1(FCY)',
  exRateCol: 'Ex.Rate',
  op1Thb: 'OP1(THB)',
  cifQTEC: 'CIF(THB)',
  status: 'Status',
  preQLC: 'Pre-QLC',
  qlc: 'QLC',
  totalQLC: 'Total Price',
  roundUp: 'Sale Price',
  eccn: 'ECCN',
  unspsc: 'UNSPSC',
  eProcurementCode: 'e-Proc Code',
  sdsRequired: 'SDS Req.',
  certificateRequired: 'Cert Req.',
};

for (const field of DOC_FEE_FIELDS) {
  LINE_COLUMN_LABELS[getDocFeeColumnKey(field.key)] = field.label;
}

// ---------------------------------------------------------------------------
// Review / formula result column metadata
// ---------------------------------------------------------------------------

export const REVIEW_RESULT_KEYS: FinalResultKey[] = [
  // ② Foreign Currency (USD) / Each — per-line allocated costs in source currency
  'productCost', 'pkh', 'soc', 'docFees', 'op1Source', 'currency', 'rateExchange',
  // ③ THB & CIF / Each — converted to THB
  'op1', 'ins', 'frQTEC', 'cifQTEC',
  // ④ Landed Cost / Each
  'selectedDuty', 'wireTT', 'customClear', 'preQLC', 'qlc',
  // ⑤ Sales Price (THB)
  'totalQLC', 'markup', 'roundUp',
];

export const REVIEW_RESULT_GROUPS = [
  { label: 'Foreign Currency / Each',  className: 'th-group th-group-fcurr',   count: 7 },
  { label: 'THB & CIF / Each',         className: 'th-group th-group-thbcif',  count: 4 },
  { label: 'Landed Cost / Each',       className: 'th-group th-group-landed',  count: 5 },
  { label: 'SALES PRICE (THB)',        className: 'th-group th-group-sale',    count: 3 },
] as const;

export const REVIEW_LABEL_OVERRIDE: Partial<Record<FinalResultKey, string>> = {
  productCost: 'PCS',
  docFees:     'Doc(ea)',
  op1Source:   'OP1(USD)',
  op1:         'OP2(THB)',
  cifQTEC:     'CIF(THB)',
  selectedDuty:'Duty(DT)',
};

export const SALE_PRICE_KEYS  = new Set<FinalResultKey>(['totalQLC', 'markup', 'roundUp']);
export const LANDED_KEYS      = new Set<FinalResultKey>(['selectedDuty', 'wireTT', 'customClear', 'preQLC', 'qlc']);
export const THBCIF_KEYS      = new Set<FinalResultKey>(['op1', 'ins', 'frQTEC', 'cifQTEC']);

export function getReviewColClass(key: FinalResultKey): string {
  if (SALE_PRICE_KEYS.has(key)) return 'th-group-sale';
  if (LANDED_KEYS.has(key))     return 'th-group-landed';
  if (THBCIF_KEYS.has(key))     return 'th-group-thbcif';
  return 'th-group-fcurr';
}

export const FORMULA_RESULT_KEYS: FinalResultKey[] = [
  'productCost',
  'pkh',
  'soc',
  'docCOC',
  'docMill',
  'docTestCert',
  'docCOO',
  'docAnyOther',
  'docFees',
  'currency',
  'op1Source',
  'rateExchange',
  'shipWeightCal',
  'importDutyPercent',
  'wireTT',
  'customClear',
  'op1',
  'exworkCase',
  'op2',
  'ins',
  'frQTEC',
  'selectedDuty',
  'qlc',
  'totalQLC',
  'markup',
  'roundUp',
];

export const BASE_REVIEW_RESULT_COLUMNS: ResizableTableColumn[] = [
  { key: 'rowNo', defaultWidth: 58, minWidth: 48 },
  { key: 'itemGroup', defaultWidth: 116, minWidth: 96 },
  { key: 'supplierOrderCode', defaultWidth: 154, minWidth: 124, maxWidth: 320 },
  { key: 'description', defaultWidth: 420, minWidth: 220, maxWidth: 780 },
  { key: 'qty', defaultWidth: 96, minWidth: 76 },
  { key: 'uom', defaultWidth: 76, minWidth: 64 },
];

export const REVIEW_RESULT_TABLE_COLUMNS: ResizableTableColumn[] = [
  ...BASE_REVIEW_RESULT_COLUMNS,
  ...REVIEW_RESULT_KEYS.map((key) => ({
    key: getFinalResultColumnKey(key),
    defaultWidth: key === 'roundUp' ? 128 : 112,
    minWidth: 96,
    maxWidth: 180,
  })),
  { key: 'draftPreview', defaultWidth: 154, minWidth: 136 },
  { key: 'status', defaultWidth: 116, minWidth: 104 },
];

export const FORMULA_PREVIEW_TABLE_COLUMNS: ResizableTableColumn[] = [
  ...BASE_REVIEW_RESULT_COLUMNS,
  { key: 'amount', defaultWidth: 126, minWidth: 104 },
  ...ALLOC_COLS.map((column) => ({ key: `alloc-${column.key}`, defaultWidth: 112, minWidth: 96 })),
  ...FORMULA_RESULT_KEYS.map((key) => {
    const column = FINAL_RESULT_COLS_BY_KEY.get(key);
    return {
      key: getFinalResultColumnKey(key),
      defaultWidth: column?.kind === 'text' ? 132 : 112,
      minWidth: column?.kind === 'text' ? 104 : 96,
      maxWidth: column?.kind === 'text' ? 320 : 180,
    };
  }),
  { key: 'status', defaultWidth: 116, minWidth: 104 },
];

export const PRESET_TABS: { key: LineColumnPreset; label: string }[] = [
  { key: 'item-data', label: '1 Item Data' },
  { key: 'import-freight-cif', label: '2 Purchase Term' },
  { key: 'purchase-order-price', label: '3 Order Price' },
  { key: 'landed-sales-price', label: '4 Landed Cost' },
  { key: 'uom-selling-terms', label: '5 Sales Term' },
];
