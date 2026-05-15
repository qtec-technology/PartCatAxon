'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type InputHTMLAttributes, type ReactNode } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  BadgeDollarSign,
  Boxes,
  Calculator,
  CheckCircle2,
  Info,
  Loader2,
  Phone,
  RotateCcw,
  Save,
  Search,
  Trophy,
  User,
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
import { calculateAllocationPreview } from './bulk-cost.calc';
import { buildBulkCostFormulaAudit } from './bulk-cost.formula-audit';
import {
  FINAL_RESULT_COLS,
  FINAL_RESULT_COLS_BY_KEY,
  type FinalResultColumnDefinition,
  type FinalResultKey,
} from './bulk-cost.final-result';
import { buildBulkCostRunDraftPayload, loadBulkCostRun, saveBulkCostRunDraft, updateBulkCostRunStatus } from './bulk-cost.api';
import { getDemoCostsForSupplier, getDemoLinesForSupplier } from './bulk-cost.mock';
import { useResizableTableColumns, type ResizableTableColumn } from './useResizableTableColumns';
import {
  mapBulkCostToTermFormData,
  mapBulkCostToTermCalcResults,
  mapBulkCostToItemData,
  storeBulkCostPreview,
} from './bulk-cost.preview';
import type { BulkCostDocumentFeeLineCandidate } from './bulk-cost.document-fees';

const SHOW_FORMULA = process.env.NEXT_PUBLIC_SHOW_FORMULA === 'true';

const CURRENCY_OPTIONS = ['THB', 'USD', 'EUR', 'JPY', 'GBP', 'CNY', 'SGD', 'HKD', 'KRW', 'AUD', 'CAD'];

const ORDER_TERM_OPTIONS = ['Exwork', 'Ex-work', 'FCA', 'FAS', 'FOB', 'CIF', 'CFR', 'CPT', 'DDP', 'DAP', 'Ex-Factory'];
const TERM_LOCATION_OPTIONS = ['TH', 'US', 'UK', 'SG', 'AE', 'AU', 'CN', 'DE', 'FR', 'JP', 'NL', 'CA', 'MY', 'VN', 'HK'];

const COST_FIELDS: {
  key: keyof Pick<BulkCostInput, 'pkh' | 'soc' | 'freight' | 'customs' | 'wireTT'>;
  code: string;
  label: string;
  rule: string;
}[] = [
  { key: 'pkh',     code: 'PKH',     label: 'Packing Handling (PKH)',    rule: 'Weight-based' },
  { key: 'soc',     code: 'SOC',     label: 'Supplier Outb Cost (SOC)', rule: 'Weight-based' },
  { key: 'freight', code: 'Freight', label: 'Freight (FR)',           rule: 'Weight-based' },
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

const LINE_TABLE_COLUMNS = [
  { key: 'select', defaultWidth: 72, minWidth: 64 },
  { key: 'no', defaultWidth: 58, minWidth: 48 },
  { key: 'matchStatus', defaultWidth: 112, minWidth: 96 },
  { key: 'itemGroup', defaultWidth: 116, minWidth: 96 },
  { key: 'manufacturer', defaultWidth: 138, minWidth: 110, maxWidth: 260 },
  { key: 'mfgPartNumber', defaultWidth: 150, minWidth: 120, maxWidth: 320 },
  { key: 'description', defaultWidth: 360, minWidth: 180, maxWidth: 720 },
  { key: 'itemCategory', defaultWidth: 144, minWidth: 116, maxWidth: 280 },
  { key: 'qty', defaultWidth: 78, minWidth: 68 },
  { key: 'uom', defaultWidth: 104, minWidth: 84 },
  { key: 'unitPrice', defaultWidth: 120, minWidth: 100 },
  { key: 'amount', defaultWidth: 126, minWidth: 108 },
  { key: 'currency', defaultWidth: 88, minWidth: 78 },
  { key: 'countryOfOrigin', defaultWidth: 120, minWidth: 96, maxWidth: 200 },
  { key: 'leadTime', defaultWidth: 122, minWidth: 104 },
  { key: 'orderTerm', defaultWidth: 112, minWidth: 96 },
  { key: 'location', defaultWidth: 150, minWidth: 118, maxWidth: 320 },
  { key: 'shipMode', defaultWidth: 116, minWidth: 98 },
  { key: 'hsCode', defaultWidth: 118, minWidth: 100, maxWidth: 220 },
  { key: 'importPermit', defaultWidth: 118, minWidth: 104 },
  { key: 'shelfLife', defaultWidth: 134, minWidth: 116 },
  { key: 'itemWeight', defaultWidth: 118, minWidth: 104 },
  { key: 'length', defaultWidth: 90, minWidth: 76 },
  { key: 'width', defaultWidth: 90, minWidth: 76 },
  { key: 'height', defaultWidth: 90, minWidth: 76 },
  { key: 'dimUnit', defaultWidth: 82, minWidth: 70 },
  { key: 'dimWeight', defaultWidth: 118, minWidth: 104 },
  { key: 'shipWeight', defaultWidth: 122, minWidth: 108 },
  { key: 'supplierOrderCode', defaultWidth: 154, minWidth: 124, maxWidth: 320 },
  { key: 'importDuty', defaultWidth: 104, minWidth: 92 },
  ...DOC_FEE_FIELDS.map((field) => ({ key: getDocFeeColumnKey(field.key), defaultWidth: 106, minWidth: 92 })),
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

type LineColumnPreset = 'overview' | 'docs' | 'weight' | 'logistics' | 'all';
type ResultView = 'review' | 'formula' | 'full';
type DraftPreviewMode = 'item' | 'term';

const LINE_COLUMN_PRESETS: Record<LineColumnPreset, string[]> = {
  overview: [
    'select',
    'no',
    'description',
    'manufacturer',
    'mfgPartNumber',
    'qty',
    'uom',
    'unitPrice',
    'amount',
    'currency',
    'itemGroup',
    'countryOfOrigin',
    'status',
  ],
  docs: [
    'select',
    'no',
    'manufacturer',
    'mfgPartNumber',
    'description',
    'qty',
    'uom',
    ...DOC_FEE_FIELDS.map((field) => getDocFeeColumnKey(field.key)),
    'status',
  ],
  weight: [
    'select',
    'no',
    'manufacturer',
    'mfgPartNumber',
    'description',
    'qty',
    'itemWeight',
    'dimUnit',
    'length',
    'width',
    'height',
    'dimWeight',
    'shipWeight',
    'status',
  ],
  logistics: [
    'select',
    'no',
    'description',
    'manufacturer',
    'mfgPartNumber',
    'supplierOrderCode',
    'orderTerm',
    'location',
    'shipMode',
    'hsCode',
    'importDuty',
    'importPermit',
    'shelfLife',
    'status',
  ],
  all: LINE_TABLE_COLUMNS.filter((c) => c.key !== 'matchStatus').map((column) => column.key),
};

const EDITABLE_LINE_COLUMNS_BY_PRESET: Record<LineColumnPreset, string[]> = {
  overview: [
    'select',
    'description',
    'manufacturer',
    'mfgPartNumber',
    'qty',
    'uom',
    'unitPrice',
    'currency',
    'itemGroup',
    'countryOfOrigin',
  ],
  docs: ['select', ...DOC_FEE_FIELDS.map((field) => getDocFeeColumnKey(field.key))],
  weight: ['select', 'dimUnit', 'length', 'width', 'height', 'itemWeight'],
  logistics: ['select', 'supplierOrderCode', 'hsCode', 'importDuty', 'importPermit', 'shelfLife'],
  all: [],
};

function canEditLineColumnInPreset(preset: LineColumnPreset, columnKey: string): boolean {
  return EDITABLE_LINE_COLUMNS_BY_PRESET[preset].includes(columnKey);
}

const LINE_COLUMN_LABELS: Record<string, string> = {
  select: 'Select',
  no: 'No',
  itemGroup: 'Group',
  itemCategory: 'Category',
  matchStatus: 'Match',
  description: 'Item Description',
  manufacturer: 'Mfr Brand',
  mfgPartNumber: 'Mfr Catalog No',
  supplierOrderCode: 'Supp Order Code',
  qty: 'Qty',
  uom: 'UOM',
  unitPrice: 'Unit Price',
  amount: 'Amount',
  currency: 'Currency',
  hsCode: 'HS Code',
  countryOfOrigin: 'Country of Origin',
  leadTime: 'Lead Time',
  orderTerm: 'Purchase Term',
  location: 'Term Location',
  shipMode: 'Ship Mode',
  importPermit: 'Permit',
  shelfLife: 'Shelf Life',
  itemWeight: 'Item Wt/Ea',
  dimWeight: 'Dim Wt/Ea',
  shipWeight: 'Ship Wt/Ea',
  length: 'Length',
  width: 'Width',
  height: 'Height',
  dimUnit: 'Dim Unit',
  importDuty: 'Duty %',
  status: 'Status',
};

for (const field of DOC_FEE_FIELDS) {
  LINE_COLUMN_LABELS[getDocFeeColumnKey(field.key)] = field.label;
}

const REVIEW_RESULT_KEYS: FinalResultKey[] = [
  'productCost',
  'pkh',
  'soc',
  'op1Source',
  'rateExchange',
  'op1',
  'exworkCase',
  'op2',
  'shipWeightCal',
  'ins',
  'frQTEC',
  'selectedDuty',
  'wireTT',
  'customClear',
  'qlc',
  'totalQLC',
  'markup',
  'roundUp',
];

const FORMULA_RESULT_KEYS: FinalResultKey[] = [
  'productCost',
  'pkh',
  'soc',
  'docCOC',
  'docMill',
  'docTestCert',
  'docCOO',
  'docAnyOther',
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
type SourceTableView = 'latest' | 'origin' | 'changes';
type EditableLineTextField = keyof Pick<
  AllocationLineSource,
  | 'itemGroup'
  | 'itemCategory'
  | 'sapDescription'
  | 'manufacturer'
  | 'mfgPartNumber'
  | 'supplierOrderCode'
  | 'uom'
  | 'currency'
  | 'hsCode'
  | 'countryOfOrigin'
  | 'deliveryLeadTime'
  | 'importPermit'
  | 'shelfLifeRequire'
>;
type EditableLineNumberField = keyof Pick<AllocationLineSource, 'qty' | 'unitPrice' | 'importDutyPercent' | 'length' | 'width' | 'height'| 'dimUnit' >;
type EditableLineNullableNumberField = keyof Pick<
  AllocationLineSource,
  'itemWeightPerEach' | 'dimensionWeightPerEach' | 'shippingWeightPerEach'
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
): AllocationLineSource => {
  _lineSeq += 1;
  return {
    lineKey: `MANUAL-${Date.now()}-${_lineSeq}`,
    no,
    itemGroup: '104',
    itemCategory: '',
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
    importPermit: 'No',
    shelfLifeRequire: 'No',
    itemWeightPerEach: null,
    dimensionWeightPerEach: null,
    shippingWeightPerEach: null,
    totalShippingWeight: null,
    importDutyPercent: 0,
    vendorCode,
    vendorName,
    termId: null,
    itemCode: '',
    purchaseUOM: 'PCS',
    stockUOM: 'PCS',
    saleUOM: 'PCS',
    stockConversion: 1,
    saleConversion: 1,
    moq: null,
    insPercent: 0,
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
    stkPercent: 0,
    markupPercent: 0,
    sspk: 0,
    qoc: 0,
  };
};

const trackedLineFields: { key: LineFieldKey; label: string; format: (line: AllocationLineSource) => string }[] = [
  { key: 'itemGroup', label: 'Group', format: (line) => formatItemGroup(line.itemGroup) },
  { key: 'itemCategory', label: 'Category', format: (line) => line.itemCategory },
  { key: 'sapDescription', label: 'Description', format: (line) => line.sapDescription },
  { key: 'manufacturer', label: 'MFG', format: (line) => line.manufacturer },
  { key: 'mfgPartNumber', label: 'MFG P/N', format: (line) => line.mfgPartNumber },
  { key: 'supplierOrderCode', label: 'Supp Order Code', format: (line) => line.supplierOrderCode },
  { key: 'qty', label: 'Qty', format: (line) => fmtPlain(line.qty) },
  { key: 'uom', label: 'UOM', format: (line) => line.uom },
  { key: 'unitPrice', label: 'Unit Price', format: (line) => fmtPlain(line.unitPrice) },
  { key: 'currency', label: 'Currency', format: (line) => line.currency },
  { key: 'hsCode', label: 'HS Code', format: (line) => line.hsCode },
  { key: 'countryOfOrigin', label: 'Country of Origin', format: (line) => line.countryOfOrigin },
  { key: 'deliveryLeadTime', label: 'Lead Time', format: (line) => line.deliveryLeadTime },
  { key: 'importPermit', label: 'Permit', format: (line) => formatYesNo(line.importPermit) },
  { key: 'shelfLifeRequire', label: 'Shelf Life', format: (line) => formatYesNo(line.shelfLifeRequire) },
  { key: 'itemWeightPerEach', label: 'Item Weight', format: (line) => fmtNullablePlain(line.itemWeightPerEach) },
  { key: 'dimensionWeightPerEach', label: 'Dim Weight', format: (line) => fmtNullablePlain(line.dimensionWeightPerEach) },
  { key: 'shippingWeightPerEach', label: 'Ship Weight', format: (line) => fmtNullablePlain(line.shippingWeightPerEach) },
  { key: 'length', label: 'Length', format: (line) => fmtPlain(line.length) },
  { key: 'width', label: 'Width', format: (line) => fmtPlain(line.width) },
  { key: 'height', label: 'Height', format: (line) => fmtPlain(line.height) },
  { key: 'dimUnit', label: 'Dim Unit', format: (line) => (line.dimUnit === 2 ? 'INCH' : 'CM') },
  { key: 'importDutyPercent', label: 'Duty %', format: (line) => fmtPlain(line.importDutyPercent) },
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

export function BulkCostWorkspace({ supplierCode, supplierName, savedRunId: initialSavedRunId = null, backLabel = 'Back to Allocations', onBack }: BulkCostWorkspaceProps) {
  const lineTableSizing = useResizableTableColumns('bulk-cost-source-lines', LINE_TABLE_COLUMNS);
  const reviewTableSizing = useResizableTableColumns('bulk-cost-result-review', REVIEW_RESULT_TABLE_COLUMNS);
  const formulaTableSizing = useResizableTableColumns('bulk-cost-result-formula', FORMULA_PREVIEW_TABLE_COLUMNS);
  const fullTableSizing = useResizableTableColumns('bulk-cost-result-full', FINAL_PREVIEW_TABLE_COLUMNS);
  const demoLines = useMemo(() => getDemoLinesForSupplier(supplierCode), [supplierCode]);
  const demoCosts = useMemo(() => getDemoCostsForSupplier(supplierCode), [supplierCode]);
  const isRestoringMode = initialSavedRunId !== null;
  const [sourceView, setSourceView] = useState<SourceTableView>('latest');
  const [lineColumnPreset, setLineColumnPreset] = useState<LineColumnPreset>('overview');
  const [resultView, setResultView] = useState<ResultView>('review');
  const [originLines, setOriginLines] = useState<AllocationLineSource[]>(() =>
    isRestoringMode ? [] : demoLines.map((line) => cloneLineForSupplier(line, supplierCode, supplierName)),
  );
  const [allLines, setAllLines] = useState<AllocationLineSource[]>(() =>
    isRestoringMode ? [] : demoLines.map((line) => cloneLineForSupplier(line, supplierCode, supplierName)),
  );
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(
    () => isRestoringMode ? new Set() : new Set(demoLines.map((line) => line.lineKey)),
  );
  const [costs, setCosts] = useState<BulkCostInput>(() => isRestoringMode ? { ...EMPTY_BULK_COST_INPUT } : demoCosts);
  const [focusedCostInput, setFocusedCostInput] = useState<string | null>(null);
  const [preview, setPreview] = useState<AllocationPreview | null>(null);
  const [previewEdits, setPreviewEdits] = useState<PreviewEdits>({});
  const [isCalculating, setIsCalculating] = useState(false);
  const [isLoadingRun, setIsLoadingRun] = useState(isRestoringMode);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [savedRunId, setSavedRunId] = useState<number | null>(initialSavedRunId);
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
      } else {
        const demo = demoLines.map((line) => cloneLineForSupplier(line, supplierCode, supplierName));
        setAllLines(demo);
        setOriginLines(demo);
        setSelectedKeys(new Set(demo.map((l) => l.lineKey)));
      }
      if (run.inputSnapshot.costs) {
        setCosts(run.inputSnapshot.costs as BulkCostInput);
      }
      if (run.previewSnapshot) {
        setPreview(run.previewSnapshot as AllocationPreview);
        window.setTimeout(() => {
          document.getElementById('preview-title')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 150);
      }
      setRunStatus(run.status);
      setIsLoadingRun(false);
    }).catch(() => {
      if (cancelled) return;
      toast.error('Failed to load saved run data');
      const demo = demoLines.map((line) => cloneLineForSupplier(line, supplierCode, supplierName));
      setAllLines(demo);
      setOriginLines(demo);
      setSelectedKeys(new Set(demo.map((l) => l.lineKey)));
      setCosts(demoCosts);
      setIsLoadingRun(false);
    });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only on mount — initialSavedRunId is stable

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
    const visibleKeys = new Set(LINE_COLUMN_PRESETS[lineColumnPreset]);
    return LINE_TABLE_COLUMNS.filter((column) => visibleKeys.has(column.key));
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
    setSavedRunId(null);
  }, []);

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
      setCosts((prev) => ({ ...prev, currency: dominantCurrency }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dominantCurrency]);

  const updateCost = useCallback((key: keyof BulkCostInput, raw: string) => {
    setCosts((prev) => {
      if (key === 'currency' || key === 'referenceNo' || key === 'remark'
          || key === 'orderTerm' || key === 'location' || key === 'contactPerson' || key === 'saleIncharge') {
        return { ...prev, [key]: raw };
      }
      return { ...prev, [key]: parseNumericInput(raw) };
    });
    resetPreview();
  }, [resetPreview]);

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
    const newLine = createBlankLine(nextNo, supplierCode, supplierName, costs);
    setAllLines((prev) => [...prev, newLine]);
    setSelectedKeys((prev) => new Set([...prev, newLine.lineKey]));
    resetPreview();
  }, [allLines.length, costs, resetPreview, supplierCode, supplierName]);

  const updateLineTextField = useCallback((
    lineKey: string,
    key: EditableLineTextField,
    value: string,
  ) => {
    setAllLines((prev) =>
      prev.map((line) => (
        line.lineKey === lineKey ? { ...line, [key]: value } : line
      )),
    );
    resetPreview();
  }, [resetPreview]);

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

  const handleCalculate = useCallback(() => {
    setIsCalculating(true);
    setPreviewEdits({});
    setSavedRunId(null);
    window.setTimeout(() => {
      const result = calculateAllocationPreview(effectiveSelectedLines, costs);
      setPreview(result);
      setIsCalculating(false);
    }, 250);
  }, [effectiveSelectedLines, costs]);

  const handleReset = useCallback(() => {
    setCosts({ ...EMPTY_BULK_COST_INPUT });
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
      toast.success(`Bulk Cost draft saved (Run #${saved.runId})`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save Bulk Cost draft';
      toast.error(message);
    } finally {
      setIsSavingDraft(false);
    }
  }, [allLines, costs, getFinalResultForLine, originLines, preview, supplierCode, supplierName]);

  const handleMarkStatus = useCallback(async (status: 'AWARDED' | 'LOST') => {
    if (!savedRunId) return;
    setIsUpdatingStatus(true);
    try {
      await updateBulkCostRunStatus(savedRunId, status);
      setRunStatus(status);
      toast.success(`Run #${savedRunId} marked as ${status}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : `Failed to mark run as ${status}`;
      toast.error(message);
    } finally {
      setIsUpdatingStatus(false);
    }
  }, [savedRunId]);

  const canCalculate = selectedLines.length > 0 && !isLoadingRun;
  const canSaveDraft = preview !== null && preview.lines.length > 0 && !isCalculating && !isLoadingRun;
  const displayedLines = sourceView === 'origin' ? originLines : allLines;
  const isLatestView = sourceView === 'latest';

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
              <p className="eyebrow">Bulk Cost Allocation</p>
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
            <p className="eyebrow">Bulk Cost Allocation</p>
            <h1>Allocation Workspace</h1>
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
          >
            {isSavingDraft ? (
              <Loader2 size={16} className="spin-icon" aria-hidden="true" />
            ) : (
              <Save size={16} aria-hidden="true" />
            )}
            {isSavingDraft ? 'Saving...' : savedRunId ? `Saved #${savedRunId}` : 'Save Draft'}
          </button>
          {savedRunId !== null && runStatus === 'DRAFT' && (
            <>
              <button
                className="success-button"
                type="button"
                disabled={isUpdatingStatus}
                onClick={() => { void handleMarkStatus('AWARDED'); }}
                title="Mark this run as Awarded"
              >
                {isUpdatingStatus ? (
                  <Loader2 size={16} className="spin-icon" aria-hidden="true" />
                ) : (
                  <Trophy size={16} aria-hidden="true" />
                )}
                Awarded
              </button>
              <button
                className="danger-button"
                type="button"
                disabled={isUpdatingStatus}
                onClick={() => { void handleMarkStatus('LOST'); }}
                title="Mark this run as Lost"
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
              {runStatus}
            </span>
          )}
        </div>
      </section>

      <div className="bulk-cost-workspace-body">
      <section className="panel cost-bar-panel" aria-labelledby="cost-title">
        <div className="cost-bar-header">
          <div>
            <p className="eyebrow">Step 1</p>
            <h2 id="cost-title" className="cost-bar-title-with-supplier">
              Bulk Cost for
              <span className="cost-bar-supplier-name">{supplierName}</span>
              <small className="cost-bar-supplier-code">({supplierCode})</small>
            </h2>
            {(costs.contactPerson || costs.saleIncharge) && (
              <div className="cost-bar-contact-badges">
                {costs.saleIncharge && (
                  <span className="cost-bar-badge cost-bar-badge--sale">
                    <User size={12} aria-hidden="true" /> {costs.saleIncharge}
                  </span>
                )}
                {costs.contactPerson && (
                  <span className="cost-bar-badge cost-bar-badge--contact">
                    <Phone size={12} aria-hidden="true" /> {costs.contactPerson}
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="cost-bar-title-icon">
            <BadgeDollarSign size={20} aria-hidden="true" />
          </div>
        </div>

        {/* Compact quote-level controls */}
        <div className="cost-bar-strip">

          {/* Shipping context: Purchase Term, Ship Mode, Term Location */}
          <div className="cost-bar-cost-section cost-bar-shipping-section">
            <div className="cost-bar-fields-row">
              <label className="cost-bar-field cost-bar-term-field">
                <span>Purchase Term</span>
                <select
                  id="bulk-cost-order-term"
                  name="bulkCost.orderTerm"
                  className="cost-bar-select"
                  value={ORDER_TERM_OPTIONS.includes(costs.orderTerm) ? costs.orderTerm : '__other__'}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val !== '__other__') updateCost('orderTerm', val);
                  }}
                >
                  {ORDER_TERM_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                  {!ORDER_TERM_OPTIONS.includes(costs.orderTerm) && (
                    <option value="__other__">{costs.orderTerm || 'Other'}</option>
                  )}
                </select>
                </label>
                <label className="cost-bar-field cost-bar-location-field">
                  <span>Term Location</span>
                  <select
                    id="bulk-cost-location"
                    name="bulkCost.location"
                    className="cost-bar-select"
                    value={TERM_LOCATION_OPTIONS.includes(costs.location) ? costs.location : '__other__'}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val !== '__other__') updateCost('location', val);
                    }}
                  >
                    {TERM_LOCATION_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                    {!TERM_LOCATION_OPTIONS.includes(costs.location) && (
                      <option value="__other__">{costs.location || 'Other'}</option>
                    )}
                  </select>
                </label>
              <label className="cost-bar-field cost-bar-shipmode-field">
                <span>Ship Mode</span>
                <select
                  id="bulk-cost-ship-mode"
                  name="bulkCost.shipModeNo"
                  className="cost-bar-select"
                  value={costs.shipModeNo}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    setCosts((prev) => ({ ...prev, shipModeNo: isNaN(val) ? 0 : val }));
                    resetPreview();
                  }}
                >
                  {Object.entries(SHIP_MODE_LABELS).map(([no, label]) => (
                    <option key={no} value={no}>{label}</option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          {/* PKH SOC */}
          <div className="cost-bar-cost-section cost-bar-cost-section-first">
            <div className="cost-bar-fields-row">
              {COST_FIELDS.filter((f) => ['pkh', 'soc'].includes(f.key)).map(({ key, label }) => (
                <label className="cost-bar-field cost-bar-cost-field" key={key}>
                  <span>{label}</span>
                  <FormattedNumberInput
                    id={`bulk-cost-${key}`}
                    name={`bulkCost.${key}`}
                    value={costs[key]}
                    focused={focusedCostInput === key}
                    onBlur={() => setFocusedCostInput(null)}
                    onChange={(event) => updateCost(key, event.target.value)}
                    onFocus={() => setFocusedCostInput(key)}
                    placeholder="0.00"
                    aria-label={label}
                  />
                </label>
              ))}
            </div>
          </div>

          {/* FR CC TT */}
          <div className="cost-bar-cost-section">
            <div className="cost-bar-fields-row">
              {COST_FIELDS.filter((f) => ['freight', 'customs', 'wireTT'].includes(f.key)).map(({ key, label }) => (
                <label className="cost-bar-field cost-bar-cost-field" key={key}>
                  <span>{label}</span>
                  <FormattedNumberInput
                    id={`bulk-cost-${key}`}
                    name={`bulkCost.${key}`}
                    value={costs[key]}
                    focused={focusedCostInput === key}
                    onBlur={() => setFocusedCostInput(null)}
                    onChange={(event) => updateCost(key, event.target.value)}
                    onFocus={() => setFocusedCostInput(key)}
                    placeholder="0.00"
                    aria-label={label}
                  />
                </label>
              ))}
            </div>
          </div>

          {/* Currency Exchange Rate */}
          <div className="cost-bar-cost-section">
            <div className="cost-bar-fields-row">
              <label className="cost-bar-field cost-bar-currency-field">
                <span>Currency</span>
                <select
                  id="bulk-cost-currency"
                  name="bulkCost.currency"
                  className="cost-bar-select"
                  value={CURRENCY_OPTIONS.includes(costs.currency) ? costs.currency : '__other__'}
                  onChange={(event) => {
                    const val = event.target.value;
                    if (val !== '__other__') updateCost('currency', val);
                  }}
                >
                  {CURRENCY_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                  {!CURRENCY_OPTIONS.includes(costs.currency) && (
                    <option value="__other__">{costs.currency || 'Other'}</option>
                  )}
                </select>
              </label>
              <label className="cost-bar-field cost-bar-rate-field">
                <span>Exchange Rate to THB</span>
                <FormattedNumberInput
                  id="bulk-cost-exchange-rate"
                  name="bulkCost.exchangeRate"
                  value={costs.exchangeRate}
                  focused={focusedCostInput === 'exchangeRate'}
                  onBlur={() => setFocusedCostInput(null)}
                  onChange={(event) => updateCost('exchangeRate', event.target.value)}
                  onFocus={() => setFocusedCostInput('exchangeRate')}
                />
              </label>
            </div>
          </div>

        </div>

        <div className="cost-bar-note">
          <Info size={16} aria-hidden="true" />
          <span>Enter quote-level costs once. CAL allocates them to the selected item lines.</span>
        </div>
      </section>

      <div className="allocation-workspace-stack">
        <section className="panel selector-panel" aria-labelledby="selector-title">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Step 2</p>
              <h2 id="selector-title">Supplier Lines</h2>
            </div>
            <span className="status-pill">One supplier run</span>
          </div>

          <div className="supplier-box">
            <span>Selected supplier</span>
            <strong>{supplierName}</strong>
            <small>
              Vendor code: {supplierCode} - Origin is read-only AXON data. Latest is editable and is always used for CAL.
            </small>
          </div>

          <div className="summary-strip source-summary-strip">
            <SummaryItem label="Selected lines" value={`${selectedLines.length} / ${allLines.length}`} />
            <SummaryItem label="Final rows" value={`${selectedLines.length} item/term`} />
            <SummaryItem label="Total qty" value={fmt(totalQty)} />
            <SummaryItem label="Total amount" value={`${selectedLines[0]?.currency ?? ''} ${fmt(totalAmount)}`} />
            <SummaryItem
              label="Known weight"
              value={`${fmt(totalWeight)} kg`}
              warning={linesWithWarning > 0 ? `${linesWithWarning} missing` : undefined}
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
              Calculation uses Latest values only.
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
                Overview
              </button>
              <button
                className={`line-view-tab ${lineColumnPreset === 'docs' ? 'line-view-tab-active' : ''}`}
                type="button"
                onClick={() => setLineColumnPreset('docs')}
              >
                Document Fees
              </button>
              <button
                className={`line-view-tab ${lineColumnPreset === 'weight' ? 'line-view-tab-active' : ''}`}
                type="button"
                onClick={() => setLineColumnPreset('weight')}
              >
                Weight
              </button>
              <button
                className={`line-view-tab ${lineColumnPreset === 'logistics' ? 'line-view-tab-active' : ''}`}
                type="button"
                onClick={() => setLineColumnPreset('logistics')}
              >
                Logistics
              </button>
              <button
                className={`line-view-tab ${lineColumnPreset === 'all' ? 'line-view-tab-active' : ''}`}
                type="button"
                onClick={() => setLineColumnPreset('all')}
              >
                All
              </button>
            </div>
          )}

          {sourceView !== 'changes' && (
            <p className="preset-hint">
              {lineColumnPreset === 'overview' && 'เลือกไลน์ที่ต้องการคำนวณ ตรวจสอบรายการ Brand / P/N / จำนวน / ราคา / สกุลเงิน และยืนยัน Group / Country of Origin'}
              {lineColumnPreset === 'docs' && 'By Lot: กรอกเพียงช่องเดียวต่อประเภท ระบบแยกออกเป็น Service Line อัตโนมัติ | /Ea: หารด้วย Qty ก่อนกรอก'}
              {lineColumnPreset === 'weight' && 'กรอก Item Weight และ L×W×H — ระบบคำนวณ Dim Weight อัตโนมัติ | Ship Weight = Max(Item Wt, Dim Wt) CEILING ทุก 0.5 kg'}
              {lineColumnPreset === 'logistics' && 'ตรวจสอบ Purchase Term / Ship Mode / Location / HS Code / Import Duty | importPermit และ shelfLife ใช้สำหรับ Compliance การนำเข้า'}
              {lineColumnPreset === 'all' && 'แสดงทุกคอลัมน์ — อ่านอย่างเดียว ใช้เพื่อ review ก่อนคำนวณ'}
            </p>
          )}

          {allLines.length === 0 ? (
            <div className="empty-state">
              <Search size={32} aria-hidden="true" />
              <p>No item lines yet.</p>
              <small>Click <strong>+ Add Item</strong> above to enter items manually.</small>
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
                      {visibleLineColumns.map((column) =>
                        column.key === 'select' ? (
                          <th key="select" className="resizable-table-header" {...lineTableSizing.getCellProps('select')}>
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
                          />
                        )
                      )}
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
                              changedCellKeys={changedCellKeys}
                              checked={checked}
                              editable={isLatestView && canEditLineColumnInPreset(lineColumnPreset, column.key)}
                              line={line}
                              missingWeight={missingWeight}
                              tableSizing={lineTableSizing}
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
        <div className="panel-header">
          <div>
            <p className="eyebrow">Step 3</p>
            <h2 id="preview-title">Result Review</h2>
          </div>
          <Boxes size={22} aria-hidden="true" />
        </div>

        {isCalculating ? (
          <div className="preview-loading">
            <Loader2 size={28} className="spin-icon" aria-hidden="true" />
            <p>Calculating allocation...</p>
          </div>
        ) : preview === null ? (
          <div className="preview-empty">
            <Info size={28} aria-hidden="true" />
            <p>Click <strong>CAL</strong> to calculate final prices.</p>
            <small>Each selected line will become one item/term result row.</small>
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
      style={stickyLeft !== undefined ? { position: 'sticky', left: stickyLeft, zIndex: 3 } : undefined}
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
  changedCellKeys,
  checked,
  columnKey,
  editable,
  line,
  missingWeight,
  tableSizing,
  onDocFeeChange,
  onDocFeeBasisChange,
  onNullableNumberChange,
  onNumberChange,
  onTextChange,
  onToggleLine,
}: {
  changedCellKeys: Set<string>;
  checked: boolean;
  columnKey: string;
  editable: boolean;
  line: AllocationLineSource;
  missingWeight: boolean;
  tableSizing: ResizableTableSizing;
  onDocFeeChange: (lineKey: string, key: keyof DocumentFees, raw: string) => void;
  onDocFeeBasisChange: (lineKey: string, key: keyof DocumentFees, basis: 'PER_EACH' | 'BY_LOT_BATCH') => void;
  onNullableNumberChange: (lineKey: string, key: EditableLineNullableNumberField, raw: string) => void;
  onNumberChange: (lineKey: string, key: EditableLineNumberField, raw: string) => void;
  onTextChange: (lineKey: string, key: EditableLineTextField, value: string) => void;
  onToggleLine: (lineKey: string) => void;
}) {
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
        <td {...tableSizing.getCellProps('select')}>
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
    case 'no':
      return <td {...tableSizing.getCellProps('no')} className="center-cell">{line.no}</td>;
    case 'itemGroup':
      return <LineItemGroupCell changed={hasChanged(changedCellKeys, line.lineKey, 'itemGroup')} editable={editable} line={line} tableSizing={tableSizing} onChange={(value) => onTextChange(line.lineKey, 'itemGroup', value)} />;
    case 'itemCategory':
      return <LineTextCell changed={hasChanged(changedCellKeys, line.lineKey, 'itemCategory')} columnKey="itemCategory" editable={editable} line={line} tableSizing={tableSizing} value={line.itemCategory} onChange={(value) => onTextChange(line.lineKey, 'itemCategory', value)} />;
    case 'matchStatus':
      return <td {...tableSizing.getCellProps('matchStatus')} className="center-cell">{formatMatchStatus(line.itemCode)}</td>;
    case 'description':
      return <LineTextCell changed={hasChanged(changedCellKeys, line.lineKey, 'sapDescription')} className="text-left-cell" columnKey="description" editable={editable} line={line} tableSizing={tableSizing} value={line.sapDescription} onChange={(value) => onTextChange(line.lineKey, 'sapDescription', value)} />;
    case 'manufacturer':
      return <LineTextCell changed={hasChanged(changedCellKeys, line.lineKey, 'manufacturer')} columnKey="manufacturer" editable={editable} line={line} tableSizing={tableSizing} value={line.manufacturer} onChange={(value) => onTextChange(line.lineKey, 'manufacturer', value)} />;
    case 'mfgPartNumber':
      return <LineTextCell changed={hasChanged(changedCellKeys, line.lineKey, 'mfgPartNumber')} columnKey="mfgPartNumber" editable={editable} line={line} tableSizing={tableSizing} value={line.mfgPartNumber} onChange={(value) => onTextChange(line.lineKey, 'mfgPartNumber', value)} />;
    case 'supplierOrderCode':
      return <LineTextCell changed={hasChanged(changedCellKeys, line.lineKey, 'supplierOrderCode')} columnKey="supplierOrderCode" editable={editable} line={line} tableSizing={tableSizing} value={line.supplierOrderCode} onChange={(value) => onTextChange(line.lineKey, 'supplierOrderCode', value)} />;
    case 'qty':
      return <LineNumberCell changed={hasChanged(changedCellKeys, line.lineKey, 'qty')} columnKey="qty" editable={editable} line={line} tableSizing={tableSizing} tdClassName="center-cell" value={line.qty} onChange={(value) => onNumberChange(line.lineKey, 'qty', value)} />;
    case 'uom':
      return <LineTextCell changed={hasChanged(changedCellKeys, line.lineKey, 'uom')} className="center-cell" columnKey="uom" editable={editable} line={line} tableSizing={tableSizing} value={line.uom} onChange={(value) => onTextChange(line.lineKey, 'uom', value)} />;
    case 'unitPrice':
      return <LineNumberCell changed={hasChanged(changedCellKeys, line.lineKey, 'unitPrice')} columnKey="unitPrice" editable={editable} line={line} tableSizing={tableSizing} tdClassName="numeric-cell" value={line.unitPrice} onChange={(value) => onNumberChange(line.lineKey, 'unitPrice', value)} />;
    case 'amount':
      return <td {...tableSizing.getCellProps('amount')} className={cellChangedClass(hasChanged(changedCellKeys, line.lineKey, 'amount'), 'numeric-cell')}>{fmt(line.amount)}</td>;
    case 'currency':
      return <LineTextCell changed={hasChanged(changedCellKeys, line.lineKey, 'currency')} className="center-cell" columnKey="currency" editable={editable} line={line} tableSizing={tableSizing} value={line.currency} onChange={(value) => onTextChange(line.lineKey, 'currency', value)} />;
    case 'hsCode':
      return <LineTextCell changed={hasChanged(changedCellKeys, line.lineKey, 'hsCode')} columnKey="hsCode" editable={editable} line={line} tableSizing={tableSizing} value={line.hsCode} onChange={(value) => onTextChange(line.lineKey, 'hsCode', value)} />;
    case 'countryOfOrigin':
      return <LineTextCell changed={hasChanged(changedCellKeys, line.lineKey, 'countryOfOrigin')} columnKey="countryOfOrigin" editable={editable} line={line} tableSizing={tableSizing} value={line.countryOfOrigin} onChange={(value) => onTextChange(line.lineKey, 'countryOfOrigin', value)} />;
    case 'leadTime':
      return <LineTextCell changed={hasChanged(changedCellKeys, line.lineKey, 'deliveryLeadTime')} columnKey="leadTime" editable={editable} line={line} tableSizing={tableSizing} value={line.deliveryLeadTime} onChange={(value) => onTextChange(line.lineKey, 'deliveryLeadTime', value)} />;
    case 'orderTerm':
      return <td {...tableSizing.getCellProps('orderTerm')} className="center-cell">{line.orderTerm}</td>;
    case 'location':
      return <td {...tableSizing.getCellProps('location')}>{line.location}</td>;
    case 'shipMode':
      return <td {...tableSizing.getCellProps('shipMode')} className={cellChangedClass(hasChanged(changedCellKeys, line.lineKey, 'shipModeNo'), 'center-cell')}>{formatShipMode(line.shipModeNo)}</td>;
    case 'importPermit':
      return <LineYesNoCell changed={hasChanged(changedCellKeys, line.lineKey, 'importPermit')} columnKey="importPermit" editable={editable} line={line} tableSizing={tableSizing} value={line.importPermit} onChange={(value) => onTextChange(line.lineKey, 'importPermit', value)} />;
    case 'shelfLife':
      return <LineYesNoCell changed={hasChanged(changedCellKeys, line.lineKey, 'shelfLifeRequire')} columnKey="shelfLife" editable={editable} line={line} tableSizing={tableSizing} value={line.shelfLifeRequire} onChange={(value) => onTextChange(line.lineKey, 'shelfLifeRequire', value)} />;
    case 'itemWeight':
      return <LineNullableNumberCell changed={hasChanged(changedCellKeys, line.lineKey, 'itemWeightPerEach')} columnKey="itemWeight" editable={editable} line={line} tableSizing={tableSizing} tdClassName="numeric-cell" value={line.itemWeightPerEach} onChange={(value) => onNullableNumberChange(line.lineKey, 'itemWeightPerEach', value)} />;
    case 'dimWeight':
      return <LineNullableNumberCell changed={hasChanged(changedCellKeys, line.lineKey, 'dimensionWeightPerEach')} columnKey="dimWeight" editable={editable} line={line} tableSizing={tableSizing} tdClassName="numeric-cell" value={line.dimensionWeightPerEach} onChange={(value) => onNullableNumberChange(line.lineKey, 'dimensionWeightPerEach', value)} />;
    case 'shipWeight':
      return <LineNullableNumberCell changed={hasChanged(changedCellKeys, line.lineKey, 'shippingWeightPerEach')} columnKey="shipWeight" editable={editable} line={line} tableSizing={tableSizing} tdClassName="numeric-cell" value={line.shippingWeightPerEach} onChange={(value) => onNullableNumberChange(line.lineKey, 'shippingWeightPerEach', value)} />;
    case 'dimUnit':
      return (
        <td {...tableSizing.getCellProps('dimUnit')} className={cellChangedClass(hasChanged(changedCellKeys, line.lineKey, 'dimUnit'), 'center-cell')}>
          {editable ? (
            <select
              id={`latest-${line.lineKey}-dimUnit`}
              name={`latest.${line.lineKey}.dimUnit`}
              className="line-edit-input"
              value={line.dimUnit}
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
  line,
  tableSizing,
  onChange,
}: {
  changed: boolean;
  editable: boolean;
  line: AllocationLineSource;
  tableSizing: ResizableTableSizing;
  onChange: (value: string) => void;
}) {
  return (
    <td {...tableSizing.getCellProps('itemGroup')} className={cellChangedClass(changed, 'center-cell')}>
      {editable ? (
        <select
          id={`latest-${line.lineKey}-itemGroup`}
          name={`latest.${line.lineKey}.itemGroup`}
          className="line-edit-input"
          value={line.itemGroup}
          onChange={(event) => onChange(event.target.value)}
        >
          {ITEM_GROUP_OPTIONS.map((option) => (
            <option key={option.code} value={option.code}>
              {option.name}
            </option>
          ))}
        </select>
      ) : (
        <span>{formatItemGroup(line.itemGroup)}</span>
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
  tableSizing,
  value,
  onChange,
}: {
  changed: boolean;
  className?: string;
  columnKey: string;
  editable: boolean;
  line: AllocationLineSource;
  tableSizing: ResizableTableSizing;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <td {...tableSizing.getCellProps(columnKey)} className={cellChangedClass(changed, className)}>
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
        <select
          id={`latest-${line.lineKey}-${columnKey}`}
          name={`latest.${line.lineKey}.${columnKey}`}
          className="line-edit-input"
          value={normalizedValue}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="No">No</option>
          <option value="Yes">Yes</option>
        </select>
      ) : (
        <span>{normalizedValue}</span>
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
        <small>Latest currently matches imported AXON data.</small>
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
              <ResizableHeader columnKey="rowNo" label="No" sizing={reviewTableSizing} />
              <ResizableHeader columnKey="itemGroup" label="Group" sizing={reviewTableSizing} />
              <ResizableHeader columnKey="supplierOrderCode" label="Supp Order Code" sizing={reviewTableSizing} />
              <ResizableHeader columnKey="description" label="Description" sizing={reviewTableSizing} />
              <ResizableHeader columnKey="qty" label="Qty" sizing={reviewTableSizing} />
              <ResizableHeader columnKey="uom" label="UOM" sizing={reviewTableSizing} />
              {REVIEW_RESULT_KEYS.map((key) => (
                <ResizableHeader
                  className="th-final"
                  columnKey={getFinalResultColumnKey(key)}
                  key={key}
                  label={FINAL_RESULT_COL_BY_KEY.get(key)?.label ?? key}
                  sizing={reviewTableSizing}
                />
              ))}
              <ResizableHeader className="th-final" columnKey="draftPreview" label="Draft Preview" sizing={reviewTableSizing} />
              <ResizableHeader className="th-final" columnKey="status" label="Status" sizing={reviewTableSizing} />
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
              <th colSpan={ALLOC_COLS.length} className="th-group">Allocation</th>
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
            <th colSpan={ALLOC_COLS.length} className="th-group">Allocation</th>
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
        return (
          <td key={key} {...tableSizing.getCellProps(getFinalResultColumnKey(key))} className={column.kind === 'number' ? 'numeric-cell' : ''}>
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
  const audit = buildBulkCostFormulaAudit(source, costs, finalResult, { allocationLine: result });
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
        <DraftPreviewField label="Ship Mode" value={formatShipMode(costs.shipModeNo || source.shipModeNo)} />
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
        <DraftPreviewField label="OP1" value={fmt(finalResult.op1Source)} />
        <DraftPreviewField label="OP1 (THB)" value={fmt(finalResult.op1)} />
        <DraftPreviewField label="OP2 (THB)" value={fmt(finalResult.op2)} />
        <DraftPreviewField label="Round Up" value={fmt(finalResult.roundUp)} />
      </DraftPreviewSection>

      <DraftPreviewSection title="Weight, Duty, and QLC">
        <DraftPreviewField label="Item Wt/Ea" value={fmt(source.itemWeightPerEach)} />
        <DraftPreviewField label="Dim Wt/Ea" value={fmt(source.dimensionWeightPerEach)} />
        <DraftPreviewField label="Ship Wt/Ea" value={fmt(finalResult.shipWeightCal)} />
        <DraftPreviewField label="Duty %" value={fmt(finalResult.importDutyPercent)} />
        <DraftPreviewField label="Insurance %" value={fmt(finalResult.insPercent)} />
        <DraftPreviewField label="FR QTEC" value={fmt(finalResult.frQTEC)} />
        <DraftPreviewField label="Zone Rate" value={fmt(finalResult.frZoneRate)} />
        <DraftPreviewField label="TT" value={fmt(finalResult.wireTT)} />
        <DraftPreviewField label="CC" value={fmt(finalResult.customClear)} />
        <DraftPreviewField label="QLC" value={fmt(finalResult.qlc)} />
        <DraftPreviewField label="SPK" value={fmt(finalResult.spk)} />
        <DraftPreviewField label="QOC" value={fmt(finalResult.qocVal)} />
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
