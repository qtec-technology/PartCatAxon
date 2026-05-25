'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ChangeEvent, type InputHTMLAttributes, type ReactNode } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  BadgeDollarSign,
  Boxes,
  Calculator,
  Check,
  CheckCircle2,
  Edit3,
  Eye,
  FileText,
  History,
  Info,
  Loader2,
  RotateCcw,
  Save,
  Search,
  Trash2,
  Trophy,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';

import type {
  AllocationLineResult,
  AllocationLineSource,
  AllocationPreview,
  AllocationRunStatus,
  BulkCostInput,
  DocumentFees,
  FinalResultColumns,
} from './bulk-cost.types';
import { EMPTY_BULK_COST_INPUT, ITEM_GROUP_OPTIONS, SHIP_MODE_LABELS, formatItemGroup, formatShipMode } from './bulk-cost.types';
import { buildBulkCostFormulaAudit } from './bulk-cost.formula-audit';
import {
  FINAL_RESULT_COLS,
  FINAL_RESULT_COLS_BY_KEY,
  type FinalResultColumnDefinition,
  type FinalResultKey,
} from './bulk-cost.final-result';
import { buildBulkCostRunDraftPayload, calculateBulkCostPreview, loadBulkCostRun, saveBulkCostRunDraft, updateBulkCostRunStatus } from './bulk-cost.api';
import { useResizableTableColumns, type ResizableTableColumn } from './useResizableTableColumns';
import {
  mapBulkCostToTermFormData,
  mapBulkCostToTermCalcResults,
  mapBulkCostToItemData,
  storeBulkCostPreview,
} from './bulk-cost.preview';
import type { BulkCostDocumentFeeLineCandidate } from './bulk-cost.document-fees';
import {
  lookupApi,
  type ContactLookupOption,
  type CurrencyLookupOption,
  type LocationLookupOption,
  type LookupOption,
  type SubLocationLookupOption,
} from '../../services/lookup.api';
import { InlineSelect } from '../../components/common/InlineSelect';
import { clientLogger } from '../../utils/logger';

const SHOW_FORMULA = process.env.NEXT_PUBLIC_SHOW_FORMULA === 'true';

const CURRENCY_OPTIONS = ['THB', 'USD', 'EUR', 'JPY', 'GBP', 'CNY', 'SGD', 'HKD', 'KRW', 'AUD', 'CAD'];
const INSURANCE_DEFAULT_CURRENCIES = new Set(['USD', 'AUD', 'EUR', 'SGD']);

const ORDER_TERM_OPTIONS = ['Exwork', 'Ex-work', 'FCA', 'FAS', 'FOB', 'CIF', 'CFR', 'CPT', 'DDP', 'DAP', 'Ex-Factory'];
const TERM_LOCATION_OPTIONS = ['TH', 'US', 'UK', 'SG', 'AE', 'AU', 'CN', 'DE', 'FR', 'JP', 'NL', 'CA', 'MY', 'VN', 'HK'];
const FALLBACK_CURRENCY_LOOKUPS: CurrencyLookupOption[] = CURRENCY_OPTIONS.map((code) => ({
  code,
  name: code,
  exRate: code === 'THB' ? 1 : 0,
}));
const FALLBACK_LOCATION_LOOKUPS: LocationLookupOption[] = TERM_LOCATION_OPTIONS.map((code, index) => ({
  code,
  name: code,
  priority: index,
  zoneName: '',
  zoneRate: 0,
}));
const FALLBACK_ITEM_GROUP_LOOKUPS: LookupOption[] = ITEM_GROUP_OPTIONS.map((option) => ({
  value: option.code,
  label: option.name,
}));

const isAbortError = (error: unknown): boolean =>
  error instanceof DOMException && error.name === 'AbortError';

const SHIP_MODE_OPTIONS = [
  { value: 1, label: 'Air FWD' },
  { value: 2, label: 'Sea' },
  { value: 3, label: 'Truck' },
  { value: 4, label: 'QTEC-MC' },
  { value: 5, label: 'QTEC-Truck' },
  { value: 6, label: 'Air COUR' },
];

/** Scroll every scrollable ancestor so there are at least MIN px below a
 *  native <select> before the browser opens its dropdown.
 *
 *  Strategy:
 *  1. Walk ALL scrollable ancestors (not just the first one) and scroll each
 *     one that has insufficient space below the element.  Stopping at the
 *     first ancestor is wrong when the layout uses nested scroll containers.
 *  2. After walking ancestors, check raw viewport space and scroll the
 *     nearest scrollable ancestor once more if the viewport gap is still
 *     insufficient.
 *  3. MIN is set to 420 px — enough for a 10-item option list on most screens.
 */
const ensureSelectSpaceBelow = (el: HTMLElement): void => {
  if (typeof window === 'undefined') return;
  const MIN = 420;

  // Re-read rect after each scroll so calculations stay accurate.
  const getBottom = () => el.getBoundingClientRect().bottom;

  // Walk every ancestor; collect scrollable ones and scroll each if needed.
  let firstScrollable: Element | null = null;
  let parent = el.parentElement;
  while (parent && parent !== document.body) {
    const s = window.getComputedStyle(parent);
    const oy = s.overflowY;
    const isScrollable =
      /(auto|scroll|overlay)/.test(oy) &&
      parent.scrollHeight > parent.clientHeight;

    if (isScrollable) {
      if (!firstScrollable) firstScrollable = parent;
      const space = parent.getBoundingClientRect().bottom - getBottom();
      if (space < MIN) {
        parent.scrollTop += MIN - space + 8;
      }
    }
    parent = parent.parentElement;
  }

  // Final check: if viewport space is still insufficient, scroll the
  // nearest scrollable ancestor by the remaining deficit.
  const vSpace = window.innerHeight - getBottom();
  if (vSpace < MIN) {
    const deficit = MIN - vSpace + 8;
    if (firstScrollable) {
      firstScrollable.scrollTop += deficit;
    } else {
      window.scrollBy({ top: deficit, behavior: 'auto' });
    }
  }
};

const COST_FIELDS: {
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

const DOC_FEE_FIELDS: { key: keyof DocumentFees; label: string }[] = [
  { key: 'coc', label: 'COC' },
  { key: 'millCert', label: 'Mill' },
  { key: 'testCert', label: 'Test Cert' },
  { key: 'coa', label: 'COA' },
  { key: 'coo', label: 'COO' },
  { key: 'anyOther', label: 'Any Other' },
];

const ALLOC_COLS = [
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

const getDocFeeColumnKey = (key: keyof DocumentFees) => `doc-${key}`;
const getFinalResultColumnKey = (key: FinalResultKey) => `final-${key}`;
const LINE_STICKY_KEYS = ['select', 'delete', 'no', 'description'] as const;

const LINE_TABLE_COLUMNS: ResizableTableColumn[] = [
  { key: 'select', defaultWidth: 72, minWidth: 64 },
  { key: 'delete', defaultWidth: 54, minWidth: 48 },
  { key: 'no', defaultWidth: 58, minWidth: 48 },
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
  { key: 'sspk', defaultWidth: 96, minWidth: 84 },
  { key: 'qoc', defaultWidth: 96, minWidth: 84 },
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
  { key: 'status', defaultWidth: 120, minWidth: 106 },
];

const FINAL_PREVIEW_TABLE_COLUMNS = [
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

type LineColumnPreset = 'overview' | 'docs' | 'pricing' | 'weight' | 'logistics' | 'sales' | 'all';
type ResultView = 'review' | 'formula' | 'full';
type DraftPreviewMode = 'item' | 'term';

const LINE_COLUMN_PRESETS: Record<LineColumnPreset, string[]> = {
  logistics: [
    'select',
    'delete',
    'no',
    'description',
    'orderTerm',
    'location',
    'subLocation',
    'supplierOrderCode',
    'leadTime',
    'moq',
    'importDuty',
    'stkPercent',
    'zoneRate',
    'etPercent',
    'miscTax',
    'scc',
    'status',
  ],
  overview: [
    'select',
    'delete',
    'no',
    'itemGroup',
    'manufacturer',
    'mfgPartNumber',
    'description',
    'itemCategory',
    'customerStockCode',
    'uom',
    'countryOfOrigin',
    'shelfLife',
    'importPermit',
    'permitType',
    'hsCode',
    'status',
  ],
  docs: [
    'select',
    'delete',
    'no',
    'description',
    ...DOC_FEE_FIELDS.map((field) => getDocFeeColumnKey(field.key)),
    'docFeeTotal',
    'status',
  ],
  pricing: [
    'select',
    'delete',
    'no',
    'description',
    'amount',
    'qty',
    'unitPrice',
    'currency',
    'pkhEa',
    'socEa',
    'docFeeTotal',
    'op1Fcy',
    'exRateCol',
    'op1Thb',
    'insPercent',
    'insAmount',
    'status',
  ],
  weight: [
    'select',
    'delete',
    'no',
    'description',
    'manufacturer',
    'mfgPartNumber',
    'qty',
    'shipMode',
    'length',
    'width',
    'height',
    'dimUnit',
    'itemWeight',
    'dimWeight',
    'chargeableWeight',
    'shipWeight',
    'freightRate',
    'status',
  ],
  sales: [
    'select',
    'delete',
    'no',
    'description',
    'purchaseUOM',
    'uom',
    'stockConversion',
    'salesTerm',
    'salesSubLocation',
    'saleUOM',
    'saleConversion',
    'sspk',
    'qoc',
    'markupPercent',
    'status',
  ],
  all: LINE_TABLE_COLUMNS.filter((c) => c.key !== 'matchStatus').map((column) => column.key),
};

const EDITABLE_LINE_COLUMNS_BY_PRESET: Record<LineColumnPreset, string[]> = {
  overview: [
    'select',
    'delete',
    'itemGroup',
    'itemCategory',
    'customerStockCode',
    'description',
    'manufacturer',
    'mfgPartNumber',
    'uom',
    'countryOfOrigin',
    'shelfLife',
    'importPermit',
    'permitType',
    'hsCode',
  ],
  docs: [
    'select',
    'delete',
    'description',
    ...DOC_FEE_FIELDS.map((field) => getDocFeeColumnKey(field.key)),
  ],
  pricing: [
    'select',
    'delete',
    'qty',
    'unitPrice',
    'currency',
    'insPercent',
  ],
  weight: ['select', 'delete', 'shipMode', 'dimUnit', 'length', 'width', 'height', 'itemWeight', 'shipWeight', 'freightRate'],
  logistics: ['select', 'delete', 'orderTerm', 'location', 'subLocation', 'supplierOrderCode', 'deliveryLeadTime', 'moq', 'importDuty', 'stkPercent', 'zoneRate', 'etPercent', 'miscTax', 'scc'],
  sales: ['select', 'delete', 'purchaseUOM', 'uom', 'stockConversion', 'salesTerm', 'salesSubLocation', 'saleUOM', 'saleConversion', 'sspk', 'qoc', 'markupPercent'],
  all: [],
};

function canEditLineColumnInPreset(preset: LineColumnPreset, columnKey: string): boolean {
  return EDITABLE_LINE_COLUMNS_BY_PRESET[preset].includes(columnKey);
}

const LINE_COLUMN_LABELS: Record<string, string> = {
  select: 'Select',
  delete: 'Del',
  no: 'No',
  itemGroup: 'Item Group',
  itemCategory: 'Category',
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
  hsCode: 'HS Code',
  countryOfOrigin: 'Country of Origin',
  leadTime: 'Lead Time',
  orderTerm: 'Purchase Term',
  location: 'Term Location',
  subLocation: 'Sub Location',
  shipMode: 'Ship Mode',
  salesTerm: 'Sales Term',
  salesSubLocation: 'Sales Sub Loc',
  importPermit: 'Permit',
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
  stkPercent: 'STK %',
  zoneRate: 'Zone Rate',
  etPercent: 'ET %',
  miscTax: 'ETC',
  scc: 'SCC',
  sspk: 'SPK',
  qoc: 'QOC',
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
  op1Thb: 'OP2(THB)',
  status: 'Status',
};

for (const field of DOC_FEE_FIELDS) {
  LINE_COLUMN_LABELS[getDocFeeColumnKey(field.key)] = field.label;
}

const REVIEW_RESULT_KEYS: FinalResultKey[] = [
  // ② Foreign Currency (USD) / Each — per-line allocated costs in source currency
  'productCost', 'pkh', 'soc', 'docFees', 'op1Source', 'currency', 'rateExchange',
  // ③ THB & CIF / Each — converted to THB
  'op1', 'ins', 'frQTEC', 'cifQTEC',
  // ④ Landed Cost / Each
  'selectedDuty', 'wireTT', 'customClear', 'preQLC', 'qlc',
  // ⑤ Sales Price (THB)
  'totalQLC', 'markup', 'roundUp',
];

const REVIEW_RESULT_GROUPS = [
  { label: 'Foreign Currency / Each',  className: 'th-group th-group-fcurr',   count: 7 },
  { label: 'THB & CIF / Each',         className: 'th-group th-group-thbcif',  count: 4 },
  { label: 'Landed Cost / Each',       className: 'th-group th-group-landed',  count: 5 },
  { label: 'SALES PRICE (THB)',        className: 'th-group th-group-sale',    count: 3 },
] as const;

const REVIEW_LABEL_OVERRIDE: Partial<Record<FinalResultKey, string>> = {
  productCost: 'PCS',
  docFees:     'Doc(ea)',
  op1Source:   'OP1(USD)',
  op1:         'OP2(THB)',
  cifQTEC:     'CIF(THB)',
  selectedDuty:'Duty(DT)',
  wireTT:      'TT+CC',
  preQLC:      'preQLC',
  totalQLC:    'Total Price',
  roundUp:     'Sale Price',
};

const SALE_PRICE_KEYS  = new Set<FinalResultKey>(['totalQLC', 'markup', 'roundUp']);
const LANDED_KEYS      = new Set<FinalResultKey>(['selectedDuty', 'wireTT', 'customClear', 'preQLC', 'qlc']);
const THBCIF_KEYS      = new Set<FinalResultKey>(['op1', 'ins', 'frQTEC', 'cifQTEC']);

function getReviewColClass(key: FinalResultKey): string {
  if (SALE_PRICE_KEYS.has(key)) return 'th-group-sale';
  if (LANDED_KEYS.has(key))     return 'th-group-landed';
  if (THBCIF_KEYS.has(key))     return 'th-group-thbcif';
  return 'th-group-fcurr';
}

const FORMULA_RESULT_KEYS: FinalResultKey[] = [
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

const FINAL_RESULT_COL_BY_KEY = FINAL_RESULT_COLS_BY_KEY;

const BASE_REVIEW_RESULT_COLUMNS: ResizableTableColumn[] = [
  { key: 'rowNo', defaultWidth: 58, minWidth: 48 },
  { key: 'itemGroup', defaultWidth: 116, minWidth: 96 },
  { key: 'supplierOrderCode', defaultWidth: 154, minWidth: 124, maxWidth: 320 },
  { key: 'description', defaultWidth: 420, minWidth: 220, maxWidth: 780 },
  { key: 'qty', defaultWidth: 96, minWidth: 76 },
  { key: 'uom', defaultWidth: 76, minWidth: 64 },
];

const REVIEW_RESULT_TABLE_COLUMNS: ResizableTableColumn[] = [
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


const FORMULA_PREVIEW_TABLE_COLUMNS: ResizableTableColumn[] = [
  ...BASE_REVIEW_RESULT_COLUMNS,
  { key: 'amount', defaultWidth: 126, minWidth: 104 },
  ...ALLOC_COLS.map((column) => ({ key: `alloc-${column.key}`, defaultWidth: 112, minWidth: 96 })),
  ...FORMULA_RESULT_KEYS.map((key) => {
    const column = FINAL_RESULT_COL_BY_KEY.get(key);
    return {
      key: getFinalResultColumnKey(key),
      defaultWidth: column?.kind === 'text' ? 132 : 112,
      minWidth: column?.kind === 'text' ? 104 : 96,
      maxWidth: column?.kind === 'text' ? 320 : 180,
    };
  }),
  { key: 'status', defaultWidth: 116, minWidth: 104 },
];

type ResizableTableSizing = ReturnType<typeof useResizableTableColumns>;

interface BulkCostWorkspaceProps {
  supplierCode: string;
  supplierName: string;
  /** When re-opening a saved run from the list, pass its runId here. */
  savedRunId?: number | null;
  /** Label for the back button — defaults to 'Back to Allocations'. */
  backLabel?: string;
  onBack: () => void;
}

type PreviewEdits = Record<string, Partial<FinalResultColumns>>;

interface GlobalLineDefaults {
  insPercent: number;
  importDutyPercent: number;
  stkPercent: number;
  sspk: number;
  qoc: number;
  markupPercent: number;
}

function defaultInsurancePercent(currency: string): number {
  const normalized = String(currency || '').trim().toUpperCase();
  if (!normalized) return 1;
  return INSURANCE_DEFAULT_CURRENCIES.has(normalized) ? 1 : 0;
}

function buildGlobalDefaults(currency: string): GlobalLineDefaults {
  return {
    insPercent: defaultInsurancePercent(currency),
    importDutyPercent: 0,
    stkPercent: 0,
    sspk: 0,
    qoc: 0,
    markupPercent: 0,
  };
}

function globalDefaultsFromLine(line: AllocationLineSource | undefined, currency: string): GlobalLineDefaults {
  if (!line) return buildGlobalDefaults(currency);
  return {
    insPercent: line.insPercent,
    importDutyPercent: line.importDutyPercent,
    stkPercent: line.stkPercent,
    sspk: line.sspk,
    qoc: line.qoc,
    markupPercent: line.markupPercent,
  };
}

function ensureCurrencyLookupOption(
  options: CurrencyLookupOption[],
  currency: string,
  exchangeRate: number,
): CurrencyLookupOption[] {
  const current = String(currency || '').trim();
  if (!current || options.some((row) => row.code.toUpperCase() === current.toUpperCase())) return options;
  return [{ code: current, name: current, exRate: exchangeRate || 0 }, ...options];
}

function ensureTextOption(options: string[], current: string): string[] {
  const value = String(current || '').trim();
  if (!value || options.some((row) => row.toUpperCase() === value.toUpperCase())) return options;
  return [value, ...options];
}

function ensureLookupOption(options: LookupOption[], current: string): LookupOption[] {
  const value = String(current || '').trim();
  if (!value || options.some((row) => row.value.toUpperCase() === value.toUpperCase())) return options;
  return [{ value, label: value }, ...options];
}

function ensureLocationLookupOption(
  options: LocationLookupOption[],
  location: string,
): LocationLookupOption[] {
  const current = String(location || '').trim();
  if (!current) return options;
  const exists = options.some((row) =>
    row.name.toUpperCase() === current.toUpperCase() || row.code.toUpperCase() === current.toUpperCase(),
  );
  if (exists) return options;
  return [{ code: current, name: current, priority: 0, zoneName: '', zoneRate: 0 }, ...options];
}

function currencyOptionLabel(option: CurrencyLookupOption): string {
  const name = option.name && option.name !== option.code ? ` - ${option.name}` : '';
  return `${option.code}${name}`;
}

function locationOptionLabel(option: LocationLookupOption): string {
  return option.name || option.code;
}

function subLocationOptionValue(option: SubLocationLookupOption): string {
  return option.name || option.code;
}

type SourceTableView = 'latest' | 'origin' | 'changes';
type EditableLineTextField = keyof Pick<
  AllocationLineSource,
  | 'itemGroup'
  | 'itemCategory'
  | 'customerStockCode'
  | 'sapDescription'
  | 'manufacturer'
  | 'mfgPartNumber'
  | 'supplierOrderCode'
  | 'uom'
  | 'purchaseUOM'
  | 'stockUOM'
  | 'saleUOM'
  | 'currency'
  | 'hsCode'
  | 'countryOfOrigin'
  | 'deliveryLeadTime'
  | 'orderTerm'
  | 'location'
  | 'subLocation'
  | 'salesTerm'
  | 'salesSubLocation'
  | 'importPermit'
  | 'permitType'
  | 'shelfLifeRequire'
>;
type EditableLineNumberField = keyof Pick<
  AllocationLineSource,
  | 'qty'
  | 'unitPrice'
  | 'importDutyPercent'
  | 'insPercent'
  | 'stkPercent'
  | 'sspk'
  | 'qoc'
  | 'markupPercent'
  | 'stockConversion'
  | 'saleConversion'
  | 'length'
  | 'width'
  | 'height'
  | 'dimUnit'
  | 'shipModeNo'
  | 'zoneRate'
  | 'etPercent'
  | 'miscTax'
  | 'scc'
>;
type EditableLineNullableNumberField = keyof Pick<
  AllocationLineSource,
  'itemWeightPerEach' | 'dimensionWeightPerEach' | 'shippingWeightPerEach' | 'freightRate' | 'moq'
>;
type LineFieldKey =
  | keyof AllocationLineSource
  | `docFee.${keyof DocumentFees}`;

interface LineChange {
  lineKey: string;
  no: number;
  itemCode: string;
  fieldKey: LineFieldKey;
  label: string;
  originValue: string;
  latestValue: string;
}

const parseNumericInput = (raw: string): number => {
  const normalized = raw.replace(/,/g, '').trim();
  if (!normalized) return 0;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const parseNullableNumericInput = (raw: string): number | null => {
  const normalized = raw.replace(/,/g, '').trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const round6 = (value: number): number => Math.round(value * 1_000_000) / 1_000_000;

const cloneLineForSupplier = (
  line: AllocationLineSource,
  supplierCode: string,
  supplierName: string,
): AllocationLineSource => ({
  ...line,
  docFee: { ...line.docFee },
  vendorCode: supplierCode,
  vendorName: supplierName,
});

const calcLineDimWeight = (line: AllocationLineSource): number => {
  const vol = line.length * line.width * line.height;
  if (vol === 0 || line.shipModeNo < 1) return 0;
  const adjustedVol = line.dimUnit === 2 ? vol * 17 : vol;
  switch (line.shipModeNo) {
    case 1: case 4: case 5: return adjustedVol / 6000;
    case 2: return Math.max(adjustedVol / 1000, 1000);
    case 3: case 6: return adjustedVol / 5000;
    default: return adjustedVol / 6000;
  }
};

const ceilToHalf = (v: number): number => Math.ceil(v * 2) / 2;

const getChargeableWeightPerEach = (line: AllocationLineSource): number | null => {
  const hasDimWeight = line.dimensionWeightPerEach !== null;
  const hasItemWeight = line.itemWeightPerEach !== null;
  if (!hasDimWeight && !hasItemWeight) return null;
  return round6(Math.max(line.dimensionWeightPerEach ?? 0, line.itemWeightPerEach ?? 0));
};

const resolveLineWeight = (line: AllocationLineSource): number | null => {
  if (line.shippingWeightPerEach !== null && line.shippingWeightPerEach > 0) return line.shippingWeightPerEach;
  if (line.dimensionWeightPerEach !== null && line.dimensionWeightPerEach > 0) return line.dimensionWeightPerEach;
  if (line.itemWeightPerEach !== null && line.itemWeightPerEach > 0) return line.itemWeightPerEach;
  return null;
};

const recalcLineDerivedValues = (line: AllocationLineSource): AllocationLineSource => {
  const qty = Number.isFinite(Number(line.qty)) ? Number(line.qty) : 0;
  const unitPrice = Number.isFinite(Number(line.unitPrice)) ? Number(line.unitPrice) : 0;
  const amount = round6(qty * unitPrice);

  const hasDims = line.length > 0 && line.width > 0 && line.height > 0;
  const hasItemWt = line.itemWeightPerEach !== null;

  let dimensionWeightPerEach: number | null = null;
  let shippingWeightPerEach: number | null = null;

  if (hasDims || hasItemWt) {
    const dw = hasDims ? round6(calcLineDimWeight(line)) : 0;
    const iw = line.itemWeightPerEach ?? 0;
    dimensionWeightPerEach = hasDims ? dw : null;
    shippingWeightPerEach = ceilToHalf(Math.max(dw, iw));
  }

  const totalShippingWeight = shippingWeightPerEach === null
    ? null
    : round6(shippingWeightPerEach * qty);

  return {
    ...line,
    amount,
    dimensionWeightPerEach,
    shippingWeightPerEach,
    totalShippingWeight,
  };
};

let _lineSeq = 0;
const createBlankLine = (
  no: number,
  vendorCode: string,
  vendorName: string,
  costs: BulkCostInput,
  defaults: GlobalLineDefaults = buildGlobalDefaults(costs.currency),
): AllocationLineSource => {
  _lineSeq += 1;
  return {
    lineKey: `MANUAL-${Date.now()}-${_lineSeq}`,
    no,
    itemGroup: '104',
    itemCategory: '',
    customerStockCode: '',
    sapDescription: '',
    manufacturer: '',
    mfgPartNumber: '',
    supplierOrderCode: '',
    ggCode: '',
    qty: 1,
    uom: 'PCS',
    unitPrice: 0,
    amount: 0,
    currency: costs.currency,
    countryOfOrigin: '',
    hsCode: '',
    docFee: { coc: 0, millCert: 0, testCert: 0, coa: 0, coo: 0, anyOther: 0 },
    deliveryLeadTime: '',
    orderTerm: costs.orderTerm,
    location: costs.location,
    subLocation: costs.subLocation,
    salesTerm: '',
    salesSubLocation: '',
    importPermit: 'No',
    permitType: '',
    shelfLifeRequire: 'No',
    itemWeightPerEach: null,
    dimensionWeightPerEach: null,
    shippingWeightPerEach: null,
    totalShippingWeight: null,
    importDutyPercent: defaults.importDutyPercent,
    vendorCode,
    vendorName,
    termId: null,
    itemCode: '',
    purchaseUOM: '',
    stockUOM: 'EA',
    saleUOM: '',
    stockConversion: 1,
    saleConversion: 1,
    moq: null,
    insPercent: defaults.insPercent,
    shipModeNo: costs.shipModeNo,
    freightRate: 0,
    dimUnit: 1,
    length: 0,
    width: 0,
    height: 0,
    zoneRate: 0,
    etPercent: 0,
    miscTax: 0,
    scc: 0,
    stkPercent: defaults.stkPercent,
    markupPercent: defaults.markupPercent,
    sspk: defaults.sspk,
    qoc: defaults.qoc,
  };
};

const trackedLineFields: { key: LineFieldKey; label: string; format: (line: AllocationLineSource) => string }[] = [
  { key: 'itemGroup', label: 'Group', format: (line) => formatItemGroup(line.itemGroup) },
  { key: 'itemCategory', label: 'Category', format: (line) => line.itemCategory },
  { key: 'customerStockCode', label: 'Cust Stock Code', format: (line) => line.customerStockCode },
  { key: 'sapDescription', label: 'Description', format: (line) => line.sapDescription },
  { key: 'manufacturer', label: 'MFG', format: (line) => line.manufacturer },
  { key: 'mfgPartNumber', label: 'MFG P/N', format: (line) => line.mfgPartNumber },
  { key: 'supplierOrderCode', label: 'Supp Order Code', format: (line) => line.supplierOrderCode },
  { key: 'qty', label: 'Qty', format: (line) => fmtPlain(line.qty) },
  { key: 'uom', label: 'UOM', format: (line) => line.uom },
  { key: 'unitPrice', label: 'Unit Price', format: (line) => fmtPlain(line.unitPrice) },
  { key: 'currency', label: 'Currency', format: (line) => line.currency },
  { key: 'shipModeNo', label: 'Ship Mode', format: (line) => formatShipMode(line.shipModeNo) },
  { key: 'subLocation', label: 'Sub Location', format: (line) => line.subLocation },
  { key: 'salesTerm', label: 'Sales Term', format: (line) => line.salesTerm || '' },
  { key: 'salesSubLocation', label: 'Sales Sub Loc', format: (line) => line.salesSubLocation || '' },
  { key: 'hsCode', label: 'HS Code', format: (line) => line.hsCode },
  { key: 'countryOfOrigin', label: 'Country of Origin', format: (line) => line.countryOfOrigin },
  { key: 'deliveryLeadTime', label: 'Lead Time', format: (line) => line.deliveryLeadTime },
  { key: 'moq', label: 'MOQ', format: (line) => fmtNullablePlain(line.moq) },
  { key: 'importPermit', label: 'Permit', format: (line) => formatYesNo(line.importPermit) },
  { key: 'permitType', label: 'Permit Type', format: (line) => line.permitType },
  { key: 'shelfLifeRequire', label: 'Shelf Life', format: (line) => formatYesNo(line.shelfLifeRequire) },
  { key: 'itemWeightPerEach', label: 'Item Weight', format: (line) => fmtNullablePlain(line.itemWeightPerEach) },
  { key: 'dimensionWeightPerEach', label: 'Dim Weight', format: (line) => fmtNullablePlain(line.dimensionWeightPerEach) },
  { key: 'shippingWeightPerEach', label: 'Ship Weight', format: (line) => fmtNullablePlain(line.shippingWeightPerEach) },
  { key: 'length', label: 'Length', format: (line) => fmtPlain(line.length) },
  { key: 'width', label: 'Width', format: (line) => fmtPlain(line.width) },
  { key: 'height', label: 'Height', format: (line) => fmtPlain(line.height) },
  { key: 'dimUnit', label: 'Dim Unit', format: (line) => (line.dimUnit === 2 ? 'INCH' : 'CM') },
  { key: 'importDutyPercent', label: 'Duty %', format: (line) => fmtPlain(line.importDutyPercent) },
  { key: 'stkPercent', label: 'STK %', format: (line) => fmtPlain(line.stkPercent) },
  { key: 'zoneRate', label: 'Zone Rate', format: (line) => fmtPlain(line.zoneRate) },
  { key: 'etPercent', label: 'ET %', format: (line) => fmtPlain(line.etPercent) },
  { key: 'miscTax', label: 'ETC', format: (line) => fmtPlain(line.miscTax) },
  { key: 'scc', label: 'SCC', format: (line) => fmtPlain(line.scc) },
  ...DOC_FEE_FIELDS.map((field) => ({
    key: `docFee.${field.key}` as LineFieldKey,
    label: field.label,
    format: (line: AllocationLineSource) => fmtPlain(line.docFee[field.key]),
  })),
];

const valuesEqual = (left: string, right: string): boolean => left.trim() === right.trim();

function formatYesNo(value: string): string {
  const normalized = value.trim().toLowerCase();
  return normalized === 'yes' || normalized === 'y' || normalized === '1' || normalized === 'true'
    ? 'Yes'
    : 'No';
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

interface ValidationIssue {
  field: string;
  label: string;
  type: 'error' | 'warning';
  message: string;
  value?: any;
}

interface ValidationResult {
  status: 'ready' | 'missing' | 'warning';
  itemIssues: ValidationIssue[];
  termIssues: ValidationIssue[];
  calcIssues: ValidationIssue[];
  traceIssues: ValidationIssue[];
}

function validateLineCandidate(
  line: AllocationLineSource,
  costs: BulkCostInput,
  runInfo: {
    runId: number | null;
    revisionGroupId: number | null;
    revisionNo: number | null;
    status: string;
    supplierCode: string;
    cntctCode?: string | null;
  },
  finalResult?: FinalResultColumns,
): ValidationResult {
  const itemIssues: ValidationIssue[] = [];
  const termIssues: ValidationIssue[] = [];
  const calcIssues: ValidationIssue[] = [];
  const traceIssues: ValidationIssue[] = [];

  // 1. Item Candidate Validation
  if (!line.itemGroup || line.itemGroup.trim() === '') {
    itemIssues.push({ field: 'itemGroup', label: 'Item Group', type: 'error', message: 'Item Group is required for code generation.', value: line.itemGroup });
  }
  if (!line.manufacturer || line.manufacturer.trim() === '') {
    itemIssues.push({ field: 'manufacturer', label: 'Mfr Brand', type: 'error', message: 'Manufacturer Brand is required.', value: line.manufacturer });
  }
  if (!line.mfgPartNumber || line.mfgPartNumber.trim() === '') {
    itemIssues.push({ field: 'mfgPartNumber', label: 'Mfr Catalog No', type: 'error', message: 'Manufacturer Catalog Number is required.', value: line.mfgPartNumber });
  }
  if (!line.sapDescription || line.sapDescription.trim() === '') {
    itemIssues.push({ field: 'sapDescription', label: 'Item Description', type: 'error', message: 'Item Description is required.', value: line.sapDescription });
  }
  if (!line.uom || line.uom.trim() === '') {
    itemIssues.push({ field: 'uom', label: 'Stock UOM', type: 'error', message: 'Stock UOM is required.', value: line.uom });
  }
  if (!line.countryOfOrigin || line.countryOfOrigin.trim() === '') {
    itemIssues.push({ field: 'countryOfOrigin', label: 'Country of Origin', type: 'error', message: 'Country of Origin is required for imports.', value: line.countryOfOrigin });
  }

  const permitReq = line.importPermit === 'Yes' || line.importPermit === '1' || line.importPermit === 'true' || line.importPermit === 'Y';
  if (permitReq && (!line.permitType || line.permitType.trim() === '')) {
    itemIssues.push({ field: 'permitType', label: 'Permit Type', type: 'error', message: 'Permit Type is required when Import Permit is enabled.', value: line.permitType });
  }
  if (!line.hsCode || line.hsCode.trim() === '') {
    itemIssues.push({ field: 'hsCode', label: 'HS Code', type: 'warning', message: 'HS Code is missing (recommended).', value: line.hsCode });
  }

  // 2. Term Candidate Validation
  const supplierCodeVal = line.vendorCode || runInfo.supplierCode;
  if (!supplierCodeVal || supplierCodeVal.trim() === '') {
    termIssues.push({ field: 'vendorCode', label: 'Supplier Code', type: 'error', message: 'Supplier Code is required.', value: supplierCodeVal });
  }
  if (!line.supplierOrderCode || line.supplierOrderCode.trim() === '') {
    termIssues.push({ field: 'supplierOrderCode', label: 'Supp Order Code', type: 'warning', message: 'Supplier Order Code/GG Code is blank.', value: line.supplierOrderCode });
  }

  const contactPersonVal = costs.contactPerson;
  if (!contactPersonVal || contactPersonVal.trim() === '') {
    termIssues.push({ field: 'contactPerson', label: 'Contact Person', type: 'warning', message: 'Contact Person is missing.', value: contactPersonVal });
  } else if (!runInfo.cntctCode) {
    termIssues.push({ field: 'contactPerson', label: 'Contact Person', type: 'warning', message: 'Contact Person Code resolution required before Term master write (เก็บเป็นชื่อใน revision เท่านั้น ยังไม่ได้แปลงเป็น code).', value: contactPersonVal });
  }

  const orderTerm = line.orderTerm || costs.orderTerm;
  if (!orderTerm || orderTerm.trim() === '') {
    termIssues.push({ field: 'orderTerm', label: 'Purchase Term', type: 'error', message: 'Purchase Term is required.', value: orderTerm });
  }

  const location = line.location || costs.location;
  if (!location || location.trim() === '') {
    termIssues.push({ field: 'location', label: 'Term Location', type: 'error', message: 'Term Location is required.', value: location });
  }

  const subLocation = line.subLocation || costs.subLocation;
  if (!subLocation || subLocation.trim() === '') {
    termIssues.push({ field: 'subLocation', label: 'Purchase Sub Location', type: 'error', message: 'Purchase Sub Location is required.', value: subLocation });
  }

  if (line.salesTerm) {
    if (!line.salesSubLocation || line.salesSubLocation.trim() === '') {
      termIssues.push({ field: 'salesSubLocation', label: 'Sales Sub Location', type: 'error', message: 'Sales Sub Location is required when Sales Term is set.', value: line.salesSubLocation });
    }
  }

  const currency = line.currency || costs.currency;
  if (!currency || currency.trim() === '') {
    termIssues.push({ field: 'currency', label: 'Currency', type: 'error', message: 'Currency is required.', value: currency });
  }

  const exchangeRate = costs.exchangeRate;
  if (!exchangeRate || exchangeRate <= 0) {
    termIssues.push({ field: 'exchangeRate', label: 'Exchange Rate', type: 'error', message: 'Exchange Rate must be greater than 0.', value: exchangeRate });
  }

  if (line.unitPrice <= 0) {
    termIssues.push({ field: 'unitPrice', label: 'Product Cost (PCS)', type: 'error', message: 'Product Cost must be greater than 0.', value: line.unitPrice });
  }

  if (line.qty <= 0) {
    termIssues.push({ field: 'qty', label: 'Quantity', type: 'error', message: 'Quantity must be greater than 0.', value: line.qty });
  }

  if (!line.purchaseUOM || line.purchaseUOM.trim() === '') {
    termIssues.push({ field: 'purchaseUOM', label: 'Purchase UOM', type: 'error', message: 'Purchase UOM is required.', value: line.purchaseUOM });
  }
  if (!line.saleUOM || line.saleUOM.trim() === '') {
    termIssues.push({ field: 'saleUOM', label: 'Sales UOM', type: 'error', message: 'Sales UOM is required.', value: line.saleUOM });
  }
  if (!line.stockConversion || line.stockConversion <= 0) {
    termIssues.push({ field: 'stockConversion', label: 'Stock Conv (NumInBuy)', type: 'error', message: 'Stock UOM Conversion factor must be greater than 0.', value: line.stockConversion });
  }
  if (!line.saleConversion || line.saleConversion <= 0) {
    termIssues.push({ field: 'saleConversion', label: 'Sale Conv (NumInSale)', type: 'error', message: 'Sales UOM Conversion factor must be greater than 0.', value: line.saleConversion });
  }

  const shipModeNo = line.shipModeNo !== undefined && line.shipModeNo >= 0 ? line.shipModeNo : costs.shipModeNo;
  if (shipModeNo === undefined || shipModeNo < 0) {
    termIssues.push({ field: 'shipModeNo', label: 'Ship Mode', type: 'error', message: 'Ship Mode is required.', value: shipModeNo });
  }

  // 3. Calculation/Result Validation
  if (!finalResult) {
    calcIssues.push({ field: 'calculation', label: 'Calculation Output', type: 'error', message: 'Calculation result is not available. Please run CAL first.' });
  } else {
    const checkCalc = (val: any, fieldName: string, label: string) => {
      if (val === undefined || val === null || Number.isNaN(Number(val))) {
        calcIssues.push({ field: fieldName, label, type: 'error', message: `${label} calculation output is missing or invalid.`, value: val });
      }
    };
    checkCalc(finalResult.op1Source, 'op1Source', 'OP1 (Source)');
    checkCalc(finalResult.op1, 'op1', 'OP1 (THB)');
    checkCalc(finalResult.op2, 'op2', 'OP2 (THB)');
    checkCalc(finalResult.shipWeightCal, 'shipWeightCal', 'Ship Weight Cal (kg)');
    checkCalc(finalResult.frQTEC, 'frQTEC', 'Allocated Freight (FR)');
    checkCalc(finalResult.ins, 'ins', 'Insurance (INS)');
    checkCalc(finalResult.cifQTEC, 'cifQTEC', 'CIF Price');
    checkCalc(finalResult.selectedDuty, 'selectedDuty', 'Import Duty Tax');
    checkCalc(finalResult.qlc, 'qlc', 'Landed Cost (QLC)');
    checkCalc(finalResult.totalQLC, 'totalQLC', 'Total QLC');
    checkCalc(finalResult.roundUp, 'roundUp', 'Sales Price');
  }

  // 4. Traceability/Source Validation
  if (!runInfo.runId) {
    traceIssues.push({ field: 'runId', label: 'Run ID', type: 'error', message: 'Run ID is missing (Run must be saved).' });
  }
  if (!runInfo.revisionGroupId) {
    traceIssues.push({ field: 'revisionGroupId', label: 'Revision Group ID', type: 'error', message: 'Revision Group ID is missing.' });
  }
  if (!runInfo.revisionNo) {
    traceIssues.push({ field: 'revisionNo', label: 'Revision No', type: 'error', message: 'Revision Number is missing.' });
  }

  const createdBy = costs.saleIncharge;
  if (!createdBy || createdBy.trim() === '') {
    traceIssues.push({ field: 'saleIncharge', label: 'Saved By', type: 'warning', message: 'Saved By user metadata is blank.' });
  }

  // Aggregate Status
  let status: 'ready' | 'missing' | 'warning' = 'ready';
  const hasErrors =
    itemIssues.some(i => i.type === 'error') ||
    termIssues.some(i => i.type === 'error') ||
    calcIssues.some(i => i.type === 'error') ||
    traceIssues.some(i => i.type === 'error');
  const hasWarnings =
    itemIssues.some(i => i.type === 'warning') ||
    termIssues.some(i => i.type === 'warning') ||
    calcIssues.some(i => i.type === 'warning') ||
    traceIssues.some(i => i.type === 'warning');

  if (hasErrors) {
    status = 'missing';
  } else if (hasWarnings) {
    status = 'warning';
  }

  return {
    status,
    itemIssues,
    termIssues,
    calcIssues,
    traceIssues
  };
}

function ValidationFieldRow({
  label,
  value,
  issue,
}: {
  label: string;
  value?: string | number;
  issue?: ValidationIssue;
}) {
  const isError = issue?.type === 'error';
  const isWarning = issue?.type === 'warning';
  const displayValue = value !== undefined ? String(value) : '';

  let rowClass = 'review-validation-row--ok';
  let icon = <CheckCircle2 size={14} style={{ color: '#10b981' }} />;
  if (isError) {
    rowClass = 'review-validation-row--error';
    icon = <XCircle size={14} style={{ color: '#ef4444' }} />;
  } else if (isWarning) {
    rowClass = 'review-validation-row--warning';
    icon = <AlertTriangle size={14} style={{ color: '#f59e0b' }} />;
  }

  return (
    <div className={`review-validation-row ${rowClass}`}>
      <div className="review-validation-row-icon">{icon}</div>
      <div className="review-validation-row-content">
        <div className="review-validation-row-label">{label}</div>
        {issue ? (
          <div className="review-validation-row-message" style={{ color: isError ? '#dc2626' : '#d97706', fontWeight: 600 }}>
            {issue.message}
          </div>
        ) : (
          <div className="review-validation-row-value">{displayValue || '-'}</div>
        )}
      </div>
    </div>
  );
}

export function BulkCostWorkspace({ supplierCode, supplierName, savedRunId: initialSavedRunId = null, backLabel = 'Back to Workspace Runs', onBack }: BulkCostWorkspaceProps) {
  const lineTableSizing = useResizableTableColumns('bulk-cost-source-lines', LINE_TABLE_COLUMNS);
  const reviewTableSizing = useResizableTableColumns('bulk-cost-result-review', REVIEW_RESULT_TABLE_COLUMNS);
  const formulaTableSizing = useResizableTableColumns('bulk-cost-result-formula', FORMULA_PREVIEW_TABLE_COLUMNS);
  const fullTableSizing = useResizableTableColumns('bulk-cost-result-full', FINAL_PREVIEW_TABLE_COLUMNS);
  const initialLines = useMemo<AllocationLineSource[]>(() => [], []);
  const initialCosts = useMemo<BulkCostInput>(() => ({ ...EMPTY_BULK_COST_INPUT }), []);
  const isRestoringMode = initialSavedRunId !== null;
  const [sourceView, setSourceView] = useState<SourceTableView>('latest');
  const [lineColumnPreset, setLineColumnPreset] = useState<LineColumnPreset>('overview');
  const [resultView, setResultView] = useState<ResultView>('review');
  const [originLines, setOriginLines] = useState<AllocationLineSource[]>(() =>
    isRestoringMode ? [] : initialLines.map((line) => cloneLineForSupplier(line, supplierCode, supplierName)),
  );
  const [allLines, setAllLines] = useState<AllocationLineSource[]>(() =>
    isRestoringMode ? [] : initialLines.map((line) => cloneLineForSupplier(line, supplierCode, supplierName)),
  );
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(
    () => isRestoringMode ? new Set() : new Set(initialLines.map((line) => line.lineKey)),
  );
  const [costs, setCosts] = useState<BulkCostInput>(() => isRestoringMode ? { ...EMPTY_BULK_COST_INPUT } : initialCosts);
  const [globalDefaults, setGlobalDefaults] = useState<GlobalLineDefaults>(() => buildGlobalDefaults(initialCosts.currency));
  const [currencyLookups, setCurrencyLookups] = useState<CurrencyLookupOption[]>(FALLBACK_CURRENCY_LOOKUPS);
  const [orderTermLookups, setOrderTermLookups] = useState<string[]>(ORDER_TERM_OPTIONS);
  const [locationLookups, setLocationLookups] = useState<LocationLookupOption[]>(FALLBACK_LOCATION_LOOKUPS);
  const [contactLookups, setContactLookups] = useState<ContactLookupOption[]>([]);
  const [subLocationLookups, setSubLocationLookups] = useState<SubLocationLookupOption[]>([]);
  const [salesSubLocationLookups, setSalesSubLocationLookups] = useState<string[]>([]);
  const [subLocationsByLocation, setSubLocationsByLocation] = useState<Record<string, string[]>>({});
  const [uomLookups, setUomLookups] = useState<Array<{ value: string; label: string }>>([]);
  const [itemGroupLookups, setItemGroupLookups] = useState<LookupOption[]>(FALLBACK_ITEM_GROUP_LOOKUPS);
  const [itemCategoryLookups, setItemCategoryLookups] = useState<LookupOption[]>([]);
  const [permitTypeLookups, setPermitTypeLookups] = useState<LookupOption[]>([]);
  const [countryLookups, setCountryLookups] = useState<LookupOption[]>([]);
  const [brandLookups, setBrandLookups] = useState<LookupOption[]>([]);
  const [focusedCostInput, setFocusedCostInput] = useState<string | null>(null);
  const [preview, setPreview] = useState<AllocationPreview | null>(null);
  const [previewEdits, setPreviewEdits] = useState<PreviewEdits>({});
  const [calcError, setCalcError] = useState<string | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [isLoadingRun, setIsLoadingRun] = useState(isRestoringMode);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [savedRunId, setSavedRunId] = useState<number | null>(initialSavedRunId);
  const [isReviewFinalizeActive, setIsReviewFinalizeActive] = useState(false);
  const [activeReviewLineKey, setActiveReviewLineKey] = useState<string | null>(null);
  const [revisionSourceRunId, setRevisionSourceRunId] = useState<number | null>(initialSavedRunId);
  const [revisionGroupId, setRevisionGroupId] = useState<number | null>(initialSavedRunId);
  const [revisionNo, setRevisionNo] = useState<number | null>(null);
  const [runStatus, setRunStatus] = useState<AllocationRunStatus>('DRAFT');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Restore saved run state on mount
  useEffect(() => {
    if (!initialSavedRunId) return;
    let cancelled = false;
    loadBulkCostRun(initialSavedRunId).then((run) => {
      if (cancelled) return;
      const latestLines = run.lines.map((l) => l.latestSnapshot);
      const originLinesData = run.lines.map((l) => l.originSnapshot ?? l.latestSnapshot);
      if (latestLines.length > 0) {
        setAllLines(latestLines);
        setOriginLines(originLinesData);
        setSelectedKeys(new Set(latestLines.map((l) => l.lineKey)));
        setGlobalDefaults(globalDefaultsFromLine(latestLines[0], run.inputSnapshot.costs?.currency || initialCosts.currency));
        setActiveReviewLineKey(latestLines[0].lineKey);
      } else {
        const lines = initialLines.map((line) => cloneLineForSupplier(line, supplierCode, supplierName));
        setAllLines(lines);
        setOriginLines(lines);
        setSelectedKeys(new Set(lines.map((l) => l.lineKey)));
        setGlobalDefaults(buildGlobalDefaults(initialCosts.currency));
      }
      if (run.inputSnapshot.costs) {
        setCosts({ ...EMPTY_BULK_COST_INPUT, ...(run.inputSnapshot.costs as Partial<BulkCostInput>) });
      }
      if (run.previewSnapshot) {
        setPreview(run.previewSnapshot as AllocationPreview);
        window.setTimeout(() => {
          document.getElementById('preview-title')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 150);
      }
      setRevisionSourceRunId(run.runId);
      setRevisionGroupId(run.revisionGroupId);
      setRevisionNo(run.revisionNo);
      setRunStatus(run.status);
      setIsLoadingRun(false);
    }).catch(() => {
      if (cancelled) return;
      toast.error('Failed to load saved run data');
      const lines = initialLines.map((line) => cloneLineForSupplier(line, supplierCode, supplierName));
      setAllLines(lines);
      setOriginLines(lines);
      setSelectedKeys(new Set(lines.map((l) => l.lineKey)));
      setCosts(initialCosts);
      setGlobalDefaults(buildGlobalDefaults(initialCosts.currency));
      setIsLoadingRun(false);
    });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only on mount — initialSavedRunId is stable

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    Promise.all([
      lookupApi.getTermFormLookups(),
      lookupApi.getSubLocations('AR', undefined, { signal: controller.signal }),
    ])
      .then(([lookups, salesSubLocations]) => {
        if (cancelled) return;
        if (lookups.currencies.length > 0) setCurrencyLookups(lookups.currencies);
        if (lookups.orderTerms.length > 0) setOrderTermLookups(lookups.orderTerms);
        if (lookups.locations.length > 0) setLocationLookups(lookups.locations);
        if (lookups.uoms.length > 0) setUomLookups(lookups.uoms);
        setSalesSubLocationLookups(Array.from(new Set(
          salesSubLocations.map((row) => subLocationOptionValue(row)).filter(Boolean),
        )));
      })
      .catch((error) => {
        if (cancelled || isAbortError(error)) return;
        clientLogger.error('Failed to load Bulk Cost term lookups', error);
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    lookupApi.getItemFormLookups()
      .then((lookups) => {
        if (cancelled) return;
        if (lookups.itemGroups.length > 0) setItemGroupLookups(lookups.itemGroups);
        if (lookups.countries.length > 0) setCountryLookups(lookups.countries);
        if (lookups.itemCategories.length > 0) setItemCategoryLookups(lookups.itemCategories);
        if (lookups.permitTypes.length > 0) setPermitTypeLookups(lookups.permitTypes);
        if (lookups.brands.length > 0) setBrandLookups(lookups.brands);
      })
      .catch((error) => {
        if (cancelled) return;
        clientLogger.error('Failed to load Bulk Cost item lookups', error);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!supplierCode) {
      setContactLookups([]);
      return;
    }
    let cancelled = false;
    const controller = new AbortController();
    lookupApi.getContacts(supplierCode, { signal: controller.signal })
      .then((rows) => {
        if (cancelled) return;
        setContactLookups(rows);
      })
      .catch((error) => {
        if (cancelled || isAbortError(error)) return;
        clientLogger.error('Failed to load contacts for supplier', error);
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [supplierCode]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const selectedLocation = String(costs.location || '').trim();

    if (!selectedLocation) {
      setSubLocationLookups([]);
      setCosts((prev) => (prev.subLocation ? { ...prev, subLocation: '' } : prev));
      return () => {
        cancelled = true;
        controller.abort();
      };
    }

    lookupApi.getSubLocations('AP', selectedLocation, { signal: controller.signal })
      .then((rows) => {
        if (cancelled) return;
        setSubLocationLookups(rows);
        setSubLocationsByLocation((prev) => ({
          ...prev,
          [selectedLocation]: Array.from(new Set(rows.map((row) => subLocationOptionValue(row)).filter(Boolean))),
        }));
        const values = new Set(rows.map((row) => subLocationOptionValue(row)).filter(Boolean));
        setCosts((prev) => {
          if (!prev.subLocation || values.has(prev.subLocation)) return prev;
          return { ...prev, subLocation: '' };
        });
      })
      .catch((error) => {
        if (isAbortError(error) || cancelled) return;
        clientLogger.error('Failed to load Bulk Cost purchase sub locations', error);
        setSubLocationLookups([]);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [costs.location]);

  useEffect(() => {
    const controller = new AbortController();
    const uniqueLocations = Array.from(new Set(
      allLines
        .map((line) => String(line.location || '').trim())
        .filter((location) => location !== '' && !subLocationsByLocation[location]),
    ));

    if (uniqueLocations.length === 0) {
      return () => controller.abort();
    }

    let cancelled = false;
    Promise.all(uniqueLocations.map(async (location) => {
      try {
        const rows = await lookupApi.getSubLocations('AP', location, { signal: controller.signal });
        return {
          location,
          values: Array.from(new Set(rows.map((row) => subLocationOptionValue(row)).filter(Boolean))),
        };
      } catch (error) {
        if (!isAbortError(error)) {
          clientLogger.error(`Failed to load Bulk Cost line sub locations for ${location}`, error);
        }
        return { location, values: [] };
      }
    })).then((results) => {
      if (cancelled) return;
      setSubLocationsByLocation((prev) => {
        const next = { ...prev };
        for (const result of results) next[result.location] = result.values;
        return next;
      });
    });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [allLines, subLocationsByLocation]);

  const selectedLines = useMemo(
    () => allLines.filter((line) => selectedKeys.has(line.lineKey)),
    [allLines, selectedKeys],
  );

  const originByKey = useMemo(() => {
    const map = new Map<string, AllocationLineSource>();
    for (const line of originLines) map.set(line.lineKey, line);
    return map;
  }, [originLines]);

  const lineChanges = useMemo<LineChange[]>(() => {
    const changes: LineChange[] = [];
    for (const latest of allLines) {
      const origin = originByKey.get(latest.lineKey);
      if (!origin) continue;

      for (const field of trackedLineFields) {
        const originValue = field.format(origin);
        const latestValue = field.format(latest);
        if (valuesEqual(originValue, latestValue)) continue;
        changes.push({
          lineKey: latest.lineKey,
          no: latest.no,
          itemCode: latest.itemCode,
          fieldKey: field.key,
          label: field.label,
          originValue,
          latestValue,
        });
      }
    }
    return changes;
  }, [allLines, originByKey]);

  const changedCellKeys = useMemo(() => {
    const set = new Set<string>();
    for (const change of lineChanges) {
      set.add(`${change.lineKey}:${change.fieldKey}`);
    }
    return set;
  }, [lineChanges]);

  const visibleLineColumns = useMemo(() => {
    const columnsByKey = new Map(LINE_TABLE_COLUMNS.map((column) => [column.key, column]));
    return LINE_COLUMN_PRESETS[lineColumnPreset]
      .map((key) => columnsByKey.get(key))
      .filter((column): column is ResizableTableColumn => Boolean(column));
  }, [lineColumnPreset]);

  const dominantCurrency = useMemo(() => {
    if (selectedLines.length === 0) return null;
    const counts = new Map<string, number>();
    for (const line of selectedLines) {
      counts.set(line.currency, (counts.get(line.currency) ?? 0) + 1);
    }
    let best = '';
    let bestCount = 0;
    for (const [cur, count] of counts) {
      if (count > bestCount) { best = cur; bestCount = count; }
    }
    return best || null;
  }, [selectedLines]);

  const totalAmount = useMemo(
    () => selectedLines.reduce((sum, line) => sum + line.amount, 0),
    [selectedLines],
  );

  const totalQty = useMemo(
    () => selectedLines.reduce((sum, line) => sum + line.qty, 0),
    [selectedLines],
  );

  const totalWeight = useMemo(() => {
    let weight = 0;
    for (const line of selectedLines) {
      const resolved = line.shippingWeightPerEach ?? line.dimensionWeightPerEach ?? line.itemWeightPerEach;
      if (resolved !== null && resolved > 0) weight += resolved * line.qty;
    }
    return weight;
  }, [selectedLines]);

  const totalChargeableWeight = useMemo(() => {
    return selectedLines.reduce((sum, line) => {
      const w = getChargeableWeightPerEach(line);
      return sum + (w !== null ? w * line.qty : 0);
    }, 0);
  }, [selectedLines]);

  const linesWithWarning = useMemo(
    () => selectedLines.filter((line) => {
      const weight = line.shippingWeightPerEach ?? line.dimensionWeightPerEach ?? line.itemWeightPerEach;
      return weight === null || weight <= 0;
    }).length,
    [selectedLines],
  );

  // Derive By Lot/Batch service-line candidates from all lines.
  const docFeeCandidates = useMemo<BulkCostDocumentFeeLineCandidate[]>(() => {
    const candidates: BulkCostDocumentFeeLineCandidate[] = [];
    for (const line of allLines) {
      const basis = line.docFeeBasis ?? {};
      for (const field of DOC_FEE_FIELDS) {
        if (basis[field.key] !== 'BY_LOT_BATCH') continue;
        const amount = line.docFee[field.key];
        if (!amount) continue;
        candidates.push({
          lineKey: `${line.lineKey}-DOC-${field.key}`,
          sourceLineKey: line.lineKey,
          sourceLineNo: line.no,
          feeKind: field.key,
          description: `${field.label} By Lot / Batch`,
          qty: 1,
          uom: 'EA',
          unitPrice: amount,
          amount,
          currency: line.currency,
          itemGroup: '107',
          itemCategory: 'Service',
        });
      }
    }
    return candidates;
  }, [allLines]);

  // Effective selected lines for calculation: BY_LOT_BATCH fees zeroed from docFee.
  const effectiveSelectedLines = useMemo(() => {
    return selectedLines.map((line) => {
      const basis = line.docFeeBasis;
      if (!basis) return line;
      const hasAnyByLot = DOC_FEE_FIELDS.some(
        (f) => basis[f.key] === 'BY_LOT_BATCH' && line.docFee[f.key] !== 0,
      );
      if (!hasAnyByLot) return line;
      const newDocFee = { ...line.docFee };
      for (const field of DOC_FEE_FIELDS) {
        if (basis[field.key] === 'BY_LOT_BATCH') newDocFee[field.key] = 0;
      }
      return { ...line, docFee: newDocFee };
    });
  }, [selectedLines]);

  const resetPreview = useCallback(() => {
    setPreview(null);
    setPreviewEdits({});
    setCalcError(null);
    setSavedRunId(null);
  }, []);

  const currencySelectOptions = useMemo(
    () => ensureCurrencyLookupOption(currencyLookups, costs.currency, costs.exchangeRate),
    [costs.currency, costs.exchangeRate, currencyLookups],
  );

  const orderTermSelectOptions = useMemo(
    () => ensureTextOption(orderTermLookups, costs.orderTerm),
    [costs.orderTerm, orderTermLookups],
  );

  const locationSelectOptions = useMemo(
    () => ensureLocationLookupOption(locationLookups, costs.location),
    [costs.location, locationLookups],
  );

  // costs.location now stores location.code (e.g. "TH"), matching Term page behaviour.
  // The SQL WHERE Country=@country filter expects the code, not the display name.
  const selectedLocationValue = useMemo(() => {
    const matched = locationSelectOptions.find((row) =>
      row.code === costs.location || row.name === costs.location,
    );
    return matched ? matched.code : costs.location;
  }, [costs.location, locationSelectOptions]);

  const subLocationSelectOptions = useMemo(() => {
    const values = subLocationLookups
      .map((row) => subLocationOptionValue(row))
      .filter((value) => value !== '');
    return ensureTextOption([...new Set(values)], costs.subLocation);
  }, [costs.subLocation, subLocationLookups]);

  const getLineSubLocationOptions = useCallback((line: AllocationLineSource): string[] => {
    const location = String(line.location || '').trim();
    const values = location ? (subLocationsByLocation[location] ?? []) : [];
    return ensureTextOption(values, line.subLocation);
  }, [subLocationsByLocation]);

  const getLineSalesSubLocationOptions = useCallback((line: AllocationLineSource): string[] => {
    return ensureTextOption(salesSubLocationLookups, line.salesSubLocation || '');
  }, [salesSubLocationLookups]);

  const shipModeSelectOptions = useMemo(() => {
    const options = [{ value: -1, label: 'Please Select' }, ...SHIP_MODE_OPTIONS];
    return options.some((row) => row.value === costs.shipModeNo)
      ? options
      : [{ value: costs.shipModeNo, label: formatShipMode(costs.shipModeNo) }, ...options];
  }, [costs.shipModeNo]);

  const itemGroupSelectOptions = useMemo(() => {
    const options = itemGroupLookups.length > 0 ? itemGroupLookups : FALLBACK_ITEM_GROUP_LOOKUPS;
    return options;
  }, [itemGroupLookups]);

  const itemCategorySelectOptions = useMemo(() => itemCategoryLookups, [itemCategoryLookups]);
  const permitTypeSelectOptions = useMemo(() => permitTypeLookups, [permitTypeLookups]);
  const countrySelectOptions = useMemo(() => countryLookups, [countryLookups]);
  const brandSelectOptions = useMemo(() => brandLookups, [brandLookups]);
  const foreignCostCurrencyLabel = costs.currency || 'FCY';

  const toggleLine = useCallback((key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    resetPreview();
  }, [resetPreview]);

  const toggleAllLines = useCallback(() => {
    const allSelected = allLines.length > 0 && selectedKeys.size === allLines.length;
    setSelectedKeys(allSelected ? new Set() : new Set(allLines.map((l) => l.lineKey)));
    resetPreview();
  }, [allLines, selectedKeys.size, resetPreview]);

  const selectAllRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = selectedKeys.size > 0 && selectedKeys.size < allLines.length;
    }
  }, [selectedKeys.size, allLines.length]);

  useEffect(() => {
    if (dominantCurrency && dominantCurrency !== costs.currency) {
      const selected = currencySelectOptions.find((row) => row.code === dominantCurrency);
      setCosts((prev) => ({
        ...prev,
        currency: dominantCurrency,
        exchangeRate: selected?.exRate || prev.exchangeRate,
      }));
      setGlobalDefaults((prev) => ({ ...prev, insPercent: defaultInsurancePercent(dominantCurrency) }));
    }
  }, [costs.currency, currencySelectOptions, dominantCurrency]);

  const updateCost = useCallback((key: keyof BulkCostInput, raw: string) => {
    if (key === 'currency') {
      setGlobalDefaults((current) => ({ ...current, insPercent: defaultInsurancePercent(raw) }));
    }
    setCosts((prev) => {
      if (key === 'currency' || key === 'referenceNo' || key === 'remark'
          || key === 'orderTerm' || key === 'location' || key === 'subLocation' || key === 'contactPerson' || key === 'saleIncharge') {
        return { ...prev, [key]: raw };
      }
      return { ...prev, [key]: parseNumericInput(raw) };
    });
    resetPreview();
  }, [resetPreview]);

  const updateCurrency = useCallback((currency: string) => {
    const selected = currencySelectOptions.find((row) => row.code === currency);
    setGlobalDefaults((current) => ({ ...current, insPercent: defaultInsurancePercent(currency) }));
    setCosts((prev) => ({
      ...prev,
      currency,
      exchangeRate: selected?.exRate || prev.exchangeRate,
    }));
    resetPreview();
  }, [currencySelectOptions, resetPreview]);

  const updateGlobalDefault = useCallback((key: keyof GlobalLineDefaults, raw: string) => {
    setGlobalDefaults((prev) => ({ ...prev, [key]: parseNumericInput(raw) }));
  }, []);

  const applyGlobalDefaultsToAllLines = useCallback(() => {
    setAllLines((prev) => prev.map((line) => ({
      ...line,
      insPercent: globalDefaults.insPercent,
      importDutyPercent: globalDefaults.importDutyPercent,
      stkPercent: globalDefaults.stkPercent,
      sspk: globalDefaults.sspk,
      qoc: globalDefaults.qoc,
      markupPercent: globalDefaults.markupPercent,
    })));
    resetPreview();
    toast.success('ใช้ค่าเริ่มต้นกับทุกรายการแล้ว');
  }, [globalDefaults, resetPreview]);

  const applyOrderSettingsToAllLines = useCallback(() => {
    const selectedLocation = locationLookups.find((row) => row.code === costs.location || row.name === costs.location);
    const targetZoneRate = Number(selectedLocation?.zoneRate ?? 0);
    setAllLines((prev) => prev.map((line) => ({
      ...line,
      orderTerm: costs.orderTerm,
      location: costs.location,
      subLocation: costs.subLocation,
      shipModeNo: costs.shipModeNo,
      currency: costs.currency,
      zoneRate: targetZoneRate,
    })));
    resetPreview();
    toast.success('Applied order settings to all lines');
  }, [costs.currency, costs.location, costs.orderTerm, costs.shipModeNo, costs.subLocation, locationLookups, resetPreview]);

  const updateLineDocFee = useCallback((lineKey: string, key: keyof DocumentFees, raw: string) => {
    setAllLines((prev) =>
      prev.map((line) => (
        line.lineKey === lineKey
          ? { ...line, docFee: { ...line.docFee, [key]: parseNumericInput(raw) } }
          : line
      )),
    );
    resetPreview();
  }, [resetPreview]);

  const updateLineDocFeeBasis = useCallback((
    lineKey: string,
    key: keyof DocumentFees,
    basis: 'PER_EACH' | 'BY_LOT_BATCH',
  ) => {
    setAllLines((prev) =>
      prev.map((line) =>
        line.lineKey === lineKey
          ? { ...line, docFeeBasis: { ...line.docFeeBasis, [key]: basis } }
          : line,
      ),
    );
    resetPreview();
  }, [resetPreview]);

  const addLine = useCallback(() => {
    const nextNo = allLines.length + 1;
    const newLine = createBlankLine(nextNo, supplierCode, supplierName, costs, globalDefaults);
    setAllLines((prev) => [...prev, newLine]);
    setSelectedKeys((prev) => new Set([...prev, newLine.lineKey]));
    resetPreview();
  }, [allLines.length, costs, globalDefaults, resetPreview, supplierCode, supplierName]);

  const deleteLine = useCallback((lineKey: string) => {
    setAllLines((prev) => {
      const filtered = prev.filter((line) => line.lineKey !== lineKey);
      return filtered.map((line, idx) => ({ ...line, no: idx + 1 }));
    });
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      next.delete(lineKey);
      return next;
    });
    resetPreview();
  }, [resetPreview]);

  const updateLineTextField = useCallback((
    lineKey: string,
    key: EditableLineTextField,
    value: string,
  ) => {
    setAllLines((prev) =>
      prev.map((line) => {
        if (line.lineKey !== lineKey) return line;
        if (key === 'location') {
          const selectedLocation = locationLookups.find((row) => row.code === value || row.name === value);
          return {
            ...line,
            location: value,
            subLocation: '',
            zoneRate: Number(selectedLocation?.zoneRate ?? 0),
          };
        }
        return {
          ...line,
          [key]: value,
          ...(key === 'uom' ? { stockUOM: value } : {}),
        };
      }),
    );
    resetPreview();
  }, [locationLookups, resetPreview]);

  const updateLineNumberField = useCallback((
    lineKey: string,
    key: EditableLineNumberField,
    raw: string,
  ) => {
    setAllLines((prev) =>
      prev.map((line) => {
        if (line.lineKey !== lineKey) return line;
        return recalcLineDerivedValues({ ...line, [key]: parseNumericInput(raw) });
      }),
    );
    resetPreview();
  }, [resetPreview]);

  const updateLineNullableNumberField = useCallback((
    lineKey: string,
    key: EditableLineNullableNumberField,
    raw: string,
  ) => {
    setAllLines((prev) =>
      prev.map((line) => {
        if (line.lineKey !== lineKey) return line;
        return recalcLineDerivedValues({ ...line, [key]: parseNullableNumericInput(raw) });
      }),
    );
    resetPreview();
  }, [resetPreview]);

  const resetLatestFieldToOrigin = useCallback((lineKey: string, fieldKey: LineFieldKey) => {
    const origin = originByKey.get(lineKey);
    if (!origin) return;

    setAllLines((prev) =>
      prev.map((line) => {
        if (line.lineKey !== lineKey) return line;

        if (String(fieldKey).startsWith('docFee.')) {
          const docKey = String(fieldKey).replace('docFee.', '') as keyof DocumentFees;
          return {
            ...line,
            docFee: {
              ...line.docFee,
              [docKey]: origin.docFee[docKey],
            },
          };
        }

        return recalcLineDerivedValues({
          ...line,
          [fieldKey]: origin[fieldKey as keyof AllocationLineSource],
        });
      }),
    );
    resetPreview();
  }, [originByKey, resetPreview]);

  const handleCalculate = useCallback(async () => {
    setIsCalculating(true);
    setPreviewEdits({});
    setCalcError(null);
    setSavedRunId(null);
    setRunStatus('DRAFT');

    const hasWeightBasedCosts = costs.pkh > 0 || costs.soc > 0 || costs.freight > 0 || costs.customs > 0;
    if (hasWeightBasedCosts) {
      const linesMissingWeight = effectiveSelectedLines.filter((line) => (resolveLineWeight(line) ?? 0) <= 0);
      if (linesMissingWeight.length > 0) {
        setIsCalculating(false);
        const errMessage = 'Cannot calculate: Some selected items are missing weight. (เมื่อมีการกรอกค่า PKH, SOC, Freight หรือ Customs Clearance ทุกรายการที่เลือกต้องระบุน้ำหนักหรือมิติบรรจุภัณฑ์ก่อนการคำนวณ)';
        setCalcError(errMessage);
        toast.error(errMessage);
        return;
      }
    }

    try {
      const result = await calculateBulkCostPreview({ costs, lines: effectiveSelectedLines });
      setPreview(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to calculate Cost Workspace preview';
      setCalcError(message);
      toast.error(message);
    } finally {
      setIsCalculating(false);
    }
  }, [effectiveSelectedLines, costs]);

  const handleReset = useCallback(() => {
    setCosts({ ...EMPTY_BULK_COST_INPUT });
    setGlobalDefaults(buildGlobalDefaults(EMPTY_BULK_COST_INPUT.currency));
    resetPreview();
  }, [resetPreview]);

  const updatePreviewEdit = useCallback((lineKey: string, key: FinalResultKey, raw: string) => {
    setPreviewEdits((prev) => ({
      ...prev,
      [lineKey]: {
        ...prev[lineKey],
        [key]: parseNumericInput(raw),
      },
    }));
  }, []);

  const getFinalResultForLine = useCallback((line: AllocationLineResult): FinalResultColumns => {
    return {
      ...line.finalResult,
      ...(previewEdits[line.lineKey] || {}),
    };
  }, [previewEdits]);

  const handleSaveDraft = useCallback(async () => {
    if (!preview) {
      toast.warning('Click CAL before saving a draft');
      return;
    }

    setIsSavingDraft(true);
    try {
      const payload = buildBulkCostRunDraftPayload({
        sourceRunId: revisionSourceRunId,
        supplierCode,
        supplierName,
        costs,
        originLines,
        latestLines: allLines,
        preview,
        getFinalResultForLine,
      });
      const saved = await saveBulkCostRunDraft(payload);
      setSavedRunId(saved.runId);
      setRevisionSourceRunId(saved.runId);
      setRevisionGroupId(saved.revisionGroupId);
      setRevisionNo(saved.revisionNo);
      setRunStatus(saved.status);
      if (allLines.length > 0 && !activeReviewLineKey) {
        setActiveReviewLineKey(allLines[0].lineKey);
      }
      toast.success(`Cost Workspace revision saved (Run #${saved.runId}, Rev ${saved.revisionNo})`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save Cost Workspace draft';
      toast.error(message);
    } finally {
      setIsSavingDraft(false);
    }
  }, [allLines, costs, getFinalResultForLine, originLines, preview, revisionSourceRunId, supplierCode, supplierName]);

  const handleMarkStatus = useCallback(async (status: 'AWARDED' | 'LOST') => {
    if (!savedRunId) return;
    setIsUpdatingStatus(true);
    try {
      await updateBulkCostRunStatus(savedRunId, status);
      setRunStatus(status);
      toast.success(`Run #${savedRunId} marked as ${status === 'AWARDED' ? 'Won' : 'Lost'}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : `Failed to mark run as ${status === 'AWARDED' ? 'Won' : 'Lost'}`;
      toast.error(message);
    } finally {
      setIsUpdatingStatus(false);
    }
  }, [savedRunId]);

  const canCalculate = selectedLines.length > 0 && !isLoadingRun;
  const canSaveDraft = preview !== null && preview.lines.length > 0 && !isCalculating && !isLoadingRun;
  const displayedLines = sourceView === 'origin' ? originLines : allLines;
  const isLatestView = sourceView === 'latest';
  const revisionStatusLabel = revisionGroupId !== null
    ? `Run #${revisionSourceRunId ?? revisionGroupId} / Revision Group #${revisionGroupId}${revisionNo ? ` / Rev ${revisionNo}` : ''}`
    : 'New manual run';
  const revisionHelpText = revisionGroupId !== null
    ? 'Editing and recalculating will save as the next revision.'
    : 'Blank manual workspace. Add lines, run CAL, then save revision.';
  const calculateTitle = canCalculate
    ? 'Calculate selected manual lines using backend CAL'
    : 'Add and select at least one line before CAL';
  const saveTitle = canSaveDraft
    ? 'Save this CAL result as a revision snapshot'
    : 'Run CAL successfully before saving a revision';
  const saveButtonText = isSavingDraft
    ? 'Saving...'
    : savedRunId
      ? `Saved Rev ${revisionNo ?? ''}`
      : revisionSourceRunId
        ? 'Save New Revision'
        : 'Save Revision';

  if (isLoadingRun) {
    return (
      <div className="page-stack">
        <section className="workspace-toolbar">
          <div className="workspace-toolbar-context">
            <button className="ghost-nav-button" type="button" onClick={onBack}>
              <ArrowLeft size={14} aria-hidden="true" />
              {backLabel}
            </button>
            <div>
              <p className="eyebrow">Cost Workspace</p>
              <h1>Loading Run #{initialSavedRunId}…</h1>
            </div>
          </div>
        </section>
        <section className="panel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 240, gap: 12 }}>
          <Loader2 size={24} className="spin-icon" aria-hidden="true" style={{ color: 'var(--pc-blue)' }} />
          <span style={{ color: 'var(--pc-muted)', fontSize: 14 }}>Loading saved run data…</span>
        </section>
      </div>
    );
  }

  return (
    <div className="bulk-cost-workspace">
      <section className="workspace-toolbar">
        <div className="workspace-toolbar-context">
          <button className="ghost-nav-button" type="button" onClick={onBack}>
            <ArrowLeft size={14} aria-hidden="true" />
            {backLabel}
          </button>
          <div>
            <p className="eyebrow">Manual Cost Workspace</p>
            <h1>Manual Cost Workspace</h1>
            <div className="manual-workspace-meta">
              <span className="manual-state-pill">{revisionStatusLabel}</span>
              <span>{revisionHelpText}</span>
            </div>
          </div>
        </div>
        <div className="workspace-actions" aria-label="Workspace actions">
          <button className="secondary-button" type="button" onClick={handleReset}>
            <RotateCcw size={16} aria-hidden="true" />
            Reset
          </button>
          <button
            className="secondary-button"
            type="button"
            disabled={!canCalculate || isCalculating}
            onClick={handleCalculate}
            title={calculateTitle}
          >
            {isCalculating ? (
              <Loader2 size={16} className="spin-icon" aria-hidden="true" />
            ) : (
              <Calculator size={16} aria-hidden="true" />
            )}
            {isCalculating ? 'CAL...' : 'CAL'}
          </button>
          <button
            className="primary-button"
            type="button"
            disabled={!canSaveDraft || isSavingDraft}
            onClick={handleSaveDraft}
            title={saveTitle}
          >
            {isSavingDraft ? (
              <Loader2 size={16} className="spin-icon" aria-hidden="true" />
            ) : (
              <Save size={16} aria-hidden="true" />
            )}
            {saveButtonText}
          </button>
          {savedRunId !== null && (
            <button
              className={`secondary-button ${isReviewFinalizeActive ? 'active-tab' : ''}`}
              style={{ background: isReviewFinalizeActive ? '#ebf3fc' : undefined, borderColor: isReviewFinalizeActive ? 'var(--pc-blue)' : undefined, color: isReviewFinalizeActive ? 'var(--pc-blue)' : undefined }}
              type="button"
              onClick={() => setIsReviewFinalizeActive(!isReviewFinalizeActive)}
              title={isReviewFinalizeActive ? 'Back to Editor' : 'Validate Item/Term candidates'}
            >
              {isReviewFinalizeActive ? <Edit3 size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
              {isReviewFinalizeActive ? 'Back to Editor' : 'Review & Finalize'}
            </button>
          )}
          {savedRunId !== null && runStatus === 'DRAFT' && (
            <>
              <button
                className="success-button"
                type="button"
                disabled={isUpdatingStatus}
                onClick={() => { void handleMarkStatus('AWARDED'); }}
                title="Mark this run as Won (local workspace status, not AXON Award)"
              >
                {isUpdatingStatus ? (
                  <Loader2 size={16} className="spin-icon" aria-hidden="true" />
                ) : (
                  <Trophy size={16} aria-hidden="true" />
                )}
                Mark Won
              </button>
              <button
                className="danger-button"
                type="button"
                disabled={isUpdatingStatus}
                onClick={() => { void handleMarkStatus('LOST'); }}
                title="Mark this run as Lost (local workspace status, not AXON Award)"
              >
                {isUpdatingStatus ? (
                  <Loader2 size={16} className="spin-icon" aria-hidden="true" />
                ) : (
                  <XCircle size={16} aria-hidden="true" />
                )}
                Lost
              </button>
            </>
          )}
          {savedRunId !== null && runStatus !== 'DRAFT' && (
            <span className={`workspace-status-badge workspace-status-badge--${runStatus.toLowerCase()}`}>
              {runStatus === 'AWARDED' ? <Trophy size={14} aria-hidden="true" /> : <XCircle size={14} aria-hidden="true" />}
              {runStatus === 'AWARDED' ? 'WON' : runStatus}
            </span>
          )}
        </div>
      </section>

      {isReviewFinalizeActive ? (
        <div className="review-finalize-container">
          {/* Left panel: Lines List */}
          <div className="review-sidebar">
            <div className="review-sidebar-header">
              <h3>Line Items Validation</h3>
              <p style={{ margin: 0, fontSize: 11, color: 'var(--pc-muted)' }}>
                Select a line to review Item &amp; Term candidate required fields.
              </p>
            </div>
            <div className="review-line-list">
              {allLines.map((line, idx) => {
                const lineResult = preview?.lines.find((l) => l.lineKey === line.lineKey);
                const finalResult = lineResult ? getFinalResultForLine(lineResult) : undefined;
                const resolvedContact = contactLookups.find(c => c.name === costs.contactPerson);
                const cntctCode = resolvedContact ? resolvedContact.cntctCode : null;
                const validation = validateLineCandidate(line, costs, {
                  runId: savedRunId,
                  revisionGroupId,
                  revisionNo,
                  status: runStatus,
                  supplierCode,
                  cntctCode,
                }, finalResult);

                const isActive = activeReviewLineKey === line.lineKey;
                const statusText =
                  validation.status === 'ready' ? 'Ready' :
                  validation.status === 'warning' ? 'Warning' : 'Missing Fields';
                const totalIssues =
                  validation.itemIssues.length +
                  validation.termIssues.length +
                  validation.calcIssues.length +
                  validation.traceIssues.length;

                return (
                  <button
                    key={line.lineKey}
                    className={`review-line-item ${isActive ? 'review-line-item--active' : ''}`}
                    type="button"
                    onClick={() => setActiveReviewLineKey(line.lineKey)}
                  >
                    <div className="review-line-item-meta">
                      <div className="review-line-item-title">
                        #{line.no} - {line.sapDescription || 'No description'}
                      </div>
                      <div className="review-line-item-subtitle">
                        Brand: {line.manufacturer || '-'} | Model: {line.mfgPartNumber || '-'}
                      </div>
                      <div className="review-issue-badges">
                        <span className={`review-issue-badge review-issue-badge--${validation.status}`}>
                          {validation.status === 'ready' && <Check size={10} />}
                          {validation.status === 'warning' && <AlertTriangle size={10} />}
                          {validation.status === 'missing' && <XCircle size={10} />}
                          {statusText}
                        </span>
                        {totalIssues > 0 && (
                          <span className="review-issue-badge" style={{ background: '#f1f5f9', color: '#475569' }}>
                            {totalIssues} issue{totalIssues > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right panel: Validation Details */}
          <div className="review-details-pane">
            {(() => {
              const selectedLine = allLines.find((l) => l.lineKey === activeReviewLineKey);
              if (!selectedLine) {
                return (
                  <div className="panel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
                    <p style={{ color: 'var(--pc-muted)' }}>Select a line item from the sidebar to review validation details.</p>
                  </div>
                );
              }

              const lineResult = preview?.lines.find((l) => l.lineKey === selectedLine.lineKey);
              const finalResult = lineResult ? getFinalResultForLine(lineResult) : undefined;
              const resolvedContact = contactLookups.find(c => c.name === costs.contactPerson);
              const cntctCode = resolvedContact ? resolvedContact.cntctCode : null;
              const validation = validateLineCandidate(selectedLine, costs, {
                runId: savedRunId,
                revisionGroupId,
                revisionNo,
                status: runStatus,
                supplierCode,
                cntctCode,
              }, finalResult);

              return (
                <div className="review-details-scroll">
                  <div className="review-details-header">
                    <div>
                      <h3>Line #{selectedLine.no} Validation Details</h3>
                      <p style={{ margin: 0, fontSize: 12, color: 'var(--pc-muted)' }}>
                        {selectedLine.sapDescription}
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        className="secondary-button"
                        type="button"
                        onClick={() => {
                          if (lineResult && finalResult) {
                            const now = Date.now();
                            const key = storeBulkCostPreview({
                              type: 'item',
                              meta: { type: 'item', lineKey: selectedLine.lineKey, description: selectedLine.sapDescription, supplierName: selectedLine.vendorName, createdAt: now },
                              itemData: mapBulkCostToItemData(selectedLine),
                            });
                            window.open(`/item/preview?key=${encodeURIComponent(key)}`, '_blank', 'noopener');
                          }
                        }}
                        disabled={!lineResult}
                        title="Preview Item Form candidate"
                      >
                        <FileText size={14} /> Item Preview
                      </button>
                      <button
                        className="secondary-button"
                        type="button"
                        onClick={() => {
                          if (lineResult && finalResult) {
                            const now = Date.now();
                            const key = storeBulkCostPreview({
                              type: 'term',
                              meta: { type: 'term', lineKey: selectedLine.lineKey, description: selectedLine.sapDescription, supplierName: selectedLine.vendorName, createdAt: now },
                              formData: mapBulkCostToTermFormData(selectedLine, costs, finalResult),
                              calcResults: mapBulkCostToTermCalcResults(selectedLine, finalResult),
                            });
                            window.open(`/term/preview?key=${encodeURIComponent(key)}`, '_blank', 'noopener');
                          }
                        }}
                        disabled={!lineResult}
                        title="Preview Term Form candidate"
                      >
                        <FileText size={14} /> Term Preview
                      </button>
                    </div>
                  </div>

                  {/* 1. Item Candidate Group */}
                  <div className="review-validation-section">
                    <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Boxes size={16} />
                      Item Registration Candidate
                    </h4>
                    <div className="review-validation-grid">
                      {/* Item Group */}
                      <ValidationFieldRow
                        label="Item Group"
                        value={selectedLine.itemGroup ? `${formatItemGroup(selectedLine.itemGroup)} (${selectedLine.itemGroup})` : undefined}
                        issue={validation.itemIssues.find(i => i.field === 'itemGroup')}
                      />
                      {/* Mfr Brand */}
                      <ValidationFieldRow
                        label="Mfr Brand"
                        value={selectedLine.manufacturer}
                        issue={validation.itemIssues.find(i => i.field === 'manufacturer')}
                      />
                      {/* Mfr Catalog No */}
                      <ValidationFieldRow
                        label="Mfr Catalog No"
                        value={selectedLine.mfgPartNumber}
                        issue={validation.itemIssues.find(i => i.field === 'mfgPartNumber')}
                      />
                      {/* Item Description */}
                      <ValidationFieldRow
                        label="Item Description"
                        value={selectedLine.sapDescription}
                        issue={validation.itemIssues.find(i => i.field === 'sapDescription')}
                      />
                      {/* Stock UOM */}
                      <ValidationFieldRow
                        label="Stock UOM"
                        value={selectedLine.uom}
                        issue={validation.itemIssues.find(i => i.field === 'uom')}
                      />
                      {/* Country of Origin */}
                      <ValidationFieldRow
                        label="Country of Origin"
                        value={selectedLine.countryOfOrigin}
                        issue={validation.itemIssues.find(i => i.field === 'countryOfOrigin')}
                      />
                      {/* Permit Type */}
                      <ValidationFieldRow
                        label="Permit Type"
                        value={selectedLine.permitType || '-'}
                        issue={validation.itemIssues.find(i => i.field === 'permitType')}
                      />
                      {/* HS Code */}
                      <ValidationFieldRow
                        label="HS Code"
                        value={selectedLine.hsCode || '-'}
                        issue={validation.itemIssues.find(i => i.field === 'hsCode')}
                      />
                    </div>
                  </div>

                  {/* 2. Term Candidate Group */}
                  <div className="review-validation-section">
                    <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <FileText size={16} />
                      Purchase Term Candidate
                    </h4>
                    <div className="review-validation-grid">
                      <ValidationFieldRow
                        label="Supplier Code"
                        value={selectedLine.vendorCode || supplierCode}
                        issue={validation.termIssues.find(i => i.field === 'vendorCode')}
                      />
                      <ValidationFieldRow
                        label="Contact Person"
                        value={costs.contactPerson || '-'}
                        issue={validation.termIssues.find(i => i.field === 'contactPerson')}
                      />
                      <ValidationFieldRow
                        label="Supp Order Code"
                        value={selectedLine.supplierOrderCode || '-'}
                        issue={validation.termIssues.find(i => i.field === 'supplierOrderCode')}
                      />
                      <ValidationFieldRow
                        label="Purchase Term"
                        value={selectedLine.orderTerm || costs.orderTerm}
                        issue={validation.termIssues.find(i => i.field === 'orderTerm')}
                      />
                      <ValidationFieldRow
                        label="Term Location"
                        value={selectedLine.location || costs.location}
                        issue={validation.termIssues.find(i => i.field === 'location')}
                      />
                      <ValidationFieldRow
                        label="Purchase Sub Location"
                        value={selectedLine.subLocation || costs.subLocation}
                        issue={validation.termIssues.find(i => i.field === 'subLocation')}
                      />
                      {selectedLine.salesTerm && (
                        <>
                          <ValidationFieldRow
                            label="Sales Term"
                            value={selectedLine.salesTerm}
                          />
                          <ValidationFieldRow
                            label="Sales Sub Location"
                            value={selectedLine.salesSubLocation || '-'}
                            issue={validation.termIssues.find(i => i.field === 'salesSubLocation')}
                          />
                        </>
                      )}
                      <ValidationFieldRow
                        label="Currency"
                        value={selectedLine.currency || costs.currency}
                        issue={validation.termIssues.find(i => i.field === 'currency')}
                      />
                      <ValidationFieldRow
                        label="Exchange Rate"
                        value={costs.exchangeRate}
                        issue={validation.termIssues.find(i => i.field === 'exchangeRate')}
                      />
                      <ValidationFieldRow
                        label="Product Cost (PCS)"
                        value={selectedLine.unitPrice}
                        issue={validation.termIssues.find(i => i.field === 'unitPrice')}
                      />
                      <ValidationFieldRow
                        label="Quantity"
                        value={selectedLine.qty}
                        issue={validation.termIssues.find(i => i.field === 'qty')}
                      />
                      <ValidationFieldRow
                        label="Purchase UOM"
                        value={selectedLine.purchaseUOM}
                        issue={validation.termIssues.find(i => i.field === 'purchaseUOM')}
                      />
                      <ValidationFieldRow
                        label="Sales UOM"
                        value={selectedLine.saleUOM}
                        issue={validation.termIssues.find(i => i.field === 'saleUOM')}
                      />
                      <ValidationFieldRow
                        label="Stock Conv (NumInBuy)"
                        value={selectedLine.stockConversion}
                        issue={validation.termIssues.find(i => i.field === 'stockConversion')}
                      />
                      <ValidationFieldRow
                        label="Sale Conv (NumInSale)"
                        value={selectedLine.saleConversion}
                        issue={validation.termIssues.find(i => i.field === 'saleConversion')}
                      />
                      <ValidationFieldRow
                        label="Ship Mode"
                        value={formatShipMode(selectedLine.shipModeNo !== undefined && selectedLine.shipModeNo >= 0 ? selectedLine.shipModeNo : costs.shipModeNo)}
                        issue={validation.termIssues.find(i => i.field === 'shipModeNo')}
                      />
                      <ValidationFieldRow
                        label="Valid From"
                        value={todayIsoDate()}
                      />
                    </div>
                  </div>

                  {/* 3. Calculation/Result Group */}
                  <div className="review-validation-section">
                    <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Calculator size={16} />
                      Calculation &amp; Landed Price Parity
                    </h4>
                    <div className="review-validation-grid">
                      <ValidationFieldRow
                        label="OP1 (Source)"
                        value={finalResult?.op1Source}
                        issue={validation.calcIssues.find(i => i.field === 'op1Source')}
                      />
                      <ValidationFieldRow
                        label="OP1 (THB)"
                        value={finalResult?.op1}
                        issue={validation.calcIssues.find(i => i.field === 'op1')}
                      />
                      <ValidationFieldRow
                        label="OP2 (THB)"
                        value={finalResult?.op2}
                        issue={validation.calcIssues.find(i => i.field === 'op2')}
                      />
                      <ValidationFieldRow
                        label="Ship Weight Cal"
                        value={finalResult?.shipWeightCal !== undefined ? `${finalResult.shipWeightCal} kg` : undefined}
                        issue={validation.calcIssues.find(i => i.field === 'shipWeightCal')}
                      />
                      <ValidationFieldRow
                        label="Allocated Freight (FR)"
                        value={finalResult?.frQTEC}
                        issue={validation.calcIssues.find(i => i.field === 'frQTEC')}
                      />
                      <ValidationFieldRow
                        label="Insurance (INS)"
                        value={finalResult?.ins}
                        issue={validation.calcIssues.find(i => i.field === 'ins')}
                      />
                      <ValidationFieldRow
                        label="CIF Price"
                        value={finalResult?.cifQTEC}
                        issue={validation.calcIssues.find(i => i.field === 'cifQTEC')}
                      />
                      <ValidationFieldRow
                        label="Import Duty Tax"
                        value={finalResult?.selectedDuty}
                        issue={validation.calcIssues.find(i => i.field === 'selectedDuty')}
                      />
                      <ValidationFieldRow
                        label="Landed Cost (QLC)"
                        value={finalResult?.qlc}
                        issue={validation.calcIssues.find(i => i.field === 'qlc')}
                      />
                      <ValidationFieldRow
                        label="Total QLC"
                        value={finalResult?.totalQLC}
                        issue={validation.calcIssues.find(i => i.field === 'totalQLC')}
                      />
                      <ValidationFieldRow
                        label="Sales Price"
                        value={finalResult?.roundUp}
                        issue={validation.calcIssues.find(i => i.field === 'roundUp')}
                      />
                    </div>
                  </div>

                  {/* 4. Traceability Group */}
                  <div className="review-validation-section">
                    <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <History size={16} />
                      Revision Traceability Metadata
                    </h4>
                    <div className="review-validation-grid">
                      <ValidationFieldRow
                        label="Run ID"
                        value={savedRunId || undefined}
                        issue={validation.traceIssues.find(i => i.field === 'runId')}
                      />
                      <ValidationFieldRow
                        label="Revision Group ID"
                        value={revisionGroupId || undefined}
                        issue={validation.traceIssues.find(i => i.field === 'revisionGroupId')}
                      />
                      <ValidationFieldRow
                        label="Revision No"
                        value={revisionNo || undefined}
                        issue={validation.traceIssues.find(i => i.field === 'revisionNo')}
                      />
                      <ValidationFieldRow
                        label="Source Type"
                        value="MANUAL"
                      />
                      <ValidationFieldRow
                        label="Calculation Mode"
                        value={allLines.length > 1 ? 'BULK' : 'SINGLE'}
                      />
                      <ValidationFieldRow
                        label="Saved By"
                        value={costs.saleIncharge || '-'}
                        issue={validation.traceIssues.find(i => i.field === 'saleIncharge')}
                      />
                    </div>
                  </div>

                  {/* Disclaimer & Finalize button */}
                  <div className="review-disclaimer-panel">
                    <p>
                      Master write is blocked until Review/Finalize rules, reverse mapping rules, and business/order gate are approved.
                    </p>
                    <button
                      className="primary-button"
                      type="button"
                      disabled
                      style={{ opacity: 0.6, cursor: 'not-allowed', width: '220px' }}
                    >
                      Finalize to Item/Term
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      ) : (
        <div className="bulk-cost-workspace-body">
      <section className="panel cost-bar-panel" aria-labelledby="cost-title">
        <div className="cost-bar-step-heading">
          <div className="cost-bar-step-title-row">
            <span className="cost-bar-step-badge">1</span>
            <div>
              <h2 id="cost-title">Bulk Header &amp; Global Setup <span>(ตั้งค่าส่วนกลาง)</span></h2>
              <p>ตั้งค่าออเดอร์ ค่าใช้จ่ายรวม และค่า default ก่อนส่งรายการสินค้าเข้า CAL</p>
            </div>
          </div>
          <div className="cost-bar-title-icon">
            <BadgeDollarSign size={20} aria-hidden="true" />
          </div>
        </div>

        <div className="cost-bar-strip">
          <div className="bulk-setup-card bulk-setup-card--order">
            <div className="bulk-setup-card-title">1.1 ข้อมูลตั้งต้นออเดอร์</div>
            <div className="cost-bar-field bulk-supplier-field" role="group" aria-label="Supplier">
              <span>Supplier</span>
              <input
                type="text"
                value={supplierCode}
                readOnly
                aria-label="Supplier code"
                className="bulk-supplier-code-input"
              />
              <input
                type="text"
                value={supplierName}
                readOnly
                aria-label="Supplier name"
              />
            </div>
            <label className="cost-bar-field">
              <span>Purchase Term</span>
              <InlineSelect
                id="bulk-cost-order-term"
                value={orderTermSelectOptions.includes(costs.orderTerm) ? costs.orderTerm : costs.orderTerm}
                onValueChange={(val) => updateCost('orderTerm', val)}
                options={orderTermSelectOptions.map((opt) => ({ value: opt, label: opt }))}
                placeholder="Please select"
                className="cost-bar-select"
              />
            </label>
            <label className="cost-bar-field">
              <span>Term Location</span>
              <InlineSelect
                id="bulk-cost-location"
                value={selectedLocationValue}
                onValueChange={(val) => updateCost('location', val)}
                options={locationSelectOptions.map((opt) => ({ value: opt.code, label: locationOptionLabel(opt) }))}
                placeholder="Please select"
                className="cost-bar-select"
              />
            </label>
            <label className="cost-bar-field">
              <span>Sub Location</span>
              <InlineSelect
                id="bulk-cost-sub-location"
                value={costs.subLocation}
                onValueChange={(val) => updateCost('subLocation', val)}
                options={[
                  ...subLocationSelectOptions.map((opt) => ({ value: opt, label: opt })),
                  ...(costs.subLocation && !subLocationSelectOptions.includes(costs.subLocation)
                    ? [{ value: costs.subLocation, label: costs.subLocation }]
                    : []),
                ]}
                placeholder="Please Select"
                allowClear
                className="cost-bar-select"
                disabled={!costs.location}
              />
            </label>
            <label className="cost-bar-field">
              <span>Ship Mode</span>
              <InlineSelect
                id="bulk-cost-ship-mode"
                value={String(costs.shipModeNo)}
                onValueChange={(val) => {
                  const num = parseInt(val, 10);
                  setCosts((prev) => ({ ...prev, shipModeNo: isNaN(num) ? -1 : num }));
                  resetPreview();
                }}
                options={shipModeSelectOptions.map((mode) => ({ value: String(mode.value), label: mode.label }))}
                className="cost-bar-select"
              />
            </label>
            <div className="bulk-currency-exrate-row">
              <label htmlFor="bulk-cost-currency">Currency</label>
              <InlineSelect
                id="bulk-cost-currency"
                value={currencySelectOptions.some((row) => row.code === costs.currency) ? costs.currency : costs.currency}
                onValueChange={(val) => { if (val) updateCurrency(val); }}
                options={currencySelectOptions.map((opt) => ({ value: opt.code, label: currencyOptionLabel(opt) }))}
                className="cost-bar-select"
              />
              <label htmlFor="bulk-cost-exchange-rate">Ex. Rate</label>
              <FormattedNumberInput
                id="bulk-cost-exchange-rate"
                name="bulkCost.exchangeRate"
                value={costs.exchangeRate}
                focused={focusedCostInput === 'exchangeRate'}
                onBlur={() => setFocusedCostInput(null)}
                onChange={(event) => updateCost('exchangeRate', event.target.value)}
                onFocus={() => setFocusedCostInput('exchangeRate')}
                placeholder="35.00"
              />
            </div>
            <button
              className="cost-bar-apply-defaults"
              type="button"
              onClick={applyOrderSettingsToAllLines}
              disabled={allLines.length === 0}
            >
              Apply Order Settings to All
            </button>
          </div>

          <div className="bulk-setup-card bulk-setup-card--costs">
            <div className="bulk-setup-card-title">1.2 &amp; 1.3 Shared Costs</div>
            <label className="cost-bar-field">
              <span>Total PKH ({foreignCostCurrencyLabel}) <span className="alloc-method-badge">By Wt</span></span>
              <FormattedNumberInput
                id="bulk-cost-pkh"
                name="bulkCost.pkh"
                value={costs.pkh}
                focused={focusedCostInput === 'pkh'}
                onBlur={() => setFocusedCostInput(null)}
                onChange={(event) => updateCost('pkh', event.target.value)}
                onFocus={() => setFocusedCostInput('pkh')}
                placeholder="0.00"
                aria-label="Package Handling (PKH)"
              />
            </label>
            <label className="cost-bar-field">
              <span>Total SOC ({foreignCostCurrencyLabel}) <span className="alloc-method-badge">By Wt</span></span>
              <FormattedNumberInput
                id="bulk-cost-soc"
                name="bulkCost.soc"
                value={costs.soc}
                focused={focusedCostInput === 'soc'}
                onBlur={() => setFocusedCostInput(null)}
                onChange={(event) => updateCost('soc', event.target.value)}
                onFocus={() => setFocusedCostInput('soc')}
                placeholder="0.00"
                aria-label="Source Origin Charge (SOC)"
              />
            </label>
            <label className="cost-bar-field">
              <span>Total FR (THB) <span className="alloc-method-badge">By Wt</span></span>
              <FormattedNumberInput
                id="bulk-cost-freight"
                name="bulkCost.freight"
                value={costs.freight}
                focused={focusedCostInput === 'freight'}
                onBlur={() => setFocusedCostInput(null)}
                onChange={(event) => updateCost('freight', event.target.value)}
                onFocus={() => setFocusedCostInput('freight')}
                placeholder="0.00"
                aria-label="Freight (FR)"
              />
            </label>
            <label className="cost-bar-field">
              <span>Total Wire TT (THB) <span className="alloc-method-badge alloc-method-badge--value">By Val</span></span>
              <FormattedNumberInput
                id="bulk-cost-wireTT"
                name="bulkCost.wireTT"
                value={costs.wireTT}
                focused={focusedCostInput === 'wireTT'}
                onBlur={() => setFocusedCostInput(null)}
                onChange={(event) => updateCost('wireTT', event.target.value)}
                onFocus={() => setFocusedCostInput('wireTT')}
                placeholder="0.00"
                aria-label="Wire T/T"
              />
            </label>
            <label className="cost-bar-field">
              <span>Total CC (THB) <span className="alloc-method-badge">By Wt</span></span>
              <FormattedNumberInput
                id="bulk-cost-customs"
                name="bulkCost.customs"
                value={costs.customs}
                focused={focusedCostInput === 'customs'}
                onBlur={() => setFocusedCostInput(null)}
                onChange={(event) => updateCost('customs', event.target.value)}
                onFocus={() => setFocusedCostInput('customs')}
                placeholder="0.00"
                aria-label="Custom Clear (CC)"
              />
            </label>
          </div>

          <div className="bulk-setup-card bulk-setup-card--defaults">
            <div className="bulk-setup-card-title">1.4 Global Variables</div>
            <div className="bulk-field-pair">
              <label className="cost-bar-field">
                <span>Def. INS %</span>
                <FormattedNumberInput
                  id="bulk-cost-default-ins"
                  name="bulkCost.defaults.insPercent"
                  value={globalDefaults.insPercent}
                  focused={focusedCostInput === 'default-ins'}
                  onBlur={() => setFocusedCostInput(null)}
                  onChange={(event) => updateGlobalDefault('insPercent', event.target.value)}
                  onFocus={() => setFocusedCostInput('default-ins')}
                />
              </label>
              <label className="cost-bar-field">
                <span>Def. Duty %</span>
                <FormattedNumberInput
                  id="bulk-cost-default-duty"
                  name="bulkCost.defaults.importDutyPercent"
                  value={globalDefaults.importDutyPercent}
                  focused={focusedCostInput === 'default-duty'}
                  onBlur={() => setFocusedCostInput(null)}
                  onChange={(event) => updateGlobalDefault('importDutyPercent', event.target.value)}
                  onFocus={() => setFocusedCostInput('default-duty')}
                />
              </label>
            </div>
            <label className="cost-bar-field">
              <span>Def. Stock Fee %</span>
              <FormattedNumberInput
                id="bulk-cost-default-stk"
                name="bulkCost.defaults.stkPercent"
                value={globalDefaults.stkPercent}
                focused={focusedCostInput === 'default-stk'}
                onBlur={() => setFocusedCostInput(null)}
                onChange={(event) => updateGlobalDefault('stkPercent', event.target.value)}
                onFocus={() => setFocusedCostInput('default-stk')}
              />
            </label>
            <div className="bulk-field-pair">
              <label className="cost-bar-field">
                <span>Def. SPK</span>
                <FormattedNumberInput
                  id="bulk-cost-default-spk"
                  name="bulkCost.defaults.sspk"
                  value={globalDefaults.sspk}
                  focused={focusedCostInput === 'default-spk'}
                  onBlur={() => setFocusedCostInput(null)}
                  onChange={(event) => updateGlobalDefault('sspk', event.target.value)}
                  onFocus={() => setFocusedCostInput('default-spk')}
                />
              </label>
              <label className="cost-bar-field">
                <span>Def. QOC</span>
                <FormattedNumberInput
                  id="bulk-cost-default-qoc"
                  name="bulkCost.defaults.qoc"
                  value={globalDefaults.qoc}
                  focused={focusedCostInput === 'default-qoc'}
                  onBlur={() => setFocusedCostInput(null)}
                  onChange={(event) => updateGlobalDefault('qoc', event.target.value)}
                  onFocus={() => setFocusedCostInput('default-qoc')}
                />
              </label>
            </div>
            <label className="cost-bar-field cost-bar-markup-default-field">
              <span>Def. Markup %</span>
              <FormattedNumberInput
                id="bulk-cost-default-markup"
                name="bulkCost.defaults.markupPercent"
                value={globalDefaults.markupPercent}
                focused={focusedCostInput === 'default-markup'}
                onBlur={() => setFocusedCostInput(null)}
                onChange={(event) => updateGlobalDefault('markupPercent', event.target.value)}
                onFocus={() => setFocusedCostInput('default-markup')}
              />
            </label>
            <button
              className="cost-bar-apply-defaults"
              type="button"
              onClick={applyGlobalDefaultsToAllLines}
              disabled={allLines.length === 0}
            >
              Apply to All Items
            </button>
          </div>
        </div>

        <details className="cost-bar-run-details">
          <summary>Run Info (optional) - ข้อมูลงานที่ไม่กระทบสูตรคำนวณ</summary>
          <div className="cost-bar-run-details-grid">
            <label className="cost-bar-field">
              <span>Reference No. / Job Name</span>
              <input
                id="bulk-cost-reference-no"
                name="bulkCost.referenceNo"
                type="text"
                value={costs.referenceNo}
                onChange={(event) => updateCost('referenceNo', event.target.value)}
                placeholder="เช่น RFQ-001"
              />
            </label>
            <label className="cost-bar-field">
              <span>Sale Incharge</span>
              <input
                id="bulk-cost-sale-incharge"
                name="bulkCost.saleIncharge"
                type="text"
                value={costs.saleIncharge}
                onChange={(event) => updateCost('saleIncharge', event.target.value)}
              />
            </label>
            <label className="cost-bar-field">
              <span>Contact Person</span>
              <InlineSelect
                id="bulk-cost-contact-person"
                value={costs.contactPerson}
                onValueChange={(val) => updateCost('contactPerson', val)}
                options={contactLookups.map((c) => ({ value: c.name, label: c.name }))}
                placeholder="Please select"
                className="cost-bar-select"
                allowClear
              />
            </label>
            <label className="cost-bar-field">
              <span>Remark</span>
              <input
                id="bulk-cost-remark"
                name="bulkCost.remark"
                type="text"
                value={costs.remark}
                onChange={(event) => updateCost('remark', event.target.value)}
                placeholder="บันทึกไว้กับ revision"
              />
            </label>
          </div>
        </details>

        <div className="cost-bar-note">
          <Info size={16} aria-hidden="true" />
          <span>PKH / SOC กรอกตาม Currency ของ Supplier แล้วแปลงด้วย Ex. Rate ส่วน FR / CC / Wire TT กรอกเป็น THB โดยตรง และระบบจะปันส่วนต่อชิ้นหลัง CAL</span>
        </div>
      </section>

      <div className="allocation-workspace-stack">
        <section className="panel selector-panel" aria-labelledby="selector-title">
          <div className="cost-bar-step-heading">
            <div className="cost-bar-step-title-row">
              <span className="cost-bar-step-badge">2</span>
              <div>
                <h2 id="selector-title">Line Items Grid <span>(ข้อมูลระดับรายการสินค้า)</span></h2>
                <p>ดู/แก้ไขรายการสินค้า เลือก lines สำหรับ CAL ก่อนคำนวณ</p>
              </div>
            </div>
            <div className="cost-bar-title-icon">
              <Boxes size={20} aria-hidden="true" />
            </div>
          </div>

          <div className="supplier-box">
            <span>Selected supplier</span>
            <strong>{supplierName}</strong>
            <small>
              Vendor code: {supplierCode}. Latest rows are editable and selected rows are sent to CAL.
            </small>
          </div>

          <div className="summary-strip source-summary-strip">
            <SummaryItem label="Selected lines" value={`${selectedLines.length} / ${allLines.length}`} />
            <SummaryItem label="Total qty" value={fmt(totalQty)} />
            <SummaryItem label="Total amount" value={`${selectedLines[0]?.currency ?? ''} ${fmt(totalAmount)}`} />
            <SummaryItem
              label="Known weight"
              value={`${fmt(totalWeight)} kg`}
              warning={linesWithWarning > 0 ? `${linesWithWarning} missing` : undefined}
            />
            <SummaryItem
              label="Chargeable W"
              value={totalChargeableWeight > 0 ? `${fmt(totalChargeableWeight)} kg` : '—'}
            />
          </div>

          <div className="line-view-toolbar" aria-label="Source data views">
            <button
              className={`line-view-tab ${sourceView === 'latest' ? 'line-view-tab-active' : ''}`}
              type="button"
              onClick={() => setSourceView('latest')}
            >
              Latest
            </button>
            <button
              className={`line-view-tab ${sourceView === 'origin' ? 'line-view-tab-active' : ''}`}
              type="button"
              onClick={() => setSourceView('origin')}
            >
              Origin
            </button>
            <button
              className={`line-view-tab ${sourceView === 'changes' ? 'line-view-tab-active' : ''} ${lineChanges.length === 0 ? 'line-view-tab-zero' : ''}`}
              type="button"
              onClick={() => setSourceView('changes')}
            >
              Changes
              <span>{lineChanges.length}</span>
            </button>
            <small>
              CAL uses selected Latest rows only.
            </small>
            {isLatestView && (
              <button
                type="button"
                className="primary-button compact-btn add-item-btn"
                onClick={addLine}
              >
                + Add Item
              </button>
            )}
          </div>

          {sourceView !== 'changes' && (
            <div className="column-preset-toolbar" aria-label="Source line column presets">
              <span>Columns</span>
              <button
                className={`line-view-tab ${lineColumnPreset === 'overview' ? 'line-view-tab-active' : ''}`}
                type="button"
                onClick={() => setLineColumnPreset('overview')}
              >
                2.1 ข้อมูลสินค้า
              </button>
              <button
                className={`line-view-tab ${lineColumnPreset === 'logistics' ? 'line-view-tab-active' : ''}`}
                type="button"
                onClick={() => setLineColumnPreset('logistics')}
              >
                2.2 เงื่อนไขการซื้อ
              </button>
              <button
                className={`line-view-tab ${lineColumnPreset === 'weight' ? 'line-view-tab-active' : ''}`}
                type="button"
                onClick={() => setLineColumnPreset('weight')}
              >
                2.3 ต้นทุนค่าขนส่ง
              </button>
              <button
                className={`line-view-tab ${lineColumnPreset === 'docs' ? 'line-view-tab-active' : ''}`}
                type="button"
                onClick={() => setLineColumnPreset('docs')}
              >
                2.4 ค่าเอกสาร
              </button>
              <button
                className={`line-view-tab ${lineColumnPreset === 'pricing' ? 'line-view-tab-active' : ''}`}
                type="button"
                onClick={() => setLineColumnPreset('pricing')}
              >
                2.5 ราคาซื้อและประกันภัย
              </button>
              <button
                className={`line-view-tab ${lineColumnPreset === 'sales' ? 'line-view-tab-active' : ''}`}
                type="button"
                onClick={() => setLineColumnPreset('sales')}
              >
                2.6 เงื่อนไขการขาย
              </button>
              <button
                className={`line-view-tab ${lineColumnPreset === 'all' ? 'line-view-tab-active' : ''}`}
                type="button"
                onClick={() => setLineColumnPreset('all')}
              >
                2.7 แสดงทั้งหมด (Show All)
              </button>
            </div>
          )}

          {sourceView !== 'changes' && (
            <p className="preset-hint">
              {lineColumnPreset === 'logistics' && 'ค่าเริ่มต้นมาจาก Step 1 แต่แก้รายบรรทัดได้: Purchase Term / Term Location / Sub Location / Ship Mode และค่า Duty / INS / STK มีผลต่อต้นทุนนำเข้า'}
              {lineColumnPreset === 'overview' && 'ตรวจสอบ Item Group / Mfr Brand / Mfr Catalog No / Country of Origin / HS Code / Supp Order Code ก่อนคำนวณ'}
              {lineColumnPreset === 'weight' && 'กรอก Item Weight และ L×W×H — ระบบคำนวณ Dim Weight อัตโนมัติ | Ship Weight = Max(Item Wt, Dim Wt) CEILING ทุก 0.5 kg'}
              {lineColumnPreset === 'docs' && 'กรอก Document Fee รายบรรทัด'}
              {lineColumnPreset === 'pricing' && 'กรอก Qty, Unit Price, Currency รายบรรทัด — ค่า allocated และ Order Price จะแสดงหลังคำนวณ (CAL)'}
              {lineColumnPreset === 'sales' && 'Sales Term / Sales Sub Location / Sales UOM / Sales Conversion / SPK / QOC / Markup เป็นฝั่งขาย แยกออกจากเงื่อนไขซื้อและต้นทุนนำเข้า'}
              {lineColumnPreset === 'all' && 'แสดงทุกคอลัมน์ — อ่านอย่างเดียว ใช้เพื่อ review ก่อนคำนวณ'}
            </p>
          )}

          {allLines.length === 0 ? (
            <div className="empty-state">
              <Search size={32} aria-hidden="true" />
              <p>Blank manual run.</p>
              <small>Add the first item line, then edit Qty / Price / Weight before CAL.</small>
              {isLatestView && (
                <button
                  type="button"
                  className="primary-button compact-btn"
                  onClick={addLine}
                >
                  + Add First Item
                </button>
              )}
            </div>
          ) : sourceView === 'changes' ? (
            <ChangesTable changes={lineChanges} onResetField={resetLatestFieldToOrigin} />
          ) : (
            <>
              <div className="table-scroll line-table-scroll">
                <table
                  className="prototype-table bulk-line-table"
                  data-resizable-table={lineTableSizing.tableId}
                  style={lineTableSizing.getTableStyleForColumns(visibleLineColumns)}
                >
                  <colgroup>
                    {visibleLineColumns.map((column) => (
                      <col key={column.key} style={lineTableSizing.getColumnStyle(column.key)} />
                    ))}
                  </colgroup>
                  <thead>
                    <tr>
                      {visibleLineColumns.map((column) => {
                        const stickyLeft = lineTableSizing.getStickyLeft(column.key, LINE_STICKY_KEYS);
                        return column.key === 'select' ? (
                          <th
                            key="select"
                            className={`resizable-table-header ${stickyLeft !== undefined ? 'sticky-col' : ''}`}
                            style={stickyLeft !== undefined ? { position: 'sticky', left: stickyLeft, zIndex: 10 } : undefined}
                            {...lineTableSizing.getCellProps('select')}
                          >
                            <input
                              ref={selectAllRef}
                              type="checkbox"
                              checked={allLines.length > 0 && selectedKeys.size === allLines.length}
                              disabled={!isLatestView}
                              onChange={toggleAllLines}
                              aria-label={selectedKeys.size === allLines.length ? 'Deselect all lines' : 'Select all lines'}
                            />
                          </th>
                        ) : (
                          <ResizableHeader
                            columnKey={column.key}
                            key={column.key}
                            label={LINE_COLUMN_LABELS[column.key] ?? column.key}
                            sizing={lineTableSizing}
                            stickyLeft={stickyLeft}
                            className={column.key === LINE_STICKY_KEYS[LINE_STICKY_KEYS.length - 1] ? 'sticky-col-last' : undefined}
                          />
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {displayedLines.map((line) => {
                      const checked = selectedKeys.has(line.lineKey);
                      const weight = line.shippingWeightPerEach ?? line.dimensionWeightPerEach ?? line.itemWeightPerEach;
                      const missingWeight = weight === null || weight <= 0;
                      return (
                        <tr className={checked ? '' : 'row-muted'} key={line.lineKey}>
                          {visibleLineColumns.map((column) => (
                            <SourceLineCell
                              key={column.key}
                              columnKey={column.key}
                              allocatedCosts={(() => {
                                if (!preview) return null;
                                const result = preview.lines.find((r) => r.lineKey === line.lineKey);
                                if (!result) return null;
                                const fr = getFinalResultForLine(result);
                                return {
                                  pkhEa: result.pkhPerEach,
                                  socEa: result.socPerEach,
                                  frEa: result.freightPerEach,
                                  ccEa: result.ccPerEach,
                                  ttEa: result.wireTTPerEach,
                                  op1Fcy: fr.op1Source,
                                  exRate: fr.rateExchange,
                                  op1Thb: fr.op1,
                                  insAmount: fr.ins,
                                };
                              })()}
                              changedCellKeys={changedCellKeys}
                              checked={checked}
                              editable={isLatestView && canEditLineColumnInPreset(lineColumnPreset, column.key)}
                              countryOptions={countrySelectOptions}
                              currencyOptions={currencySelectOptions}
                              itemCategoryOptions={itemCategorySelectOptions}
                              itemGroupOptions={itemGroupSelectOptions}
                              brandOptions={brandSelectOptions}
                              line={line}
                              missingWeight={missingWeight}
                              shipModeOptions={shipModeSelectOptions}
                              stickyLeft={lineTableSizing.getStickyLeft(column.key, LINE_STICKY_KEYS)}
                              stickyLast={column.key === LINE_STICKY_KEYS[LINE_STICKY_KEYS.length - 1]}
                              tableSizing={lineTableSizing}
                              uomOptions={uomLookups}
                              orderTermOptions={orderTermSelectOptions}
                              permitTypeOptions={permitTypeSelectOptions}
                              locationOptions={locationSelectOptions}
                              subLocationOptions={getLineSubLocationOptions(line)}
                              salesSubLocationOptions={getLineSalesSubLocationOptions(line)}
                              onDeleteLine={deleteLine}
                              onDocFeeChange={updateLineDocFee}
                              onDocFeeBasisChange={updateLineDocFeeBasis}
                              onNullableNumberChange={updateLineNullableNumberField}
                              onNumberChange={updateLineNumberField}
                              onTextChange={updateLineTextField}
                              onToggleLine={toggleLine}
                            />
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      </div>

      {docFeeCandidates.length > 0 && (
        <section className="panel" aria-labelledby="by-lot-title">
          <div className="panel-header">
            <div>
              <p className="eyebrow">By Lot / Batch</p>
              <h2 id="by-lot-title">Service Line Candidates</h2>
            </div>
            <BadgeDollarSign size={22} aria-hidden="true" />
          </div>
          <p className="panel-note">
            These fees are excluded from product OP1. Sales must verify, edit, or delete before final save.
          </p>
          <div className="table-scroll">
            <table className="prototype-table">
              <thead>
                <tr>
                  <th>Src No</th>
                  <th>Description</th>
                  <th>Qty</th>
                  <th>UOM</th>
                  <th style={{ textAlign: 'right' }}>Unit Price</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                  <th>Currency</th>
                </tr>
              </thead>
              <tbody>
                {docFeeCandidates.map((c) => (
                  <tr key={c.lineKey}>
                    <td className="center-cell">{c.sourceLineNo}</td>
                    <td className="text-left-cell">{c.description}</td>
                    <td className="center-cell">{c.qty}</td>
                    <td className="center-cell">{c.uom}</td>
                    <td className="numeric-cell">{fmt(c.unitPrice)}</td>
                    <td className="numeric-cell">{fmt(c.amount)}</td>
                    <td className="center-cell">{c.currency}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="panel preview-panel" aria-labelledby="preview-title">
        <div className="cost-bar-step-heading">
          <div className="cost-bar-step-title-row">
            <span className="cost-bar-step-badge cost-bar-step-badge--green">3</span>
            <div>
              <h2 id="preview-title">Cost Result Grid <span>(แสดงผลลัพธ์การปันส่วนต่อชิ้น)</span></h2>
              <p>ผลการปันส่วนค่าใช้จ่ายรวมลงแต่ละสินค้า พร้อม preview Item/Term draft</p>
            </div>
          </div>
          {preview !== null && !isCalculating && (
            <span className="calculated-badge">
              <CheckCircle2 size={16} aria-hidden="true" />
              Calculated
            </span>
          )}
        </div>

        {calcError && (
          <div className="run-warnings">
            <div className="run-warning-item error">
              <XCircle size={16} aria-hidden="true" />
              <span>{calcError}</span>
            </div>
          </div>
        )}

        {isCalculating ? (
          <div className="preview-loading">
            <Loader2 size={28} className="spin-icon" aria-hidden="true" />
            <p>Calculating cost result...</p>
          </div>
        ) : preview === null ? (
          <div className="preview-empty">
            <Info size={28} aria-hidden="true" />
            <p>{selectedLines.length > 0 ? <>Click <strong>CAL</strong> to calculate selected lines.</> : 'Add and select at least one line before CAL.'}</p>
            <small>Save Revision is available after CAL returns a result.</small>
          </div>
        ) : (
          <>
            {preview.runWarnings.length > 0 && (
              <div className="run-warnings">
                {preview.runWarnings.map((warning, index) => (
                  <div className={`run-warning-item ${warning.severity}`} key={`${warning.code}-${index}`}>
                    {warning.severity === 'error' ? (
                      <XCircle size={16} aria-hidden="true" />
                    ) : (
                      <AlertTriangle size={16} aria-hidden="true" />
                    )}
                    <span>{warning.message}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="result-view-toolbar" aria-label="Calculation result views">
              <span>View</span>
              <button
                className={`line-view-tab ${resultView === 'review' ? 'line-view-tab-active' : ''}`}
                type="button"
                onClick={() => setResultView('review')}
              >
                Review
              </button>
              {SHOW_FORMULA && (
                <>
                  <button
                    className={`line-view-tab ${resultView === 'formula' ? 'line-view-tab-active' : ''}`}
                    type="button"
                    onClick={() => setResultView('formula')}
                  >
                    Formula
                  </button>
                  <button
                    className={`line-view-tab ${resultView === 'full' ? 'line-view-tab-active' : ''}`}
                    type="button"
                    onClick={() => setResultView('full')}
                  >
                    All Columns
                  </button>
                </>
              )}
              <small>Selected columns are editable before save.</small>
            </div>

            <div className="summary-strip preview-summary">
              <SummaryItem label="Lines" value={String(preview.totalLines)} />
              <SummaryItem label="Total Qty" value={fmt(preview.totalQty)} />
              <SummaryItem label="Total Amount" value={fmt(preview.totalAmount)} />
              <SummaryItem label="Total Weight" value={`${fmt(preview.totalWeight)} kg`} />
              <SummaryItem label="Weight OK" value={`${preview.weightAvailable} / ${preview.totalLines}`} />
              {(() => {
                const errCount = preview.lines.filter((l) => l.status === 'error').length;
                const warnCount = preview.lines.filter((l) => l.status === 'warning').length;
                return (
                  <>
                    {errCount > 0 && (
                      <span className="summary-pill summary-pill-error">
                        <XCircle size={13} aria-hidden="true" />
                        {errCount} error{errCount > 1 ? 's' : ''}
                      </span>
                    )}
                    {warnCount > 0 && (
                      <span className="summary-pill summary-pill-warning">
                        <AlertTriangle size={13} aria-hidden="true" />
                        {warnCount} warning{warnCount > 1 ? 's' : ''}
                      </span>
                    )}
                    {errCount === 0 && warnCount === 0 && (
                      <span className="summary-pill summary-pill-ok">
                        <CheckCircle2 size={13} aria-hidden="true" />
                        All OK
                      </span>
                    )}
                  </>
                );
              })()}
            </div>

            <ResultTable
              costs={costs}
              fullTableSizing={fullTableSizing}
              formulaTableSizing={formulaTableSizing}
              getFinalResultForLine={getFinalResultForLine}
              onEdit={updatePreviewEdit}
              onOpenDraftPreview={(mode, lineKey) => {
                if (!preview) return;
                const result = preview.lines.find((l) => l.lineKey === lineKey);
                const source = selectedLines.find((l) => l.lineKey === lineKey);
                if (!result || !source) return;
                const finalResult = getFinalResultForLine(result);
                const now = Date.now();
                if (mode === 'item') {
                  const key = storeBulkCostPreview({
                    type: 'item',
                    meta: { type: 'item', lineKey, description: source.sapDescription, supplierName: source.vendorName, createdAt: now },
                    itemData: mapBulkCostToItemData(source),
                  });
                  window.open(`/item/preview?key=${encodeURIComponent(key)}`, '_blank', 'noopener');
                } else {
                  const key = storeBulkCostPreview({
                    type: 'term',
                    meta: { type: 'term', lineKey, description: source.sapDescription, supplierName: source.vendorName, createdAt: now },
                    formData: mapBulkCostToTermFormData(source, costs, finalResult),
                    calcResults: mapBulkCostToTermCalcResults(source, finalResult),
                  });
                  window.open(`/term/preview?key=${encodeURIComponent(key)}`, '_blank', 'noopener');
                }
              }}
              preview={preview}
              resultView={resultView}
              reviewTableSizing={reviewTableSizing}
              selectedLines={selectedLines}
            />
          </>
        )}
      </section>
      </div>
      )}
    </div>
  );
}

function ResizableHeader({
  columnKey,
  label,
  sizing,
  rowSpan,
  className,
  stickyLeft,
}: {
  columnKey: string;
  label: string;
  sizing: ResizableTableSizing;
  rowSpan?: number;
  className?: string;
  stickyLeft?: number;
}) {
  return (
    <th
      className={`resizable-table-header ${className || ''} ${stickyLeft !== undefined ? 'sticky-col' : ''}`}
      rowSpan={rowSpan}
      style={stickyLeft !== undefined ? { position: 'sticky', left: stickyLeft, zIndex: 10 } : undefined}
      {...sizing.getCellProps(columnKey)}
    >
      <span>{label}</span>
      {sizing.renderResizeHandle(columnKey)}
    </th>
  );
}

function hasChanged(changedCellKeys: Set<string>, lineKey: string, fieldKey: LineFieldKey): boolean {
  return changedCellKeys.has(`${lineKey}:${fieldKey}`);
}

function cellChangedClass(changed: boolean, className = ''): string {
  return `${className} ${changed ? 'line-cell-modified' : ''}`.trim();
}

function SourceLineCell({
  allocatedCosts,
  brandOptions,
  changedCellKeys,
  checked,
  columnKey,
  countryOptions,
  currencyOptions,
  editable,
  itemCategoryOptions,
  itemGroupOptions,
  locationOptions,
  line,
  missingWeight,
  orderTermOptions,
  permitTypeOptions,
  shipModeOptions,
  stickyLast,
  stickyLeft,
  subLocationOptions,
  salesSubLocationOptions,
  tableSizing,
  uomOptions,
  onDeleteLine,
  onDocFeeChange,
  onDocFeeBasisChange,
  onNullableNumberChange,
  onNumberChange,
  onTextChange,
  onToggleLine,
}: {
  allocatedCosts: { pkhEa: number; socEa: number; frEa: number; ccEa: number; ttEa: number; op1Fcy: number; exRate: number; op1Thb: number; insAmount: number } | null;
  brandOptions: LookupOption[];
  changedCellKeys: Set<string>;
  checked: boolean;
  columnKey: string;
  countryOptions: LookupOption[];
  currencyOptions: CurrencyLookupOption[];
  editable: boolean;
  itemCategoryOptions: LookupOption[];
  itemGroupOptions: LookupOption[];
  locationOptions: LocationLookupOption[];
  line: AllocationLineSource;
  missingWeight: boolean;
  orderTermOptions: string[];
  permitTypeOptions: LookupOption[];
  shipModeOptions: Array<{ value: number; label: string }>;
  stickyLast: boolean;
  stickyLeft?: number;
  subLocationOptions: string[];
  salesSubLocationOptions: string[];
  tableSizing: ResizableTableSizing;
  uomOptions: Array<{ value: string; label: string }>;
  onDocFeeChange: (lineKey: string, key: keyof DocumentFees, raw: string) => void;
  onDocFeeBasisChange: (lineKey: string, key: keyof DocumentFees, basis: 'PER_EACH' | 'BY_LOT_BATCH') => void;
  onNullableNumberChange: (lineKey: string, key: EditableLineNullableNumberField, raw: string) => void;
  onNumberChange: (lineKey: string, key: EditableLineNumberField, raw: string) => void;
  onTextChange: (lineKey: string, key: EditableLineTextField, value: string) => void;
  onToggleLine: (lineKey: string) => void;
  onDeleteLine: (lineKey: string) => void;
}) {
  const stickyClass = stickyLeft !== undefined ? `sticky-col ${stickyLast ? 'sticky-col-last' : ''}` : '';
  const stickyStyle = stickyLeft !== undefined ? { position: 'sticky' as const, left: stickyLeft, zIndex: 2 } : undefined;

  const docFeeField = DOC_FEE_FIELDS.find((field) => getDocFeeColumnKey(field.key) === columnKey);
  if (docFeeField) {
    return (
      <td {...tableSizing.getCellProps(columnKey)}>
        <LineDocFeeCell
          changed={hasChanged(changedCellKeys, line.lineKey, `docFee.${docFeeField.key}`)}
          editable={editable}
          field={docFeeField}
          line={line}
          onChange={(value) => onDocFeeChange(line.lineKey, docFeeField.key, value)}
          onBasisChange={(basis) => onDocFeeBasisChange(line.lineKey, docFeeField.key, basis)}
        />
      </td>
    );
  }

  switch (columnKey) {
    case 'select':
      return (
        <td {...tableSizing.getCellProps('select')} className={stickyClass} style={stickyStyle}>
          <input
            id={`bulk-line-${line.lineKey}`}
            name={`bulkLine.${line.lineKey}.selected`}
            type="checkbox"
            checked={checked}
            disabled={!editable}
            onChange={() => onToggleLine(line.lineKey)}
          />
        </td>
      );
    case 'delete':
      return (
        <td {...tableSizing.getCellProps('delete')} className={cellChangedClass(false, `center-cell ${stickyClass}`)} style={stickyStyle}>
          {editable && (
            <button
              type="button"
              className="line-delete-btn"
              aria-label="Delete line"
              onClick={() => onDeleteLine(line.lineKey)}
            >
              <Trash2 size={14} aria-hidden="true" />
            </button>
          )}
        </td>
      );
    case 'no':
      return <td {...tableSizing.getCellProps('no')} className={`center-cell ${stickyClass}`.trim()} style={stickyStyle}>{line.no}</td>;
    case 'itemGroup':
      return <LineItemGroupCell changed={hasChanged(changedCellKeys, line.lineKey, 'itemGroup')} editable={editable} itemGroupOptions={itemGroupOptions} line={line} tableSizing={tableSizing} onChange={(value) => onTextChange(line.lineKey, 'itemGroup', value)} />;
    case 'itemCategory':
      return <LineLookupTextCell changed={hasChanged(changedCellKeys, line.lineKey, 'itemCategory')} columnKey="itemCategory" editable={editable} line={line} options={ensureLookupOption(itemCategoryOptions, line.itemCategory)} tableSizing={tableSizing} value={line.itemCategory} onChange={(value) => onTextChange(line.lineKey, 'itemCategory', value)} />;
    case 'customerStockCode':
      return <LineTextCell changed={hasChanged(changedCellKeys, line.lineKey, 'customerStockCode')} columnKey="customerStockCode" editable={editable} line={line} tableSizing={tableSizing} value={line.customerStockCode} onChange={(value) => onTextChange(line.lineKey, 'customerStockCode', value)} />;
    case 'matchStatus':
      return <td {...tableSizing.getCellProps('matchStatus')} className="center-cell">{formatMatchStatus(line.itemCode)}</td>;
    case 'description':
      return <LineTextCell changed={hasChanged(changedCellKeys, line.lineKey, 'sapDescription')} className={`text-left-cell ${stickyClass}`.trim()} columnKey="description" editable={editable} line={line} stickyStyle={stickyStyle} tableSizing={tableSizing} value={line.sapDescription} onChange={(value) => onTextChange(line.lineKey, 'sapDescription', value)} />;
    case 'manufacturer':
      return <LineLookupTextCell changed={hasChanged(changedCellKeys, line.lineKey, 'manufacturer')} columnKey="manufacturer" editable={editable} line={line} options={brandOptions} tableSizing={tableSizing} value={line.manufacturer} onChange={(value) => onTextChange(line.lineKey, 'manufacturer', value)} />;
    case 'mfgPartNumber':
      return <LineTextCell changed={hasChanged(changedCellKeys, line.lineKey, 'mfgPartNumber')} columnKey="mfgPartNumber" editable={editable} line={line} tableSizing={tableSizing} value={line.mfgPartNumber} onChange={(value) => onTextChange(line.lineKey, 'mfgPartNumber', value)} />;
    case 'supplierOrderCode':
      return <LineTextCell changed={hasChanged(changedCellKeys, line.lineKey, 'supplierOrderCode')} columnKey="supplierOrderCode" editable={editable} line={line} tableSizing={tableSizing} value={line.supplierOrderCode} onChange={(value) => onTextChange(line.lineKey, 'supplierOrderCode', value)} />;
    case 'qty':
      return <LineNumberCell changed={hasChanged(changedCellKeys, line.lineKey, 'qty')} columnKey="qty" editable={editable} line={line} tableSizing={tableSizing} tdClassName="center-cell" value={line.qty} onChange={(value) => onNumberChange(line.lineKey, 'qty', value)} />;
    case 'uom':
      return <LineUomCell changed={hasChanged(changedCellKeys, line.lineKey, 'uom')} columnKey="uom" editable={editable} line={line} options={uomOptions} tableSizing={tableSizing} value={line.uom} onChange={(value) => onTextChange(line.lineKey, 'uom', value)} />;
    case 'unitPrice':
      return <LineNumberCell changed={hasChanged(changedCellKeys, line.lineKey, 'unitPrice')} columnKey="unitPrice" editable={editable} line={line} tableSizing={tableSizing} tdClassName="numeric-cell" value={line.unitPrice} onChange={(value) => onNumberChange(line.lineKey, 'unitPrice', value)} />;
    case 'amount':
      return <td {...tableSizing.getCellProps('amount')} className={cellChangedClass(hasChanged(changedCellKeys, line.lineKey, 'amount'), 'numeric-cell')}>{fmt(line.amount)}</td>;
    case 'currency':
      return <LineCurrencyCell changed={hasChanged(changedCellKeys, line.lineKey, 'currency')} currencyOptions={currencyOptions} editable={editable} line={line} tableSizing={tableSizing} onChange={(value) => onTextChange(line.lineKey, 'currency', value)} />;
    case 'hsCode':
      return <LineTextCell changed={hasChanged(changedCellKeys, line.lineKey, 'hsCode')} columnKey="hsCode" editable={editable} line={line} tableSizing={tableSizing} value={line.hsCode} onChange={(value) => onTextChange(line.lineKey, 'hsCode', value)} />;
    case 'countryOfOrigin':
      return <LineLookupTextCell changed={hasChanged(changedCellKeys, line.lineKey, 'countryOfOrigin')} columnKey="countryOfOrigin" editable={editable} line={line} options={countryOptions} tableSizing={tableSizing} value={line.countryOfOrigin} onChange={(value) => onTextChange(line.lineKey, 'countryOfOrigin', value)} />;
    case 'leadTime':
      return <LineTextCell changed={hasChanged(changedCellKeys, line.lineKey, 'deliveryLeadTime')} columnKey="leadTime" editable={editable} line={line} tableSizing={tableSizing} value={line.deliveryLeadTime} onChange={(value) => onTextChange(line.lineKey, 'deliveryLeadTime', value)} />;
    case 'orderTerm':
      return <LineSelectTextCell changed={hasChanged(changedCellKeys, line.lineKey, 'orderTerm')} columnKey="orderTerm" editable={editable} line={line} options={orderTermOptions.map((term) => ({ value: term, label: term }))} tableSizing={tableSizing} value={line.orderTerm} onChange={(value) => onTextChange(line.lineKey, 'orderTerm', value)} />;
    case 'location':
      return <LineLocationCell changed={hasChanged(changedCellKeys, line.lineKey, 'location')} editable={editable} line={line} locationOptions={locationOptions} tableSizing={tableSizing} onChange={(value) => onTextChange(line.lineKey, 'location', value)} />;
    case 'subLocation':
      return <LineSelectTextCell changed={hasChanged(changedCellKeys, line.lineKey, 'subLocation')} columnKey="subLocation" editable={editable} line={line} options={subLocationOptions.map((subLocation) => ({ value: subLocation, label: subLocation }))} tableSizing={tableSizing} value={line.subLocation} onChange={(value) => onTextChange(line.lineKey, 'subLocation', value)} />;
    case 'salesTerm':
      return <LineSelectTextCell changed={hasChanged(changedCellKeys, line.lineKey, 'salesTerm')} columnKey="salesTerm" editable={editable} line={line} options={orderTermOptions.map((term) => ({ value: term, label: term }))} tableSizing={tableSizing} value={line.salesTerm || ''} onChange={(value) => onTextChange(line.lineKey, 'salesTerm', value)} />;
    case 'salesSubLocation':
      return <LineSelectTextCell changed={hasChanged(changedCellKeys, line.lineKey, 'salesSubLocation')} columnKey="salesSubLocation" editable={editable} line={line} options={salesSubLocationOptions.map((subLocation) => ({ value: subLocation, label: subLocation }))} tableSizing={tableSizing} value={line.salesSubLocation || ''} onChange={(value) => onTextChange(line.lineKey, 'salesSubLocation', value)} />;
    case 'shipMode':
      return (
        <td {...tableSizing.getCellProps('shipMode')} className={cellChangedClass(hasChanged(changedCellKeys, line.lineKey, 'shipModeNo'), 'center-cell')}>
          {editable ? (
            <select
              id={`latest-${line.lineKey}-shipMode`}
              name={`latest.${line.lineKey}.shipModeNo`}
              className="line-edit-input"
              value={line.shipModeNo}
              onMouseDownCapture={(e) => ensureSelectSpaceBelow(e.currentTarget)}
              onChange={(e) => onNumberChange(line.lineKey, 'shipModeNo', e.target.value)}
            >
              {shipModeOptions.map((mode) => (
                <option key={mode.value} value={mode.value}>{mode.label}</option>
              ))}
            </select>
          ) : (
            <span>{formatShipMode(line.shipModeNo)}</span>
          )}
        </td>
      );
    case 'importPermit':
      return <LineYesNoCell changed={hasChanged(changedCellKeys, line.lineKey, 'importPermit')} columnKey="importPermit" editable={editable} line={line} tableSizing={tableSizing} value={line.importPermit} onChange={(value) => onTextChange(line.lineKey, 'importPermit', value)} />;
    case 'permitType':
      return <LineLookupTextCell changed={hasChanged(changedCellKeys, line.lineKey, 'permitType')} columnKey="permitType" editable={editable} line={line} options={ensureLookupOption(permitTypeOptions, line.permitType)} tableSizing={tableSizing} value={line.permitType} onChange={(value) => onTextChange(line.lineKey, 'permitType', value)} />;
    case 'shelfLife':
      return <LineYesNoCell changed={hasChanged(changedCellKeys, line.lineKey, 'shelfLifeRequire')} columnKey="shelfLife" editable={editable} line={line} tableSizing={tableSizing} value={line.shelfLifeRequire} onChange={(value) => onTextChange(line.lineKey, 'shelfLifeRequire', value)} />;
    case 'itemWeight':
      return <LineNullableNumberCell changed={hasChanged(changedCellKeys, line.lineKey, 'itemWeightPerEach')} columnKey="itemWeight" editable={editable} line={line} tableSizing={tableSizing} tdClassName="numeric-cell" value={line.itemWeightPerEach} onChange={(value) => onNullableNumberChange(line.lineKey, 'itemWeightPerEach', value)} />;
    case 'dimWeight':
      return <LineNullableNumberCell changed={hasChanged(changedCellKeys, line.lineKey, 'dimensionWeightPerEach')} columnKey="dimWeight" editable={editable} line={line} tableSizing={tableSizing} tdClassName="numeric-cell" value={line.dimensionWeightPerEach} onChange={(value) => onNullableNumberChange(line.lineKey, 'dimensionWeightPerEach', value)} />;
    case 'chargeableWeight':
      return <td {...tableSizing.getCellProps('chargeableWeight')} className="numeric-cell">{fmt(getChargeableWeightPerEach(line))}</td>;
    case 'shipWeight':
      return <LineNullableNumberCell changed={hasChanged(changedCellKeys, line.lineKey, 'shippingWeightPerEach')} columnKey="shipWeight" editable={editable} line={line} tableSizing={tableSizing} tdClassName="numeric-cell" value={line.shippingWeightPerEach} onChange={(value) => onNullableNumberChange(line.lineKey, 'shippingWeightPerEach', value)} />;
    case 'freightRate':
      return <LineNullableNumberCell changed={hasChanged(changedCellKeys, line.lineKey, 'freightRate')} columnKey="freightRate" editable={editable} line={line} tableSizing={tableSizing} tdClassName="numeric-cell" value={line.freightRate} onChange={(value) => onNullableNumberChange(line.lineKey, 'freightRate', value)} />;
    case 'dimUnit':
      return (
        <td {...tableSizing.getCellProps('dimUnit')} className={cellChangedClass(hasChanged(changedCellKeys, line.lineKey, 'dimUnit'), 'center-cell')}>
          {editable ? (
            <select
              id={`latest-${line.lineKey}-dimUnit`}
              name={`latest.${line.lineKey}.dimUnit`}
              className="line-edit-input"
              value={line.dimUnit}
              onMouseDownCapture={(e) => ensureSelectSpaceBelow(e.currentTarget)}
              onChange={(e) => onNumberChange(line.lineKey, 'dimUnit', e.target.value)}
            >
              <option value={1}>CM</option>
              <option value={2}>INCH</option>
            </select>
          ) : (
            <span>{line.dimUnit === 2 ? 'INCH' : 'CM'}</span>
          )}
        </td>
      );
    case 'length':
      return <LineNumberCell changed={hasChanged(changedCellKeys, line.lineKey, 'length')} columnKey="length" editable={editable} line={line} tableSizing={tableSizing} tdClassName="numeric-cell" value={line.length} onChange={(value) => onNumberChange(line.lineKey, 'length', value)} />;
    case 'width':
      return <LineNumberCell changed={hasChanged(changedCellKeys, line.lineKey, 'width')} columnKey="width" editable={editable} line={line} tableSizing={tableSizing} tdClassName="numeric-cell" value={line.width} onChange={(value) => onNumberChange(line.lineKey, 'width', value)} />;
    case 'height':
      return <LineNumberCell changed={hasChanged(changedCellKeys, line.lineKey, 'height')} columnKey="height" editable={editable} line={line} tableSizing={tableSizing} tdClassName="numeric-cell" value={line.height} onChange={(value) => onNumberChange(line.lineKey, 'height', value)} />;
    case 'importDuty':
      return <LineNumberCell changed={hasChanged(changedCellKeys, line.lineKey, 'importDutyPercent')} columnKey="importDuty" editable={editable} line={line} tableSizing={tableSizing} tdClassName="numeric-cell" value={line.importDutyPercent} onChange={(value) => onNumberChange(line.lineKey, 'importDutyPercent', value)} />;
    case 'moq':
      return <LineNullableNumberCell changed={hasChanged(changedCellKeys, line.lineKey, 'moq')} columnKey="moq" editable={editable} line={line} tableSizing={tableSizing} tdClassName="numeric-cell" value={line.moq} onChange={(value) => onNullableNumberChange(line.lineKey, 'moq', value)} />;
    case 'insPercent':
      return <LineNumberCell changed={hasChanged(changedCellKeys, line.lineKey, 'insPercent')} columnKey="insPercent" editable={editable} line={line} tableSizing={tableSizing} tdClassName="numeric-cell" value={line.insPercent} onChange={(value) => onNumberChange(line.lineKey, 'insPercent', value)} />;
    case 'stkPercent':
      return <LineNumberCell changed={hasChanged(changedCellKeys, line.lineKey, 'stkPercent')} columnKey="stkPercent" editable={editable} line={line} tableSizing={tableSizing} tdClassName="numeric-cell" value={line.stkPercent} onChange={(value) => onNumberChange(line.lineKey, 'stkPercent', value)} />;
    case 'zoneRate':
      return <LineNumberCell changed={hasChanged(changedCellKeys, line.lineKey, 'zoneRate')} columnKey="zoneRate" editable={editable} line={line} tableSizing={tableSizing} tdClassName="numeric-cell" value={line.zoneRate} onChange={(value) => onNumberChange(line.lineKey, 'zoneRate', value)} />;
    case 'etPercent':
      return <LineNumberCell changed={hasChanged(changedCellKeys, line.lineKey, 'etPercent')} columnKey="etPercent" editable={editable} line={line} tableSizing={tableSizing} tdClassName="numeric-cell" value={line.etPercent} onChange={(value) => onNumberChange(line.lineKey, 'etPercent', value)} />;
    case 'miscTax':
      return <LineNumberCell changed={hasChanged(changedCellKeys, line.lineKey, 'miscTax')} columnKey="miscTax" editable={editable} line={line} tableSizing={tableSizing} tdClassName="numeric-cell" value={line.miscTax} onChange={(value) => onNumberChange(line.lineKey, 'miscTax', value)} />;
    case 'scc':
      return <LineNumberCell changed={hasChanged(changedCellKeys, line.lineKey, 'scc')} columnKey="scc" editable={editable} line={line} tableSizing={tableSizing} tdClassName="numeric-cell" value={line.scc} onChange={(value) => onNumberChange(line.lineKey, 'scc', value)} />;
    case 'sspk':
      return <LineNumberCell changed={hasChanged(changedCellKeys, line.lineKey, 'sspk')} columnKey="sspk" editable={editable} line={line} tableSizing={tableSizing} tdClassName="numeric-cell" value={line.sspk} onChange={(value) => onNumberChange(line.lineKey, 'sspk', value)} />;
    case 'qoc':
      return <LineNumberCell changed={hasChanged(changedCellKeys, line.lineKey, 'qoc')} columnKey="qoc" editable={editable} line={line} tableSizing={tableSizing} tdClassName="numeric-cell" value={line.qoc} onChange={(value) => onNumberChange(line.lineKey, 'qoc', value)} />;
    case 'markupPercent':
      return <LineNumberCell changed={hasChanged(changedCellKeys, line.lineKey, 'markupPercent')} columnKey="markupPercent" editable={editable} line={line} tableSizing={tableSizing} tdClassName="numeric-cell" value={line.markupPercent} onChange={(value) => onNumberChange(line.lineKey, 'markupPercent', value)} />;
    case 'purchaseUOM':
      return <LineUomCell changed={hasChanged(changedCellKeys, line.lineKey, 'purchaseUOM')} columnKey="purchaseUOM" editable={editable} line={line} options={uomOptions} tableSizing={tableSizing} value={line.purchaseUOM} onChange={(value) => onTextChange(line.lineKey, 'purchaseUOM', value)} />;
    case 'stockConversion':
      return <LineNumberCell changed={hasChanged(changedCellKeys, line.lineKey, 'stockConversion')} columnKey="stockConversion" editable={editable} line={line} tableSizing={tableSizing} tdClassName="numeric-cell" value={line.stockConversion} onChange={(value) => onNumberChange(line.lineKey, 'stockConversion', value)} />;
    case 'saleUOM':
      return <LineUomCell changed={hasChanged(changedCellKeys, line.lineKey, 'saleUOM')} columnKey="saleUOM" editable={editable} line={line} options={uomOptions} tableSizing={tableSizing} value={line.saleUOM} onChange={(value) => onTextChange(line.lineKey, 'saleUOM', value)} />;
    case 'saleConversion':
      return <LineNumberCell changed={hasChanged(changedCellKeys, line.lineKey, 'saleConversion')} columnKey="saleConversion" editable={editable} line={line} tableSizing={tableSizing} tdClassName="numeric-cell" value={line.saleConversion} onChange={(value) => onNumberChange(line.lineKey, 'saleConversion', value)} />;
    case 'pkhEa':
      return <td {...tableSizing.getCellProps('pkhEa')} className="numeric-cell alloc-readonly">{allocatedCosts ? fmt(allocatedCosts.pkhEa) : '—'}</td>;
    case 'socEa':
      return <td {...tableSizing.getCellProps('socEa')} className="numeric-cell alloc-readonly">{allocatedCosts ? fmt(allocatedCosts.socEa) : '—'}</td>;
    case 'frEa':
      return <td {...tableSizing.getCellProps('frEa')} className="numeric-cell alloc-readonly">{allocatedCosts ? fmt(allocatedCosts.frEa) : '—'}</td>;
    case 'ccEa':
      return <td {...tableSizing.getCellProps('ccEa')} className="numeric-cell alloc-readonly">{allocatedCosts ? fmt(allocatedCosts.ccEa) : '—'}</td>;
    case 'ttEa':
      return <td {...tableSizing.getCellProps('ttEa')} className="numeric-cell alloc-readonly">{allocatedCosts ? fmt(allocatedCosts.ttEa) : '—'}</td>;
    case 'docFeeTotal': {
      const docTotal = line.docFee.coc + line.docFee.millCert + line.docFee.testCert + line.docFee.coa + line.docFee.coo + line.docFee.anyOther;
      return <td {...tableSizing.getCellProps('docFeeTotal')} className="numeric-cell alloc-readonly">{fmt(docTotal)}</td>;
    }
    case 'op1Fcy':
      return <td {...tableSizing.getCellProps('op1Fcy')} className="numeric-cell alloc-readonly">{allocatedCosts ? fmt(allocatedCosts.op1Fcy) : '—'}</td>;
    case 'exRateCol':
      return <td {...tableSizing.getCellProps('exRateCol')} className="numeric-cell alloc-readonly">{allocatedCosts ? fmt(allocatedCosts.exRate) : '—'}</td>;
    case 'op1Thb':
      return <td {...tableSizing.getCellProps('op1Thb')} className="numeric-cell alloc-readonly">{allocatedCosts ? fmt(allocatedCosts.op1Thb) : '—'}</td>;
    case 'insAmount':
      return <td {...tableSizing.getCellProps('insAmount')} className="numeric-cell alloc-readonly">{allocatedCosts ? fmt(allocatedCosts.insAmount) : '—'}</td>;
    case 'status':
      return (
        <td {...tableSizing.getCellProps('status')} className="center-cell">
          {missingWeight ? (
            <span className="table-warning">
              <AlertTriangle size={14} aria-hidden="true" />
              No weight
            </span>
          ) : (
            <span className="table-ok">
              <CheckCircle2 size={14} aria-hidden="true" />
              Ready
            </span>
          )}
        </td>
      );
    default:
      return <td {...tableSizing.getCellProps(columnKey)}>-</td>;
  }
}

function LineItemGroupCell({
  changed,
  editable,
  itemGroupOptions,
  line,
  tableSizing,
  onChange,
}: {
  changed: boolean;
  editable: boolean;
  itemGroupOptions: LookupOption[];
  line: AllocationLineSource;
  tableSizing: ResizableTableSizing;
  onChange: (value: string) => void;
}) {
  const options = itemGroupOptions.some((option) => option.value === line.itemGroup)
    ? itemGroupOptions
    : [{ value: line.itemGroup, label: formatItemGroup(line.itemGroup) }, ...itemGroupOptions];
  const displayLabel = options.find((option) => option.value === line.itemGroup)?.label || formatItemGroup(line.itemGroup);

  return (
    <td {...tableSizing.getCellProps('itemGroup')} className={cellChangedClass(changed, 'center-cell')}>
      {editable ? (
        <select
          id={`latest-${line.lineKey}-itemGroup`}
          name={`latest.${line.lineKey}.itemGroup`}
          className="line-edit-input"
          value={line.itemGroup}
          onMouseDownCapture={(e) => ensureSelectSpaceBelow(e.currentTarget)}
          onChange={(event) => onChange(event.target.value)}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : (
        <span>{displayLabel || '-'}</span>
      )}
    </td>
  );
}

function LineUomCell({
  changed,
  columnKey,
  editable,
  line,
  options,
  tableSizing,
  value,
  onChange,
}: {
  changed: boolean;
  columnKey: string;
  editable: boolean;
  line: AllocationLineSource;
  options: Array<{ value: string; label: string }>;
  tableSizing: ResizableTableSizing;
  value: string;
  onChange: (value: string) => void;
}) {
  const selectOptions = options.some((option) => option.value === value)
    ? options
    : [{ value, label: value || '-' }, ...options];

  return (
    <td {...tableSizing.getCellProps(columnKey)} className={cellChangedClass(changed, 'center-cell')}>
      {editable && options.length > 0 ? (
        <select
          id={`latest-${line.lineKey}-${columnKey}`}
          name={`latest.${line.lineKey}.${columnKey}`}
          className="line-edit-input"
          value={value}
          onMouseDownCapture={(e) => ensureSelectSpaceBelow(e.currentTarget)}
          onChange={(event) => onChange(event.target.value)}
        >
          {selectOptions.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      ) : (
        <span>{value || '-'}</span>
      )}
    </td>
  );
}

function LineSelectTextCell({
  changed,
  columnKey,
  editable,
  line,
  options,
  tableSizing,
  value,
  onChange,
}: {
  changed: boolean;
  columnKey: string;
  editable: boolean;
  line: AllocationLineSource;
  options: Array<{ value: string; label: string }>;
  tableSizing: ResizableTableSizing;
  value: string;
  onChange: (value: string) => void;
}) {
  const selectOptions = options.some((option) => option.value === value)
    ? options
    : [{ value, label: value || '-' }, ...options];

  return (
    <td {...tableSizing.getCellProps(columnKey)} className={cellChangedClass(changed, 'center-cell')}>
      {editable && selectOptions.length > 0 ? (
        <select
          id={`latest-${line.lineKey}-${columnKey}`}
          name={`latest.${line.lineKey}.${columnKey}`}
          className="line-edit-input"
          value={value}
          onMouseDownCapture={(event) => ensureSelectSpaceBelow(event.currentTarget)}
          onChange={(event) => onChange(event.target.value)}
        >
          {selectOptions.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      ) : (
        <span>{value || '-'}</span>
      )}
    </td>
  );
}

function LineLocationCell({
  changed,
  editable,
  line,
  locationOptions,
  tableSizing,
  onChange,
}: {
  changed: boolean;
  editable: boolean;
  line: AllocationLineSource;
  locationOptions: LocationLookupOption[];
  tableSizing: ResizableTableSizing;
  onChange: (value: string) => void;
}) {
  const options = ensureLocationLookupOption(locationOptions, line.location);
  const selected = options.find((option) => option.code === line.location || option.name === line.location);

  return (
    <td {...tableSizing.getCellProps('location')} className={cellChangedClass(changed, 'center-cell')}>
      {editable ? (
        <select
          id={`latest-${line.lineKey}-location`}
          name={`latest.${line.lineKey}.location`}
          className="line-edit-input"
          value={selected?.code || line.location}
          onMouseDownCapture={(event) => ensureSelectSpaceBelow(event.currentTarget)}
          onChange={(event) => onChange(event.target.value)}
        >
          {options.map((option) => (
            <option key={option.code} value={option.code}>{locationOptionLabel(option)}</option>
          ))}
        </select>
      ) : (
        <span>{selected ? locationOptionLabel(selected) : line.location || '-'}</span>
      )}
    </td>
  );
}

function LineLookupTextCell({
  changed,
  columnKey,
  editable,
  line,
  options,
  tableSizing,
  value,
  onChange,
}: {
  changed: boolean;
  columnKey: string;
  editable: boolean;
  line: AllocationLineSource;
  options: LookupOption[];
  tableSizing: ResizableTableSizing;
  value: string;
  onChange: (value: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value || '');

  useEffect(() => {
    setInputValue(value || '');
  }, [value]);

  const filtered = useMemo(() => {
    const q = inputValue.toLowerCase().trim();
    if (!q) return options;
    return options.filter((opt) =>
      (opt.label || '').toLowerCase().includes(q) ||
      (opt.value || '').toLowerCase().includes(q)
    );
  }, [options, inputValue]);

  if (!editable) {
    return <LineTextCell changed={changed} columnKey={columnKey} editable={editable} line={line} tableSizing={tableSizing} value={value} onChange={onChange} />;
  }

  return (
    <td {...tableSizing.getCellProps(columnKey)} className={cellChangedClass(changed, 'center-cell relative')}>
      <div className="searchable-lookup-container w-full">
        <input
          id={`latest-${line.lineKey}-${columnKey}`}
          name={`latest.${line.lineKey}.${columnKey}`}
          type="text"
          className="line-edit-input w-full"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            onChange(e.target.value);
            setIsOpen(true);
          }}
          onFocus={(e) => {
            ensureSelectSpaceBelow(e.currentTarget);
            setIsOpen(true);
          }}
          onBlur={() => {
            setTimeout(() => setIsOpen(false), 200);
          }}
          placeholder="Select or type..."
        />
        {isOpen && (
          <div className="searchable-lookup-dropdown">
            {filtered.map((opt) => (
              <div
                key={opt.value}
                className={`searchable-lookup-option ${value === opt.value ? 'searchable-lookup-option--selected' : ''}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  setInputValue(opt.label || opt.value);
                  onChange(opt.value);
                  setIsOpen(false);
                }}
              >
                {opt.label || opt.value}
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="searchable-lookup-no-results">
                No match found
              </div>
            )}
          </div>
        )}
      </div>
    </td>
  );
}

function LineCurrencyCell({
  changed,
  currencyOptions,
  editable,
  line,
  tableSizing,
  onChange,
}: {
  changed: boolean;
  currencyOptions: CurrencyLookupOption[];
  editable: boolean;
  line: AllocationLineSource;
  tableSizing: ResizableTableSizing;
  onChange: (value: string) => void;
}) {
  const options = [
    { code: '', name: 'Please Select', exRate: 0 },
    ...ensureCurrencyLookupOption(currencyOptions, line.currency, 0),
  ];
  return (
    <td {...tableSizing.getCellProps('currency')} className={cellChangedClass(changed, 'center-cell')}>
      {editable ? (
        <select
          id={`latest-${line.lineKey}-currency`}
          name={`latest.${line.lineKey}.currency`}
          className="line-edit-input"
          value={line.currency}
          onMouseDownCapture={(e) => ensureSelectSpaceBelow(e.currentTarget)}
          onChange={(event) => onChange(event.target.value)}
        >
          {options.map((option) => (
            <option key={option.code} value={option.code}>
              {option.code || option.name}
            </option>
          ))}
        </select>
      ) : (
        <span>{line.currency || '-'}</span>
      )}
    </td>
  );
}

function LineTextCell({
  changed,
  className,
  columnKey,
  editable,
  line,
  stickyStyle,
  tableSizing,
  value,
  onChange,
}: {
  changed: boolean;
  className?: string;
  columnKey: string;
  editable: boolean;
  line: AllocationLineSource;
  stickyStyle?: CSSProperties;
  tableSizing: ResizableTableSizing;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <td {...tableSizing.getCellProps(columnKey)} className={cellChangedClass(changed, className)} style={stickyStyle}>
      {editable ? (
        <input
          id={`latest-${line.lineKey}-${columnKey}`}
          name={`latest.${line.lineKey}.${columnKey}`}
          className="line-edit-input"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <span>{value || '-'}</span>
      )}
    </td>
  );
}

function LineYesNoCell({
  changed,
  columnKey,
  editable,
  line,
  tableSizing,
  value,
  onChange,
}: {
  changed: boolean;
  columnKey: string;
  editable: boolean;
  line: AllocationLineSource;
  tableSizing: ResizableTableSizing;
  value: string;
  onChange: (value: string) => void;
}) {
  const normalizedValue = formatYesNo(value);

  return (
    <td {...tableSizing.getCellProps(columnKey)} className={cellChangedClass(changed, 'center-cell')}>
      {editable ? (
        <input
          type="checkbox"
          id={`latest-${line.lineKey}-${columnKey}`}
          name={`latest.${line.lineKey}.${columnKey}`}
          checked={normalizedValue === 'Yes'}
          onChange={(event) => onChange(event.target.checked ? 'Yes' : 'No')}
          style={{ width: '16px', height: '16px', cursor: 'pointer', verticalAlign: 'middle' }}
        />
      ) : (
        <input
          type="checkbox"
          checked={normalizedValue === 'Yes'}
          disabled
          style={{ width: '16px', height: '16px', verticalAlign: 'middle', opacity: 0.7 }}
        />
      )}
    </td>
  );
}

function LineNumberCell({
  changed,
  columnKey,
  editable,
  line,
  tableSizing,
  tdClassName,
  value,
  onChange,
}: {
  changed: boolean;
  columnKey: string;
  editable: boolean;
  line: AllocationLineSource;
  tableSizing: ResizableTableSizing;
  tdClassName?: string;
  value: number;
  onChange: (value: string) => void;
}) {
  return (
    <td {...tableSizing.getCellProps(columnKey)} className={cellChangedClass(changed, tdClassName)}>
      {editable ? (
        <FormattedNumberInput
          id={`latest-${line.lineKey}-${columnKey}`}
          name={`latest.${line.lineKey}.${columnKey}`}
          className="line-edit-input numeric"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <span>{fmtPlain(value) || '-'}</span>
      )}
    </td>
  );
}

function LineNullableNumberCell({
  changed,
  columnKey,
  editable,
  line,
  tableSizing,
  tdClassName,
  value,
  onChange,
}: {
  changed: boolean;
  columnKey: string;
  editable: boolean;
  line: AllocationLineSource;
  tableSizing: ResizableTableSizing;
  tdClassName?: string;
  value: number | null;
  onChange: (value: string) => void;
}) {
  return (
    <td {...tableSizing.getCellProps(columnKey)} className={cellChangedClass(changed, tdClassName)}>
      {editable ? (
        <FormattedNumberInput
          id={`latest-${line.lineKey}-${columnKey}`}
          name={`latest.${line.lineKey}.${columnKey}`}
          className="line-edit-input numeric"
          nullable
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <span>{fmtNullablePlain(value) || '-'}</span>
      )}
    </td>
  );
}

function LineDocFeeCell({
  changed,
  editable,
  field,
  line,
  onChange,
  onBasisChange,
}: {
  changed: boolean;
  editable: boolean;
  field: { key: keyof DocumentFees; label: string };
  line: AllocationLineSource;
  onChange: (value: string) => void;
  onBasisChange: (basis: 'PER_EACH' | 'BY_LOT_BATCH') => void;
}) {
  const value = line.docFee[field.key];
  const basis = line.docFeeBasis?.[field.key] ?? 'PER_EACH';
  const isByLot = basis === 'BY_LOT_BATCH';

  if (!editable) {
    return (
      <span className={changed ? 'line-readonly-modified' : ''}>
        {fmtPlain(value) || '-'}
        {isByLot && value !== 0 && <span className="doc-fee-by-lot-badge"> By Lot</span>}
      </span>
    );
  }

  return (
    <div className="doc-fee-cell-wrap">
      <FormattedNumberInput
        id={`bulk-line-${line.lineKey}-${field.key}`}
        name={`bulkLine.${line.lineKey}.docFee.${field.key}`}
        className={`doc-fee-input ${changed ? 'line-input-modified' : ''}`}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label={`${field.label} fee for ${line.itemCode || line.supplierOrderCode}`}
        title={!isByLot ? 'Per Each: enter amount per 1 unit (divide total by qty if supplier quotes a lump sum)' : 'By Lot/Batch: enter total lump-sum amount for the whole shipment'}
      />
      <div className="doc-fee-basis-toggle" role="group" aria-label={`${field.label} basis`}>
        <button
          type="button"
          className={`doc-fee-basis-btn${!isByLot ? ' active' : ''}`}
          onClick={() => onBasisChange('PER_EACH')}
          title="Per Each — included in OP1"
        >
          /Ea
        </button>
        <button
          type="button"
          className={`doc-fee-basis-btn${isByLot ? ' active by-lot' : ''}`}
          onClick={() => onBasisChange('BY_LOT_BATCH')}
          title="By Lot / Batch — separate service line"
        >
          Lot
        </button>
      </div>
    </div>
  );
}

function ChangesTable({
  changes,
  onResetField,
}: {
  changes: LineChange[];
  onResetField: (lineKey: string, fieldKey: LineFieldKey) => void;
}) {
  if (changes.length === 0) {
    return (
      <div className="preview-empty changes-empty">
        <Info size={28} aria-hidden="true" />
        <p>No changes from Origin.</p>
        <small>Latest currently matches the saved/manual baseline.</small>
      </div>
    );
  }

  return (
    <div className="table-scroll changes-table-scroll">
      <table className="prototype-table changes-table">
        <thead>
          <tr>
            <th>No</th>
            <th>Match</th>
            <th>Field</th>
            <th>Origin</th>
            <th>Latest</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {changes.map((change) => (
            <tr key={`${change.lineKey}-${change.fieldKey}`}>
              <td>{change.no}</td>
              <td>{formatMatchStatus(change.itemCode)}</td>
              <td className="text-left-cell"><strong>{change.label}</strong></td>
              <td className="text-left-cell change-origin">{change.originValue || '-'}</td>
              <td className="text-left-cell change-latest">{change.latestValue || '-'}</td>
              <td>
                <button
                  type="button"
                  className="table-action-button compact"
                  onClick={() => onResetField(change.lineKey, change.fieldKey)}
                >
                  Reset
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SummaryItem({
  label,
  value,
  warning,
}: {
  label: string;
  value: string;
  warning?: string;
}) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
      {warning && <small className="summary-warning">{warning}</small>}
    </div>
  );
}

type FormattedNumberInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
  value: number | null | undefined;
  nullable?: boolean;
  focused?: boolean;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
};

function FormattedNumberInput({
  value,
  nullable = false,
  focused,
  onBlur,
  onChange,
  onFocus,
  ...props
}: FormattedNumberInputProps) {
  const [internalFocused, setInternalFocused] = useState(false);
  const [draft, setDraft] = useState('');
  const isFocused = focused ?? internalFocused;

  useEffect(() => {
    if (!isFocused) setDraft(formatDisplayNumber(value, nullable));
  }, [isFocused, nullable, value]);

  return (
    <input
      {...props}
      inputMode="decimal"
      value={isFocused ? draft : formatDisplayNumber(value, nullable)}
      onBlur={(event) => {
        setInternalFocused(false);
        setDraft(formatDisplayNumber(value, nullable));
        onBlur?.(event);
      }}
      onChange={(event) => {
        setDraft(event.target.value);
        onChange(event);
      }}
      onFocus={(event) => {
        setInternalFocused(true);
        const editableValue = toEditableNumber(value);
        const input = event.currentTarget;
        setDraft(editableValue === '0' ? '' : editableValue);
        if (editableValue !== '0') {
          window.requestAnimationFrame(() => input.select());
        }
        onFocus?.(event);
      }}
    />
  );
}

function ResultTable({
  costs,
  fullTableSizing,
  formulaTableSizing,
  getFinalResultForLine,
  onEdit,
  onOpenDraftPreview,
  preview,
  resultView,
  reviewTableSizing,
  selectedLines,
}: {
  costs: BulkCostInput;
  fullTableSizing: ResizableTableSizing;
  formulaTableSizing: ResizableTableSizing;
  getFinalResultForLine: (line: AllocationLineResult) => FinalResultColumns;
  onEdit: (lineKey: string, key: FinalResultKey, raw: string) => void;
  onOpenDraftPreview: (mode: DraftPreviewMode, lineKey: string) => void;
  preview: AllocationPreview;
  resultView: ResultView;
  reviewTableSizing: ResizableTableSizing;
  selectedLines: AllocationLineSource[];
}) {
  const sourceByKey = new Map(selectedLines.map((line) => [line.lineKey, line]));

  if (resultView === 'review') {
    return (
      <div className="table-scroll">
        <table
          className="prototype-table review-result-table"
          data-resizable-table={reviewTableSizing.tableId}
          style={reviewTableSizing.tableStyle}
        >
          <colgroup>
            {REVIEW_RESULT_TABLE_COLUMNS.map((column) => (
              <col key={column.key} style={reviewTableSizing.getColumnStyle(column.key)} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <ResizableHeader columnKey="rowNo" label="No" rowSpan={2} sizing={reviewTableSizing} />
              <ResizableHeader columnKey="itemGroup" label="Group" rowSpan={2} sizing={reviewTableSizing} />
              <ResizableHeader columnKey="supplierOrderCode" label="Supp Order Code" rowSpan={2} sizing={reviewTableSizing} />
              <ResizableHeader columnKey="description" label="Description" rowSpan={2} sizing={reviewTableSizing} />
              <ResizableHeader columnKey="qty" label="Qty" rowSpan={2} sizing={reviewTableSizing} />
              <ResizableHeader columnKey="uom" label="UOM" rowSpan={2} sizing={reviewTableSizing} />
              {REVIEW_RESULT_GROUPS.map((group) => (
                <th key={group.label} colSpan={group.count} className={group.className}>{group.label}</th>
              ))}
              <ResizableHeader className="th-final" columnKey="draftPreview" label="Preview" rowSpan={2} sizing={reviewTableSizing} />
              <ResizableHeader className="th-final" columnKey="status" label="Status" rowSpan={2} sizing={reviewTableSizing} />
            </tr>
            <tr>
              {REVIEW_RESULT_KEYS.map((key) => (
                <ResizableHeader
                  className={getReviewColClass(key)}
                  columnKey={getFinalResultColumnKey(key)}
                  key={key}
                  label={REVIEW_LABEL_OVERRIDE[key] ?? FINAL_RESULT_COL_BY_KEY.get(key)?.label ?? key}
                  sizing={reviewTableSizing}
                />
              ))}
            </tr>
          </thead>
          <tbody>
            {preview.lines.map((result, index) => {
              const source = sourceByKey.get(result.lineKey);
              if (!source) return null;
              return (
                <ReviewResultRow
                  key={result.lineKey}
                  finalResult={getFinalResultForLine(result)}
                  index={index}
                  result={result}
                  source={source}
                  tableSizing={reviewTableSizing}
                  onEdit={onEdit}
                  onOpenDraftPreview={onOpenDraftPreview}
                />
              );
            })}
          </tbody>
          <tfoot>
            <tr className="result-totals-row">
              <td colSpan={4} className="totals-label-cell">Totals ({preview.lines.length} lines)</td>
              <td className="numeric-cell">{fmt(preview.lines.reduce((s, l) => s + (sourceByKey.get(l.lineKey)?.qty ?? 0), 0))}</td>
              <td />
              {REVIEW_RESULT_KEYS.map((key) => {
                const skip = key === 'rateExchange' || key === 'op1Source' || key === 'shipWeightCal' || key === 'markup';
                if (skip) return <td key={key} />;
                const col = FINAL_RESULT_COL_BY_KEY.get(key);
                if (!col || col.kind !== 'number') return <td key={key} />;
                const total = preview.lines.reduce((s, l) => s + (Number(getFinalResultForLine(l)[key]) || 0), 0);
                return <td key={key} className="numeric-cell">{fmt(total)}</td>;
              })}
              <td />
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    );
  }

  if (resultView === 'formula') {
    return (
      <div className="table-scroll">
        <table
          className="prototype-table formula-preview-table"
          data-resizable-table={formulaTableSizing.tableId}
          style={formulaTableSizing.tableStyle}
        >
          <colgroup>
            {FORMULA_PREVIEW_TABLE_COLUMNS.map((column) => (
              <col key={column.key} style={formulaTableSizing.getColumnStyle(column.key)} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <ResizableHeader columnKey="rowNo" label="No" rowSpan={2} sizing={formulaTableSizing} />
              <ResizableHeader columnKey="itemGroup" label="Group" rowSpan={2} sizing={formulaTableSizing} />
              <ResizableHeader columnKey="supplierOrderCode" label="Supp Order Code" rowSpan={2} sizing={formulaTableSizing} />
              <ResizableHeader columnKey="description" label="Description" rowSpan={2} sizing={formulaTableSizing} />
              <ResizableHeader columnKey="qty" label="Qty" rowSpan={2} sizing={formulaTableSizing} />
              <ResizableHeader columnKey="uom" label="UOM" rowSpan={2} sizing={formulaTableSizing} />
              <ResizableHeader columnKey="amount" label="Amount" rowSpan={2} sizing={formulaTableSizing} />
              <th colSpan={ALLOC_COLS.length} className="th-group">Allocated Costs</th>
              <th colSpan={FORMULA_RESULT_KEYS.length} className="th-group th-final">Formula Check</th>
              <ResizableHeader className="th-final" columnKey="status" label="Status" rowSpan={2} sizing={formulaTableSizing} />
            </tr>
            <tr>
              {ALLOC_COLS.map((column) => (
                <ResizableHeader columnKey={`alloc-${column.key}`} key={column.key} label={column.label} sizing={formulaTableSizing} />
              ))}
              {FORMULA_RESULT_KEYS.map((key) => (
                <ResizableHeader
                  className="th-final"
                  columnKey={getFinalResultColumnKey(key)}
                  key={key}
                  label={FINAL_RESULT_COL_BY_KEY.get(key)?.label ?? key}
                  sizing={formulaTableSizing}
                />
              ))}
            </tr>
          </thead>
          <tbody>
            {preview.lines.map((result, index) => {
              const source = sourceByKey.get(result.lineKey);
              if (!source) return null;
              return (
                <FormulaResultRow
                  key={result.lineKey}
                  finalResult={getFinalResultForLine(result)}
                  index={index}
                  result={result}
                  source={source}
                  costs={costs}
                  tableSizing={formulaTableSizing}
                  onEdit={onEdit}
                />
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="table-scroll">
      <table
        className="prototype-table final-preview-table"
        data-resizable-table={fullTableSizing.tableId}
        style={fullTableSizing.tableStyle}
      >
        <colgroup>
          {FINAL_PREVIEW_TABLE_COLUMNS.map((column) => (
            <col key={column.key} style={fullTableSizing.getColumnStyle(column.key)} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <ResizableHeader columnKey="rowNo" label="No" rowSpan={2} sizing={fullTableSizing} />
            <ResizableHeader columnKey="itemGroup" label="Group" rowSpan={2} sizing={fullTableSizing} />
            <ResizableHeader columnKey="supplierOrderCode" label="Supp Order Code" rowSpan={2} sizing={fullTableSizing} />
            <ResizableHeader columnKey="description" label="Description" rowSpan={2} sizing={fullTableSizing} />
            <ResizableHeader columnKey="qty" label="Qty" rowSpan={2} sizing={fullTableSizing} />
            <ResizableHeader columnKey="uom" label="UOM" rowSpan={2} sizing={fullTableSizing} />
            <ResizableHeader columnKey="amount" label="Amount" rowSpan={2} sizing={fullTableSizing} />
            <th colSpan={ALLOC_COLS.length} className="th-group">Allocated Costs</th>
            <th colSpan={FINAL_RESULT_COLS.length} className="th-group th-final">Final Result (one row = one item/term)</th>
            <ResizableHeader className="th-final" columnKey="status" label="Status" rowSpan={2} sizing={fullTableSizing} />
          </tr>
          <tr>
            {ALLOC_COLS.map((column) => (
              <ResizableHeader columnKey={`alloc-${column.key}`} key={column.key} label={column.label} sizing={fullTableSizing} />
            ))}
            {FINAL_RESULT_COLS.map((column) => (
              <ResizableHeader className="th-final" columnKey={getFinalResultColumnKey(column.key)} key={column.key} label={column.label} sizing={fullTableSizing} />
            ))}
          </tr>
        </thead>
        <tbody>
          {preview.lines.map((result, index) => {
            const source = sourceByKey.get(result.lineKey);
            if (!source) return null;
            return (
              <PreviewRow
                key={result.lineKey}
                index={index}
                source={source}
                result={result}
                finalResult={getFinalResultForLine(result)}
                onEdit={onEdit}
                tableSizing={fullTableSizing}
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ReviewResultRow({
  index,
  source,
  result,
  finalResult,
  onEdit,
  onOpenDraftPreview,
  tableSizing,
}: {
  index: number;
  source: AllocationLineSource;
  result: AllocationLineResult;
  finalResult: FinalResultColumns;
  onEdit: (lineKey: string, key: FinalResultKey, raw: string) => void;
  onOpenDraftPreview: (mode: DraftPreviewMode, lineKey: string) => void;
  tableSizing: ResizableTableSizing;
}) {
  return (
    <tr className={result.status === 'error' ? 'row-error' : result.status === 'warning' ? 'row-warning' : ''}>
      <td {...tableSizing.getCellProps('rowNo')} className="center-cell">{String(index + 1).padStart(2, '0')}</td>
      <td {...tableSizing.getCellProps('itemGroup')} className="center-cell">{formatItemGroup(source.itemGroup)}</td>
      <td {...tableSizing.getCellProps('supplierOrderCode')} className="text-left-cell">{source.supplierOrderCode}</td>
      <td {...tableSizing.getCellProps('description')} className="text-left-cell">{source.sapDescription}</td>
      <td {...tableSizing.getCellProps('qty')} className="center-cell">{fmt(source.qty)}</td>
      <td {...tableSizing.getCellProps('uom')} className="center-cell">{source.uom}</td>
      {REVIEW_RESULT_KEYS.map((key) => {
        const column = FINAL_RESULT_COL_BY_KEY.get(key);
        if (!column) return null;
        const isSale = SALE_PRICE_KEYS.has(key);
        return (
          <td
            key={key}
            {...tableSizing.getCellProps(getFinalResultColumnKey(key))}
            className={`${column.kind === 'number' ? 'numeric-cell' : ''}${isSale ? ' td-sale-price' : ''}`}
          >
            <FinalResultCell lineKey={result.lineKey} column={column} value={finalResult[key]} onEdit={onEdit} />
          </td>
        );
      })}
      <td {...tableSizing.getCellProps('draftPreview')} className="center-cell">
        <div className="draft-preview-actions">
          <button
            className="draft-preview-action"
            type="button"
            onClick={() => onOpenDraftPreview('item', result.lineKey)}
          >
            Item
          </button>
          <button
            className="draft-preview-action"
            type="button"
            onClick={() => onOpenDraftPreview('term', result.lineKey)}
          >
            Term
          </button>
        </div>
      </td>
      <td {...tableSizing.getCellProps('status')} className="center-cell">
        <StatusCell result={result} />
      </td>
    </tr>
  );
}

function FormulaResultRow({
  costs,
  index,
  source,
  result,
  finalResult,
  onEdit,
  tableSizing,
}: {
  costs: BulkCostInput;
  index: number;
  source: AllocationLineSource;
  result: AllocationLineResult;
  finalResult: FinalResultColumns;
  onEdit: (lineKey: string, key: FinalResultKey, raw: string) => void;
  tableSizing: ResizableTableSizing;
}) {
  const auditCosts = {
    ...costs,
    orderTerm: source.orderTerm || costs.orderTerm,
    location: source.location || costs.location,
    subLocation: source.subLocation || costs.subLocation,
    shipModeNo: source.shipModeNo || costs.shipModeNo,
  };
  const audit = buildBulkCostFormulaAudit(source, auditCosts, finalResult, { allocationLine: result });
  const rowClass = audit.status === 'fail' || result.status === 'error'
    ? 'row-error'
    : audit.status === 'warn' || result.status === 'warning'
      ? 'row-warning'
      : '';

  return (
    <tr className={rowClass}>
      <td {...tableSizing.getCellProps('rowNo')} className="center-cell">{String(index + 1).padStart(2, '0')}</td>
      <td {...tableSizing.getCellProps('itemGroup')} className="center-cell">{formatItemGroup(source.itemGroup)}</td>
      <td {...tableSizing.getCellProps('supplierOrderCode')} className="text-left-cell">{source.supplierOrderCode}</td>
      <td {...tableSizing.getCellProps('description')} className="text-left-cell">{source.sapDescription}</td>
      <td {...tableSizing.getCellProps('qty')} className="center-cell">{fmt(source.qty)}</td>
      <td {...tableSizing.getCellProps('uom')} className="center-cell">{source.uom}</td>
      <td {...tableSizing.getCellProps('amount')} className="numeric-cell">{fmt(source.amount)}</td>
      {ALLOC_COLS.map((column) => (
        <td key={column.key} {...tableSizing.getCellProps(`alloc-${column.key}`)} className="numeric-cell">
          {String(column.key).includes('Ratio') ? pct(result[column.key]) : fmt(result[column.key])}
        </td>
      ))}
      {FORMULA_RESULT_KEYS.map((key) => {
        const column = FINAL_RESULT_COL_BY_KEY.get(key);
        if (!column) return null;
        return (
          <td key={key} {...tableSizing.getCellProps(getFinalResultColumnKey(key))} className={column.kind === 'number' ? 'numeric-cell' : ''}>
            <FinalResultCell lineKey={result.lineKey} column={column} value={finalResult[key]} onEdit={onEdit} />
          </td>
        );
      })}
      <td {...tableSizing.getCellProps('status')} className="center-cell">
        <FormulaAuditStatusCell audit={audit} />
      </td>
    </tr>
  );
}

function PreviewRow({
  index,
  source,
  result,
  finalResult,
  onEdit,
  tableSizing,
}: {
  index: number;
  source: AllocationLineSource;
  result: AllocationLineResult;
  finalResult: FinalResultColumns;
  onEdit: (lineKey: string, key: FinalResultKey, raw: string) => void;
  tableSizing: ResizableTableSizing;
}) {
  return (
    <tr className={result.status === 'error' ? 'row-error' : result.status === 'warning' ? 'row-warning' : ''}>
      <td {...tableSizing.getCellProps('rowNo')} className="center-cell">{String(index + 1).padStart(2, '0')}</td>
      <td {...tableSizing.getCellProps('itemGroup')} className="center-cell">{formatItemGroup(source.itemGroup)}</td>
      <td {...tableSizing.getCellProps('supplierOrderCode')} className="text-left-cell">{source.supplierOrderCode}</td>
      <td {...tableSizing.getCellProps('description')} className="text-left-cell">{source.sapDescription}</td>
      <td {...tableSizing.getCellProps('qty')} className="center-cell">{fmt(source.qty)}</td>
      <td {...tableSizing.getCellProps('uom')} className="center-cell">{source.uom}</td>
      <td {...tableSizing.getCellProps('amount')} className="numeric-cell">{fmt(source.amount)}</td>
      <td {...tableSizing.getCellProps('alloc-weightRatioPerItem')} className="numeric-cell">{pct(result.weightRatioPerItem)}</td>
      <td {...tableSizing.getCellProps('alloc-weightRatioPerEach')} className="numeric-cell">{pct(result.weightRatioPerEach)}</td>
      <td {...tableSizing.getCellProps('alloc-valueRatioPerItem')} className="numeric-cell">{pct(result.valueRatioPerItem)}</td>
      <td {...tableSizing.getCellProps('alloc-valueRatioPerEach')} className="numeric-cell">{pct(result.valueRatioPerEach)}</td>
      <td {...tableSizing.getCellProps('alloc-pkhPerEach')} className="numeric-cell">{fmt(result.pkhPerEach)}</td>
      <td {...tableSizing.getCellProps('alloc-socPerEach')} className="numeric-cell">{fmt(result.socPerEach)}</td>
      <td {...tableSizing.getCellProps('alloc-freightPerEach')} className="numeric-cell">{fmt(result.freightPerEach)}</td>
      <td {...tableSizing.getCellProps('alloc-ccPerEach')} className="numeric-cell">{fmt(result.ccPerEach)}</td>
      <td {...tableSizing.getCellProps('alloc-wireTTPerEach')} className="numeric-cell">{fmt(result.wireTTPerEach)}</td>
      {FINAL_RESULT_COLS.map((column) => (
        <td key={column.key} {...tableSizing.getCellProps(getFinalResultColumnKey(column.key))} className={column.kind === 'number' ? 'numeric-cell' : ''}>
          <FinalResultCell
            lineKey={result.lineKey}
            column={column}
            value={finalResult[column.key]}
            onEdit={onEdit}
          />
        </td>
      ))}
      <td {...tableSizing.getCellProps('status')} className="center-cell">
        <StatusCell result={result} />
      </td>
    </tr>
  );
}

function DraftPreviewPanel({
  costs,
  finalResult,
  mode,
  result,
  source,
  onClose,
}: {
  costs: BulkCostInput;
  finalResult: FinalResultColumns;
  mode: DraftPreviewMode;
  result: AllocationLineResult;
  source: AllocationLineSource;
  onClose: () => void;
}) {
  const missingFields = mode === 'item'
    ? getMissingItemDraftFields(source)
    : getMissingTermDraftFields(source, finalResult);
  const statusLabel = result.status === 'error'
    ? 'Needs correction'
    : missingFields.length > 0
      ? 'Needs review'
      : 'Preview ready';
  const statusClass = result.status === 'error'
    ? 'error'
    : missingFields.length > 0
      ? 'warning'
      : result.status;

  return (
    <div className="draft-preview-panel" aria-label={`${mode === 'item' ? 'Item' : 'Term'} draft preview`}>
      <div className="draft-preview-header">
        <div>
          <p className="eyebrow">Post-CAL Draft</p>
          <h3>{mode === 'item' ? 'Item Draft Preview' : 'Term Draft Preview'}</h3>
          <span>
            Row {String(source.no).padStart(2, '0')} - {source.sapDescription}
          </span>
        </div>
        <button className="draft-preview-close" type="button" onClick={onClose}>
          Close
        </button>
      </div>

      <div className="draft-preview-status-row">
        <span className={`draft-preview-status ${statusClass}`}>
          {statusLabel}
        </span>
        <span>Save State: Not saved</span>
        <span>Mode: Read-only preview</span>
        <span>Missing: {missingFields.length > 0 ? missingFields.join(', ') : '-'}</span>
      </div>

      {mode === 'item' ? (
        <ItemDraftPreview source={source} />
      ) : (
        <TermDraftPreview costs={costs} finalResult={finalResult} result={result} source={source} />
      )}
    </div>
  );
}

function ItemDraftPreview({ source }: { source: AllocationLineSource }) {
  return (
    <div className="draft-preview-content">
      <DraftPreviewSection title="Item Master">
        <DraftPreviewField label="Match" value={formatMatchStatus(source.itemCode)} />
        <DraftPreviewField label="Item Code" value={source.itemCode.trim() || 'Auto-generated later'} />
        <DraftPreviewField label="Group" value={formatItemGroup(source.itemGroup)} />
        <DraftPreviewField label="Category" value={source.itemCategory} />
        <DraftPreviewField label="Mfr Brand" value={source.manufacturer} />
        <DraftPreviewField label="Mfr Catalog No" value={source.mfgPartNumber} />
        <DraftPreviewField label="Stock UOM" value={source.uom} />
        <DraftPreviewField label="Active" value="Yes" />
        <DraftPreviewField wide label="Item Description" value={source.sapDescription} />
      </DraftPreviewSection>

      <DraftPreviewSection title="Compliance and Reference">
        <DraftPreviewField label="HS Code" value={source.hsCode} />
        <DraftPreviewField label="Country of Origin" value={source.countryOfOrigin} />
        <DraftPreviewField label="Permit" value={formatYesNo(source.importPermit)} />
        <DraftPreviewField label="Shelf Life" value={formatYesNo(source.shelfLifeRequire)} />
      </DraftPreviewSection>
    </div>
  );
}

function TermDraftPreview({
  costs,
  finalResult,
  result,
  source,
}: {
  costs: BulkCostInput;
  finalResult: FinalResultColumns;
  result: AllocationLineResult;
  source: AllocationLineSource;
}) {
  return (
    <div className="draft-preview-content">
      <DraftPreviewSection title="Term Context">
        <DraftPreviewField label="Supplier" value={finalResult.supplierName || source.vendorName} />
        <DraftPreviewField label="Supp Order Code" value={source.supplierOrderCode} />
        <DraftPreviewField label="Purchase Term" value={finalResult.purchaseOrderTerm} />
        <DraftPreviewField label="Location" value={finalResult.termLocation} />
        <DraftPreviewField label="Ship Mode" value={formatShipMode(source.shipModeNo || costs.shipModeNo)} />
        <DraftPreviewField label="Sales Term" value={source.salesTerm || ''} />
        <DraftPreviewField label="Sales Sub Loc" value={source.salesSubLocation || ''} />
        <DraftPreviewField label="Lead Time" value={source.deliveryLeadTime} />
        <DraftPreviewField label="Sale Incharge" value={costs.saleIncharge} />
        <DraftPreviewField label="Contact Person" value={costs.contactPerson} />
      </DraftPreviewSection>

      <DraftPreviewSection title="Line Source">
        <DraftPreviewField label="Qty" value={fmt(source.qty)} />
        <DraftPreviewField label="UOM" value={source.uom} />
        <DraftPreviewField label="Unit Price" value={fmt(source.unitPrice)} />
        <DraftPreviewField label="Amount" value={`${source.currency} ${fmt(source.amount)}`} />
        <DraftPreviewField label="Currency" value={finalResult.currency} />
        <DraftPreviewField label="Exchange Rate" value={fmt(finalResult.rateExchange)} />
      </DraftPreviewSection>

      <DraftPreviewSection title="Cost Result">
        <DraftPreviewField label="PCS" value={fmt(finalResult.productCost)} />
        <DraftPreviewField label="PKH" value={fmt(finalResult.pkh)} />
        <DraftPreviewField label="SOC" value={fmt(finalResult.soc)} />
        <DraftPreviewField label="COC" value={fmt(finalResult.docCOC)} />
        <DraftPreviewField label="Mill" value={fmt(finalResult.docMill)} />
        <DraftPreviewField label="Test Cert" value={fmt(finalResult.docTestCert)} />
        <DraftPreviewField label="COO/COA" value={fmt(finalResult.docCOO)} />
        <DraftPreviewField label="Any Other" value={fmt(finalResult.docAnyOther)} />
        <DraftPreviewField label="OP1 (PSC)" value={fmt(finalResult.op1Source)} />
        <DraftPreviewField label="OP1 (THB)" value={fmt(finalResult.op1)} />
        <DraftPreviewField label="OP2 (THB)" value={fmt(finalResult.op2)} />
        <DraftPreviewField label="Round Up" value={fmt(finalResult.roundUp)} />
      </DraftPreviewSection>

      <DraftPreviewSection title="Weight, Duty, and QLC">
        <DraftPreviewField label="Item Wt/Ea" value={fmt(source.itemWeightPerEach)} />
        <DraftPreviewField label="Dim Wt/Ea" value={fmt(source.dimensionWeightPerEach)} />
        <DraftPreviewField label="Chargeable Wt/Ea" value={fmt(getChargeableWeightPerEach(source))} />
        <DraftPreviewField label="Ship Wt/Ea" value={fmt(finalResult.shipWeightCal)} />
        <DraftPreviewField label="Duty %" value={fmt(finalResult.importDutyPercent)} />
        <DraftPreviewField label="Insurance %" value={fmt(finalResult.insPercent)} />
        <DraftPreviewField label="FR QTEC" value={fmt(finalResult.frQTEC)} />
        <DraftPreviewField label="Zone Rate" value={fmt(finalResult.frZoneRate)} />
        <DraftPreviewField label="TT (THB)" value={fmt(finalResult.wireTT)} />
        <DraftPreviewField label="CC (THB)" value={fmt(finalResult.customClear)} />
        <DraftPreviewField label="QLC" value={fmt(finalResult.qlc)} />
        <DraftPreviewField label="SPK (THB)" value={fmt(finalResult.spk)} />
        <DraftPreviewField label="QOC (THB)" value={fmt(finalResult.qocVal)} />
        <DraftPreviewField label="Total QLC" value={fmt(finalResult.totalQLC)} />
        <DraftPreviewField label="Markup" value={fmt(finalResult.markup)} />
      </DraftPreviewSection>

      <DraftPreviewSection title="UOM and Conversion">
        <DraftPreviewField label="Purchase UOM" value={finalResult.purchaseUOM} />
        <DraftPreviewField label="Stock UOM" value={finalResult.stockUOM} />
        <DraftPreviewField label="Sales UOM" value={finalResult.saleUOM} />
        <DraftPreviewField label="Stock Conversion" value={fmt(finalResult.stockConversion)} />
        <DraftPreviewField label="Sales Conversion" value={fmt(finalResult.saleConversion)} />
        <DraftPreviewField label="MOQ" value={fmt(finalResult.purchaseMOQ)} />
      </DraftPreviewSection>

      {result.warnings.length > 0 && (
        <DraftPreviewSection title="Warnings">
          <DraftPreviewField
            wide
            label="Calculation Warnings"
            value={result.warnings.map((warning) => warning.message).join('; ')}
          />
        </DraftPreviewSection>
      )}
    </div>
  );
}

function DraftPreviewSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="draft-preview-section">
      <h4>{title}</h4>
      <div className="draft-preview-grid">{children}</div>
    </section>
  );
}

function DraftPreviewField({
  label,
  value,
  wide = false,
}: {
  label: string;
  value: ReactNode;
  wide?: boolean;
}) {
  const normalizedValue = typeof value === 'string' ? formatDraftText(value) : value;
  return (
    <div className={`draft-preview-field ${wide ? 'draft-preview-field-wide' : ''}`}>
      <span>{label}</span>
      <strong>{normalizedValue}</strong>
    </div>
  );
}

function getMissingItemDraftFields(source: AllocationLineSource): string[] {
  const missing: string[] = [];
  if (!source.itemGroup.trim()) missing.push('Group');
  if (!source.sapDescription.trim()) missing.push('Description');
  if (!source.manufacturer.trim()) missing.push('Mfr Brand');
  if (!source.mfgPartNumber.trim()) missing.push('Mfr Catalog No');
  if (!source.uom.trim()) missing.push('UOM');
  return missing;
}

function getMissingTermDraftFields(source: AllocationLineSource, finalResult: FinalResultColumns): string[] {
  const missing: string[] = [];
  if (!source.supplierOrderCode.trim()) missing.push('Supp Order Code');
  if (!finalResult.purchaseOrderTerm.trim()) missing.push('Purchase Term');
  if (!finalResult.termLocation.trim()) missing.push('Location');
  if (!source.deliveryLeadTime.trim()) missing.push('Lead Time');
  if (!finalResult.currency.trim()) missing.push('Currency');
  if (!Number.isFinite(finalResult.rateExchange) || finalResult.rateExchange <= 0) missing.push('Exchange Rate');
  if (!Number.isFinite(finalResult.productCost) || finalResult.productCost <= 0) missing.push('PCS');
  return missing;
}

function formatDraftText(value: string): string {
  const trimmed = value.trim();
  return trimmed || '-';
}

function FinalResultCell({
  lineKey,
  column,
  value,
  onEdit,
}: {
  lineKey: string;
  column: FinalResultColumnDefinition;
  value: FinalResultColumns[FinalResultKey];
  onEdit: (lineKey: string, key: FinalResultKey, raw: string) => void;
}) {
  if (column.kind === 'number' && column.editable) {
    const numericValue = typeof value === 'number' ? value : 0;
    return (
      <FormattedNumberInput
        id={`preview-${lineKey}-${column.key}`}
        name={`preview.${lineKey}.${column.key}`}
        className="preview-edit-input"
        value={numericValue}
        onChange={(event) => onEdit(lineKey, column.key, event.target.value)}
        aria-label={`${column.label} for ${lineKey}`}
      />
    );
  }

  if (typeof value === 'number') return <span>{fmt(value)}</span>;
  return <span>{value ?? '-'}</span>;
}

function StatusCell({ result }: { result: AllocationLineResult }) {
  if (result.status === 'error') {
    return (
      <span className="table-warning" title={result.warnings.map((warning) => warning.message).join('\n')}>
        <XCircle size={14} aria-hidden="true" />
        Error
      </span>
    );
  }
  if (result.status === 'warning') {
    return (
      <span className="table-warning" title={result.warnings.map((warning) => warning.message).join('\n')}>
        <AlertTriangle size={14} aria-hidden="true" />
        Warning
      </span>
    );
  }
  return (
    <span className="table-ok">
      <CheckCircle2 size={14} aria-hidden="true" />
      Ready
    </span>
  );
}

function FormulaAuditStatusCell({ audit }: { audit: ReturnType<typeof buildBulkCostFormulaAudit> }) {
  const title = audit.rows
    .filter((row) => row.status !== 'pass')
    .map((row) => `${row.label}: expected ${fmtAuditValue(row.expectedValue)}, actual ${fmtAuditValue(row.actualValue)}${row.note ? ` - ${row.note}` : ''}`)
    .join('\n');

  if (audit.status === 'fail') {
    return (
      <span className="table-error" title={title || 'Formula audit failed'}>
        <XCircle size={14} aria-hidden="true" />
        Fail ({audit.failCount})
      </span>
    );
  }
  if (audit.status === 'warn') {
    return (
      <span className="table-warning" title={title || 'Formula audit has warnings'}>
        <AlertTriangle size={14} aria-hidden="true" />
        Warn ({audit.warnCount})
      </span>
    );
  }
  return (
    <span className="table-ok" title="Formula audit passed">
      <CheckCircle2 size={14} aria-hidden="true" />
      Pass
    </span>
  );
}

function fmt(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '-';
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtAuditValue(value: number | string | null): string {
  if (typeof value === 'number') return fmt(value);
  return value ?? '-';
}

function fmtPlain(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '';
  return fmt(value);
}

function fmtNullablePlain(value: number | null | undefined): string {
  return value === null || value === undefined ? '' : fmtPlain(value);
}

function formatDisplayNumber(value: number | null | undefined, nullable = false): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return nullable ? '' : '0.00';
  return fmt(value);
}

function formatMatchStatus(itemCode: string): string {
  return itemCode.trim() ? 'Existing' : 'New Item';
}

function toEditableNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '';
  return String(round6(value));
}

function pct(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}
