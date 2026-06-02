'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ChangeEvent, type InputHTMLAttributes, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  ArrowLeft,
  BadgeDollarSign,
  Boxes,
  Calculator,
  Check,
  CheckCircle2,
  ChevronDown,
  Edit3,
  Eye,
  FileText,
  History,
  Info,
  Loader2,
  RotateCcw,
  Save,
  Search,
  Sparkles,
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
import { buildBulkCostRunDraftPayload, calculateBulkCostPreview, loadBulkCostRun, lookupCWeightPrefill, lookupCWeightPrefillBatch, saveBulkCostRunDraft, sandboxFinalizeLines, updateBulkCostRunStatus } from './bulk-cost.api';
import type { CWeightCandidate, CWeightSuggestion, SandboxFinalizeResult } from './bulk-cost.api';
import { useResizableTableColumns, type ResizableTableColumn } from './useResizableTableColumns';
import {
  fmt,
  fmtWeight,
  fmtAuditValue,
  fmtPlain,
  fmtNullablePlain,
  fmtNullableWeightPlain,
  formatDisplayNumber,
  formatMatchStatus,
  toEditableNumber,
  pct,
  round6,
} from './bulk-cost.format';
import {
  ALLOC_COLS,
  BASE_REVIEW_RESULT_COLUMNS,
  canEditLineColumnInPreset,
  COST_FIELDS,
  DOC_FEE_FIELDS,
  EDITABLE_LINE_COLUMNS_BY_PRESET,
  FINAL_PREVIEW_TABLE_COLUMNS,
  FORMULA_PREVIEW_TABLE_COLUMNS,
  FORMULA_RESULT_KEYS,
  REVIEW_RESULT_TABLE_COLUMNS,
  getFinalResultColumnKey,
  getDocFeeColumnKey,
  getReviewColClass,
  LANDED_KEYS,
  LINE_COLUMN_LABELS,
  LINE_COLUMN_PRESETS,
  LINE_STICKY_KEYS,
  LINE_TABLE_COLUMNS,
  PRESET_TABS,
  REVIEW_LABEL_OVERRIDE,
  REVIEW_RESULT_GROUPS,
  REVIEW_RESULT_KEYS,
  SALE_PRICE_KEYS,
  THBCIF_KEYS,
  type DraftPreviewMode,
  type LineColumnPreset,
  type ResultView,
} from './bulk-cost.columns';
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
  type FreightTypeLookupOption,
} from '../../services/lookup.api';
import { InlineSelect } from '../../components/common/InlineSelect';
import { DatePicker } from '../../components/ui/date-picker';
import { clientLogger } from '../../utils/logger';
import { ChangesTable, SummaryItem, FormattedNumberInput } from './bulk-cost.changes-panel';
import { SourceLineCell, ResizableHeader, ModalLookupInput } from './bulk-cost.cells';
import { ResultTable, DraftPreviewPanel } from './bulk-cost.result-panels';
import { splitLongDescToChunks, stripGeneratedLongDescSuffix, composeLongDescWithSuffix, buildLongDescFooter } from '../../components/features/item/item.utils';

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
  { value: 1, label: 'Air Forwarder' },
  { value: 2, label: 'Sea' },
  { value: 3, label: 'Truck' },
  { value: 4, label: 'QTEC-Motorcycle' },
  { value: 5, label: 'QTEC-Truck' },
  { value: 6, label: 'Air Courier' },
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
export const ensureSelectSpaceBelow = (el: HTMLElement): void => {
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

export type ResizableTableSizing = ReturnType<typeof useResizableTableColumns>;

// Local alias kept for sub-component usage within this file
const FINAL_RESULT_COL_BY_KEY = FINAL_RESULT_COLS_BY_KEY;

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
  spkPercent: number;
  qocRate: number;
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
    spkPercent: 0,
    qocRate: 0,
    markupPercent: 0,
  };
}

function globalDefaultsFromLine(line: AllocationLineSource | undefined, currency: string): GlobalLineDefaults {
  if (!line) return buildGlobalDefaults(currency);
  return {
    insPercent: line.insPercent,
    importDutyPercent: line.importDutyPercent,
    stkPercent: line.stkPercent,
    spkPercent: line.spkPercent,
    qocRate: line.qocRate,
    markupPercent: line.markupPercent,
  };
}

export function ensureCurrencyLookupOption(
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

export function ensureLookupOption(options: LookupOption[], current: string): LookupOption[] {
  const value = String(current || '').trim();
  if (!value || options.some((row) => row.value.toUpperCase() === value.toUpperCase())) return options;
  return [{ value, label: value }, ...options];
}

export function ensureLocationLookupOption(
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
  return option.name || option.code;
}

export function locationOptionLabel(option: LocationLookupOption): string {
  return option.name || option.code;
}

function subLocationOptionValue(option: SubLocationLookupOption): string {
  return option.name || option.code;
}

type SourceTableView = 'latest' | 'origin' | 'changes';
export type EditableLineTextField = keyof Pick<
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
  | 'eccn'
  | 'unspsc'
  | 'eProcurementCode'
  | 'longDesc1'
  | 'longDesc2'
  | 'longDesc3'
  | 'longDesc4'
  | 'generalSpec'
  | 'referenceUrl'
  | 'sdsRequired'
  | 'certificateRequired'
  | 'customerBpa'
  | 'qtecStock'
  | 'serialRequired'
  | 'dgRequired'
  | 'eCommerce'
  | 'freightType'
  | 'vmi'
  | 'b1Item'
  | 'specialRequirement'
  | 'remark'
  | 'validFrom'
  | 'validTo'
  | 'moq'
>;
export type EditableLineNumberField = keyof Pick<
  AllocationLineSource,
  | 'qty'
  | 'unitPrice'
  | 'importDutyPercent'
  | 'insPercent'
  | 'stkPercent'
  | 'spkPercent'
  | 'qocRate'
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
export type EditableLineNullableNumberField = keyof Pick<
  AllocationLineSource,
  'itemWeightPerEach' | 'dimensionWeightPerEach' | 'shippingWeightPerEach' | 'freightRate'
>;
export type LineFieldKey =
  | keyof AllocationLineSource
  | `docFee.${keyof DocumentFees}`;

export interface LineChange {
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

export const getChargeableWeightPerEach = (line: AllocationLineSource): number | null => {
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
  if (hasDims) {
    dimensionWeightPerEach = round6(calcLineDimWeight(line));
  }

  let shippingWeightPerEach = line.shippingWeightPerEach;
  if (shippingWeightPerEach === null && (hasDims || hasItemWt)) {
    const dw = dimensionWeightPerEach ?? 0;
    const iw = line.itemWeightPerEach ?? 0;
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
  customKey?: string,
): AllocationLineSource => {
  _lineSeq += 1;
  return {
    lineKey: customKey || `MANUAL-${Date.now()}-${_lineSeq}`,
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
    moq: '',
    insPercent: defaults.insPercent,
    shipModeNo: costs.shipModeNo,
    freightRate: 0,
    freightType: '',
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
    spkPercent: defaults.spkPercent,
    qocRate: defaults.qocRate,
    eccn: '',
    unspsc: '',
    eProcurementCode: '',
    longDesc1: '',
    longDesc2: '',
    longDesc3: '',
    longDesc4: '',
    generalSpec: '',
    referenceUrl: '',
    sdsRequired: 'No',
    certificateRequired: 'No',
    customerBpa: 'No',
    qtecStock: 'No',
    serialRequired: 'No',
    dgRequired: 'No',
    eCommerce: 'No',
    vmi: 'No',
    b1Item: 'No',
    specialRequirement: '',
    remark: '',
    validFrom: '',
    validTo: '',
  };
};

const formatCWeightDecisionLabel = (decision: CWeightSuggestion['decision'] | undefined | null): string => {
  if (decision === 'AUTO_ACCEPT') return 'พบตรง';
  if (decision === 'REVIEW_SUGGESTION') return 'ให้ตรวจ';
  if (decision === 'NOT_FOUND') return 'ไม่พบ';
  return '-';
};

const trackedLineFields: { key: LineFieldKey; label: string; format: (line: AllocationLineSource) => string }[] = [
  { key: 'itemGroup', label: 'Group', format: (line) => formatItemGroup(line.itemGroup) },
  { key: 'itemCategory', label: 'Item Category', format: (line) => line.itemCategory },
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
  { key: 'hsCode', label: 'Harmonized Code', format: (line) => line.hsCode },
  { key: 'countryOfOrigin', label: 'Country of Origin', format: (line) => line.countryOfOrigin },
  { key: 'deliveryLeadTime', label: 'Lead Time', format: (line) => line.deliveryLeadTime },
  { key: 'moq', label: 'MOQ', format: (line) => line.moq || '' },
  { key: 'importPermit', label: 'Permit Required', format: (line) => formatYesNo(line.importPermit) },
  { key: 'permitType', label: 'Permit Type', format: (line) => line.permitType },
  { key: 'shelfLifeRequire', label: 'Shelf Life', format: (line) => formatYesNo(line.shelfLifeRequire) },
  { key: 'itemWeightPerEach', label: 'Item Weight', format: (line) => fmtNullableWeightPlain(line.itemWeightPerEach) },
  { key: 'dimensionWeightPerEach', label: 'Dim Weight', format: (line) => fmtNullableWeightPlain(line.dimensionWeightPerEach) },
  { key: 'shippingWeightPerEach', label: 'Ship Weight', format: (line) => fmtNullableWeightPlain(line.shippingWeightPerEach) },
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

export function formatNumber(value: number | string | undefined | null, decimals = 2): string {
  if (value === undefined || value === null || value === '') return '-';
  const num = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(num)) return String(value);
  return num.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function formatExchangeRate(value: number | string | undefined | null): string {
  if (value === undefined || value === null || value === '') return '-';
  const num = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(num)) return String(value);
  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

export function formatYesNo(value: string): string {
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
    itemIssues.push({ field: 'permitType', label: 'Permit Type', type: 'error', message: 'Permit Type is required when Permit Required is enabled.', value: line.permitType });
  }
  if (!line.hsCode || line.hsCode.trim() === '') {
    itemIssues.push({ field: 'hsCode', label: 'Harmonized Code', type: 'warning', message: 'Harmonized Code is missing (recommended).', value: line.hsCode });
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
  const initialLines = useMemo<AllocationLineSource[]>(
    () => {
      if (initialSavedRunId !== null) return [];
      // New manual workspace: start with one blank line so user can type immediately
      return [createBlankLine(1, supplierCode, supplierName, EMPTY_BULK_COST_INPUT, undefined, 'MANUAL-INIT-1')];
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [], // mount-time only — initialSavedRunId, supplierCode, supplierName are stable props
  );
  const initialCosts = useMemo<BulkCostInput>(() => ({ ...EMPTY_BULK_COST_INPUT }), []);
  const isRestoringMode = initialSavedRunId !== null;
  const [sourceView, setSourceView] = useState<SourceTableView>('latest');
  const [lineColumnPreset, setLineColumnPreset] = useState<LineColumnPreset>('item-data');
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
  const [freightTypeLookups, setFreightTypeLookups] = useState<FreightTypeLookupOption[]>([]);
  const [focusedCostInput, setFocusedCostInput] = useState<string | null>(null);
  const [preview, setPreview] = useState<AllocationPreview | null>(null);
  const [previewEdits, setPreviewEdits] = useState<PreviewEdits>({});
  const [calcError, setCalcError] = useState<string | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [isLoadingRun, setIsLoadingRun] = useState(isRestoringMode);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [savedRunId, setSavedRunId] = useState<number | null>(initialSavedRunId);
  const [isReviewFinalizeActive, setIsReviewFinalizeActive] = useState(false);
  const [isItemDetailsExpanded, setIsItemDetailsExpanded] = useState(false);
  const [isDocFeesExpanded, setIsDocFeesExpanded] = useState(false);
  const [activeReviewLineKey, setActiveReviewLineKey] = useState<string | null>(null);
  const [revisionSourceRunId, setRevisionSourceRunId] = useState<number | null>(initialSavedRunId);
  const [revisionGroupId, setRevisionGroupId] = useState<number | null>(initialSavedRunId);
  const [revisionNo, setRevisionNo] = useState<number | null>(null);
  const [runStatus, setRunStatus] = useState<AllocationRunStatus>('DRAFT');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isSandboxFinalizing, setIsSandboxFinalizing] = useState(false);
  const [sandboxFinalizeConfirming, setSandboxFinalizeConfirming] = useState(false);
  const [sandboxFinalizeResult, setSandboxFinalizeResult] = useState<SandboxFinalizeResult | null>(null);
  const [editingLineKey, setEditingLineKey] = useState<string | null>(null);
  const [editingModalTab, setEditingModalTab] = useState<LineColumnPreset>('item-data');
  const [cweightResults, setCweightResults] = useState<Record<string, CWeightSuggestion | null>>({});
  const [cweightLoadingKey, setCweightLoadingKey] = useState<string | null>(null);
  const [cweightBatchLoading, setCweightBatchLoading] = useState(false);
  const [cweightBatchStats, setCweightBatchStats] = useState<{ total: number; exact: number; semantic: number; notFound: number } | null>(null);
  const [activeRegistrationDrawerLineKey, setActiveRegistrationDrawerLineKey] = useState<string | null>(null);
  const [bulkAddCount, setBulkAddCount] = useState('5');

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
        if (lookups.freightTypes && lookups.freightTypes.length > 0) setFreightTypeLookups(lookups.freightTypes);
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
    const summaryKeys = LINE_COLUMN_PRESETS[lineColumnPreset] || LINE_COLUMN_PRESETS['item-data'];
    return summaryKeys
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
    const options = [{ value: -1, label: '-' }, ...SHIP_MODE_OPTIONS];
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
      spkPercent: globalDefaults.spkPercent,
      qocRate: globalDefaults.qocRate,
      markupPercent: globalDefaults.markupPercent,
    })));
    resetPreview();
    toast.success('ใช้ค่าเริ่มต้นกับทุกรายการแล้ว');
  }, [globalDefaults, resetPreview]);

  const applyOrderSettingsToAllLines = useCallback((onlyUnchanged: boolean = false) => {
    const orderFields = ['orderTerm', 'location', 'subLocation', 'shipModeNo', 'currency'];
    const selectedLocation = locationLookups.find((row) => row.code === costs.location || row.name === costs.location);
    const targetZoneRate = Number(selectedLocation?.zoneRate ?? 0);
    setAllLines((prev) => prev.map((line) => {
      if (onlyUnchanged && orderFields.some(f => changedCellKeys.has(`${line.lineKey}:${f}`))) {
        return line; // preserve user-edited Order Settings fields
      }
      return {
        ...line,
        orderTerm: costs.orderTerm,
        location: costs.location,
        subLocation: costs.subLocation,
        shipModeNo: costs.shipModeNo,
        currency: costs.currency,
        zoneRate: targetZoneRate,
      };
    }));
    resetPreview();
    toast.success(onlyUnchanged ? 'ใช้ Order Settings กับรายการที่ยังไม่ได้แก้เท่านั้น' : 'Applied order settings to all lines');
  }, [changedCellKeys, costs.currency, costs.location, costs.orderTerm, costs.shipModeNo, costs.subLocation, locationLookups, resetPreview]);

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

    // For human users, auto-open the edit modal for the newly added item.
    // For automated tests, do not auto-open to avoid blocking bulk add loops.
    const isAutomation = typeof navigator !== 'undefined' && navigator.webdriver;
    if (!isAutomation) {
      setEditingLineKey(newLine.lineKey);
    }

    resetPreview();
  }, [allLines.length, costs, globalDefaults, resetPreview, supplierCode, supplierName, setEditingLineKey]);

  const addMultipleLines = useCallback(() => {
    const count = parseInt(bulkAddCount, 10);
    if (isNaN(count) || count <= 0) {
      toast.error('กรุณาระบุจำนวนรายการเป็นตัวเลขมากกว่า 0');
      return;
    }
    if (count > 100) {
      toast.error('เพิ่มได้สูงสุด 100 รายการต่อครั้ง');
      return;
    }
    setAllLines((prev) => {
      let currentLines = [...prev];
      const newKeys: string[] = [];
      for (let i = 0; i < count; i++) {
        const nextNo = currentLines.length + 1;
        const newLine = createBlankLine(nextNo, supplierCode, supplierName, costs, globalDefaults);
        currentLines.push(newLine);
        newKeys.push(newLine.lineKey);
      }
      setSelectedKeys((s) => {
        const next = new Set(s);
        newKeys.forEach(k => next.add(k));
        return next;
      });
      return currentLines;
    });
    resetPreview();
  }, [allLines.length, bulkAddCount, costs, globalDefaults, resetPreview, supplierCode, supplierName]);

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

        let extraFields = {};
        if (key === 'manufacturer' || key === 'mfgPartNumber') {
          const mfg = key === 'manufacturer' ? value : line.manufacturer;
          const pn = key === 'mfgPartNumber' ? value : line.mfgPartNumber;
          const cleanDesc = stripGeneratedLongDescSuffix([
            line.longDesc1 || '',
            line.longDesc2 || '',
            line.longDesc3 || '',
            line.longDesc4 || '',
          ].join(''));
          const composed = composeLongDescWithSuffix(cleanDesc, pn, mfg);
          const [chunk1, chunk2, chunk3, chunk4] = splitLongDescToChunks(composed);
          extraFields = {
            longDesc1: chunk1,
            longDesc2: chunk2,
            longDesc3: chunk3,
            longDesc4: chunk4,
          };
        }

        return {
          ...line,
          [key]: value,
          ...(key === 'uom' ? { stockUOM: value } : {}),
          ...extraFields,
        };
      }),
    );
    resetPreview();
  }, [locationLookups, resetPreview]);

  const updateLineLongDescription = useCallback((
    lineKey: string,
    value: string,
  ) => {
    setAllLines((prev) =>
      prev.map((line) => {
        if (line.lineKey !== lineKey) return line;
        const composed = composeLongDescWithSuffix(value, line.mfgPartNumber, line.manufacturer);
        const [chunk1, chunk2, chunk3, chunk4] = splitLongDescToChunks(composed);
        return {
          ...line,
          longDesc1: chunk1,
          longDesc2: chunk2,
          longDesc3: chunk3,
          longDesc4: chunk4,
        };
      }),
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

  const handleCWeightLookup = useCallback(async (line: AllocationLineSource) => {
    setCweightLoadingKey(line.lineKey);
    try {
      const result = await lookupCWeightPrefill(line, costs.shipModeNo ?? null);
      setCweightResults((prev) => ({ ...prev, [line.lineKey]: result }));
    } catch (err) {
      clientLogger.error('CWeight lookup failed', err);
      toast.error('ค้นหา CWeight ไม่สำเร็จ');
    } finally {
      setCweightLoadingKey(null);
    }
  }, [costs.shipModeNo]);

  const handleCWeightLookupAll = useCallback(async () => {
    if (allLines.length === 0) return;
    setCweightBatchLoading(true);
    try {
      const results = await lookupCWeightPrefillBatch(allLines, costs.shipModeNo ?? null);
      const map: Record<string, CWeightSuggestion | null> = {};
      for (const r of results) map[r.lineKey] = r;
      setCweightResults((prev) => ({ ...prev, ...map }));
      const all = results;
      const exact = all.filter((r) => r.source === 'local_exact_match').length;
      const semantic = all.filter((r) => r.decision === 'REVIEW_SUGGESTION').length;
      const notFound = all.filter((r) => r.decision === 'NOT_FOUND').length;
      setCweightBatchStats({ total: all.length, exact, semantic, notFound });
    } catch (err) {
      clientLogger.error('CWeight batch lookup failed', err);
      toast.error('ค้นหา CWeight ทั้งหมดไม่สำเร็จ');
    } finally {
      setCweightBatchLoading(false);
    }
  }, [allLines, costs.shipModeNo]);

  const applyCWeightSuggestion = useCallback((lineKey: string, suggestion: CWeightSuggestion) => {
    if (!suggestion.prefillAllowed || suggestion.chargeableWeightKg === null) return;
    setAllLines((prev) =>
      prev.map((line) => {
        if (line.lineKey !== lineKey) return line;
        return recalcLineDerivedValues({ ...line, shippingWeightPerEach: suggestion.chargeableWeightKg });
      }),
    );
    resetPreview();
    toast.success(`ใส่ Ship Wt/Ea ${suggestion.chargeableWeightKg} kg แล้ว`);
  }, [resetPreview]);

  const applyCWeightCandidate = useCallback((lineKey: string, candidate: CWeightCandidate) => {
    setAllLines((prev) =>
      prev.map((line) => {
        if (line.lineKey !== lineKey) return line;
        return recalcLineDerivedValues({ ...line, shippingWeightPerEach: candidate.chargeableWeightKg });
      }),
    );
    resetPreview();
    toast.success(`ใส่ Ship Wt/Ea ${candidate.chargeableWeightKg} kg แล้ว`);
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

  const handleSandboxFinalize = useCallback(async () => {
    if (!savedRunId) {
      toast.error('ต้องบันทึก Revision ก่อนจึงจะทดสอบการเขียนข้อมูลได้');
      return;
    }
    setIsSandboxFinalizing(true);
    setSandboxFinalizeConfirming(false);
    setSandboxFinalizeResult(null);
    try {
      const result = await sandboxFinalizeLines(savedRunId, costs.saleIncharge || 'unknown');
      setSandboxFinalizeResult(result);
      if (result.success) {
        toast.success(`ทดสอบการเขียนข้อมูลสำเร็จ: ${result.written.length} รายการ`);
      } else {
        toast.error(`ทดสอบการเขียนข้อมูลมีข้อผิดพลาด: ${result.errors?.length ?? 0} รายการ`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      toast.error(`ทดสอบการเขียนข้อมูลล้มเหลว: ${message}`);
    } finally {
      setIsSandboxFinalizing(false);
    }
  }, [costs.saleIncharge, savedRunId]);

  const canCalculate = selectedLines.length > 0 && !isLoadingRun;
  const canSaveDraft = preview !== null && preview.lines.length > 0 && !isCalculating && !isLoadingRun;
  const displayedLines = sourceView === 'origin' ? originLines : allLines;
  const isLatestView = sourceView === 'latest';
  const revisionStatusLabel = revisionGroupId !== null
    ? `Run #${revisionSourceRunId ?? revisionGroupId} / Revision Group #${revisionGroupId}${revisionNo ? ` / Rev ${revisionNo}` : ''}`
    : 'New manual run';
  const revisionHelpText = revisionGroupId !== null
    ? 'Editing and recalculating will save as the next revision. (แก้ไขและกดคำนวณเพื่อบันทึกเป็นเวอร์ชันถัดไป)'
    : 'Blank manual workspace. Add lines, run CAL, then save revision. (พื้นที่คำนวณเปล่า: เพิ่มรายการสินค้า, กด CAL เพื่อคำนวณ และบันทึกร่างข้อมูล)';
  const calculateTitle = canCalculate
    ? 'Calculate selected manual lines (คำนวณต้นทุนปันส่วนตามรายการที่เลือก)'
    : 'Add and select at least one line before CAL (กรุณาเพิ่มและเลือกอย่างน้อยหนึ่งรายการ)';
  const saveTitle = canSaveDraft
    ? 'Save draft to PartCatalog (บันทึกร่างข้อมูลในระบบ PartCatalog)'
    : 'Run CAL successfully before saving a revision (ต้องคำนวณปันส่วนสำเร็จก่อนจึงจะบันทึกร่างได้)';
  const saveButtonText = isSavingDraft
    ? 'Saving...'
    : savedRunId
      ? 'Save New Rev'
      : 'Save Draft';
  const pageEyebrow = isReviewFinalizeActive ? 'Review / Finalize' : 'Manual Cost Workspace';
  const pageTitle = isReviewFinalizeActive ? 'Review Item & Term Draft' : 'Manual Cost Workspace';

  const renderLineEditModal = () => {
    if (!editingLineKey) return null;
    const line = allLines.find(l => l.lineKey === editingLineKey);
    if (!line) return null;

    const currentLineIndex = allLines.findIndex(l => l.lineKey === editingLineKey);
    const prevLine = currentLineIndex > 0 ? allLines[currentLineIndex - 1] : null;
    const nextLine = currentLineIndex < allLines.length - 1 ? allLines[currentLineIndex + 1] : null;

    // Quick completeness check per tab
    const itemDataIssues = [
      !line.manufacturer,
      !line.mfgPartNumber,
      !line.sapDescription,
      !line.countryOfOrigin,
      !line.uom,
    ].filter(Boolean).length;
    const purchaseOrderPriceIssues = [line.unitPrice <= 0, line.qty <= 0, !line.currency].filter(Boolean).length;
    const importFreightCifIssues = [!line.orderTerm, !line.location, !line.subLocation].filter(Boolean).length;
    const uomSellingTermsIssues = [!line.purchaseUOM, !line.saleUOM].filter(Boolean).length;

    const tabs: { key: LineColumnPreset; label: string; issues: number }[] = [
      { key: 'item-data', label: 'Item Data', issues: itemDataIssues },
      { key: 'import-freight-cif', label: 'Purchase Term', issues: importFreightCifIssues },
      { key: 'purchase-order-price', label: 'Order Price', issues: purchaseOrderPriceIssues },
      { key: 'landed-sales-price', label: 'Landed Cost', issues: 0 },
      { key: 'uom-selling-terms', label: 'Sales Term', issues: uomSellingTermsIssues },
    ];
    const totalIssues = itemDataIssues + purchaseOrderPriceIssues + importFreightCifIssues + uomSellingTermsIssues;

    return (
      <div className="line-edit-modal-overlay" onClick={() => setEditingLineKey(null)}>
        <div className="line-edit-modal-content" onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div className="line-edit-modal-header">
            <div className="line-edit-modal-header-left">
              <div className="line-edit-modal-nav">
                <button
                  type="button"
                  className="line-edit-modal-nav-btn"
                  disabled={!prevLine}
                  onClick={() => prevLine && setEditingLineKey(prevLine.lineKey)}
                  title="Previous item"
                >
                  ‹
                </button>
                <span className="line-edit-modal-nav-count">{currentLineIndex + 1} / {allLines.length}</span>
                <button
                  type="button"
                  className="line-edit-modal-nav-btn"
                  disabled={!nextLine}
                  onClick={() => nextLine && setEditingLineKey(nextLine.lineKey)}
                  title="Next item"
                >
                  ›
                </button>
              </div>
              <div>
                <h3 style={{ margin: 0 }}>
                  <Edit3 size={16} />
                  #{line.no} — {line.mfgPartNumber || 'New Item'}
                </h3>
                {totalIssues > 0 && (
                  <div className="line-edit-modal-status-warn">
                    <AlertTriangle size={12} /> {totalIssues} required field{totalIssues > 1 ? 's' : ''} missing
                  </div>
                )}
                {totalIssues === 0 && (
                  <div className="line-edit-modal-status-ok">
                    <CheckCircle2 size={12} /> All required fields complete
                  </div>
                )}
              </div>
            </div>
            <button className="line-edit-modal-close" onClick={() => setEditingLineKey(null)}>
              &times;
            </button>
          </div>

          {/* Tabs */}
          <div className="line-edit-modal-tabs">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={`line-edit-modal-tab-btn ${editingModalTab === tab.key ? 'line-edit-modal-tab-btn--active' : ''}`}
                onClick={() => setEditingModalTab(tab.key)}
              >
                {tab.label}
                {tab.issues > 0 && (
                  <span className="line-edit-modal-tab-badge">{tab.issues}</span>
                )}
              </button>
            ))}
          </div>

          {/* Body */}
          <div className="line-edit-modal-body">
            {editingModalTab === 'item-data' && (
              <div className="line-edit-modal-grid">
                {/* 1. Item Group */}
                <div className="line-edit-modal-field">
                  <label>Item Group <span>*</span></label>
                  <select
                    className="line-edit-modal-input"
                    value={line.itemGroup}
                    onChange={(e) => updateLineTextField(line.lineKey, 'itemGroup', e.target.value)}
                  >
                    {itemGroupSelectOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                {/* 2. Brand / Manufacturer */}
                <ModalLookupInput
                  label="Mfr Brand *"
                  value={line.manufacturer}
                  options={brandSelectOptions}
                  onChange={(val) => updateLineTextField(line.lineKey, 'manufacturer', val)}
                />

                {/* 3. Catalog No */}
                <div className="line-edit-modal-field">
                  <label>Mfr Catalog No <span>*</span></label>
                  <input
                    type="text"
                    className="line-edit-modal-input"
                    value={line.mfgPartNumber}
                    onChange={(e) => updateLineTextField(line.lineKey, 'mfgPartNumber', e.target.value)}
                  />
                </div>

                {/* 4. Category */}
                <ModalLookupInput
                  label="Item Category"
                  value={line.itemCategory}
                  options={ensureLookupOption(itemCategorySelectOptions, line.itemCategory)}
                  onChange={(val) => updateLineTextField(line.lineKey, 'itemCategory', val)}
                />

                {/* 5. Cust Stock Code */}
                <div className="line-edit-modal-field">
                  <label>Cust Stock Code</label>
                  <input
                    type="text"
                    className="line-edit-modal-input"
                    value={line.customerStockCode}
                    onChange={(e) => updateLineTextField(line.lineKey, 'customerStockCode', e.target.value)}
                  />
                </div>

                {/* 6. Country of Origin */}
                <ModalLookupInput
                  label="Country of Origin *"
                  value={line.countryOfOrigin}
                  options={countrySelectOptions}
                  onChange={(val) => updateLineTextField(line.lineKey, 'countryOfOrigin', val)}
                />

                {/* Permit Required */}
                <div className="line-edit-modal-field">
                  <label>Permit Required</label>
                  <select
                    className="line-edit-modal-input"
                    value={line.importPermit || 'No'}
                    onChange={(e) => updateLineTextField(line.lineKey, 'importPermit', e.target.value)}
                  >
                    <option value="No">No</option>
                    <option value="Yes">Yes</option>
                  </select>
                </div>

                {/* Permit Type */}
                <ModalLookupInput
                  label="Permit Type"
                  value={line.permitType || ''}
                  options={ensureLookupOption(permitTypeSelectOptions, line.permitType || '')}
                  disabled={line.importPermit !== 'Yes'}
                  onChange={(val) => updateLineTextField(line.lineKey, 'permitType', val)}
                />

                {/* 7. Harmonized Code */}
                <div className="line-edit-modal-field">
                  <label>Harmonized Code</label>
                  <input
                    type="text"
                    className="line-edit-modal-input"
                    value={line.hsCode}
                    onChange={(e) => updateLineTextField(line.lineKey, 'hsCode', e.target.value)}
                  />
                </div>

                {/* 8. Stock UOM */}
                <div className="line-edit-modal-field">
                  <label>Stock UOM <span>*</span></label>
                  <select
                    className="line-edit-modal-input"
                    value={line.uom}
                    onChange={(e) => updateLineTextField(line.lineKey, 'uom', e.target.value)}
                  >
                    <option value="">-</option>
                    {uomLookups.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                {/* 9. Description */}
                <div className="line-edit-modal-field line-edit-modal-field--full">
                  <label>Item Description <span>*</span></label>
                  <textarea
                    rows={3}
                    className="line-edit-modal-input"
                    style={{ height: 'auto', padding: '8px 12px' }}
                    value={line.sapDescription}
                    onChange={(e) => updateLineTextField(line.lineKey, 'sapDescription', e.target.value)}
                  />
                </div>

                {/* Collapsible Toggle for Item Details */}
                <div className="line-edit-modal-field line-edit-modal-field--full border-t border-slate-100 pt-4 mt-2">
                  <button
                    type="button"
                    className="flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors uppercase tracking-wider focus:outline-none py-2 px-1 text-left w-full hover:bg-slate-50 rounded"
                    onClick={() => setIsItemDetailsExpanded(!isItemDetailsExpanded)}
                  >
                    <span>{isItemDetailsExpanded ? '▼' : '▶'} Additional Details / ข้อมูลทะเบียนสินค้าเพิ่มเติม</span>
                  </button>
                </div>

                {isItemDetailsExpanded && (
                  <>
                    {/* Check block (10 Checkboxes) */}
                    <div className="line-edit-modal-field line-edit-modal-field--full bg-slate-50 p-4 rounded-lg border border-slate-200/60 mb-2">
                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Status & Flags</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                        {/* Shelf Life Required */}
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id={`${line.lineKey}-shelfLifeRequire`}
                            className="w-4 h-4 rounded text-blue-600 border-gray-300 focus:ring-blue-500 cursor-pointer accent-[#2264A0]"
                            checked={line.shelfLifeRequire === 'Yes'}
                            onChange={(e) => updateLineTextField(line.lineKey, 'shelfLifeRequire', e.target.checked ? 'Yes' : 'No')}
                          />
                          <label htmlFor={`${line.lineKey}-shelfLifeRequire`} className="text-xs font-bold text-gray-700 select-none cursor-pointer" style={{ margin: 0 }}>
                            Shelf Life Required?
                          </label>
                        </div>

                        {/* SDS Required */}
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id={`${line.lineKey}-sdsRequired`}
                            className="w-4 h-4 rounded text-blue-600 border-gray-300 focus:ring-blue-500 cursor-pointer accent-[#2264A0]"
                            checked={line.sdsRequired === 'Yes'}
                            onChange={(e) => updateLineTextField(line.lineKey, 'sdsRequired', e.target.checked ? 'Yes' : 'No')}
                          />
                          <label htmlFor={`${line.lineKey}-sdsRequired`} className="text-xs font-bold text-gray-700 select-none cursor-pointer" style={{ margin: 0 }}>
                            SDS Required?
                          </label>
                        </div>

                        {/* Is Supplier Agreement */}
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id={`${line.lineKey}-vmi`}
                            className="w-4 h-4 rounded text-blue-600 border-gray-300 focus:ring-blue-500 cursor-pointer accent-[#2264A0]"
                            checked={line.vmi === 'Yes'}
                            onChange={(e) => updateLineTextField(line.lineKey, 'vmi', e.target.checked ? 'Yes' : 'No')}
                          />
                          <label htmlFor={`${line.lineKey}-vmi`} className="text-xs font-bold text-gray-700 select-none cursor-pointer" style={{ margin: 0 }}>
                            Is Supplier Agreement?
                          </label>
                        </div>

                        {/* Certificate Required */}
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id={`${line.lineKey}-certificateRequired`}
                            className="w-4 h-4 rounded text-blue-600 border-gray-300 focus:ring-blue-500 cursor-pointer accent-[#2264A0]"
                            checked={line.certificateRequired === 'Yes'}
                            onChange={(e) => updateLineTextField(line.lineKey, 'certificateRequired', e.target.checked ? 'Yes' : 'No')}
                          />
                          <label htmlFor={`${line.lineKey}-certificateRequired`} className="text-xs font-bold text-gray-700 select-none cursor-pointer" style={{ margin: 0 }}>
                            Certificate Required?
                          </label>
                        </div>

                        {/* Is Cusomter BPA */}
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id={`${line.lineKey}-customerBpa`}
                            className="w-4 h-4 rounded text-blue-600 border-gray-300 focus:ring-blue-500 cursor-pointer accent-[#2264A0]"
                            checked={line.customerBpa === 'Yes'}
                            onChange={(e) => updateLineTextField(line.lineKey, 'customerBpa', e.target.checked ? 'Yes' : 'No')}
                          />
                          <label htmlFor={`${line.lineKey}-customerBpa`} className="text-xs font-bold text-gray-700 select-none cursor-pointer" style={{ margin: 0 }}>
                            Is Customer BPA?
                          </label>
                        </div>

                        {/* Is e-Commerce Item */}
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id={`${line.lineKey}-eCommerce`}
                            className="w-4 h-4 rounded text-blue-600 border-gray-300 focus:ring-blue-500 cursor-pointer accent-[#2264A0]"
                            checked={line.eCommerce === 'Yes'}
                            onChange={(e) => updateLineTextField(line.lineKey, 'eCommerce', e.target.checked ? 'Yes' : 'No')}
                          />
                          <label htmlFor={`${line.lineKey}-eCommerce`} className="text-xs font-bold text-gray-700 select-none cursor-pointer" style={{ margin: 0 }}>
                            Is e-Commerce Item?
                          </label>
                        </div>

                        {/* Is QTEC Stock */}
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id={`${line.lineKey}-qtecStock`}
                            className="w-4 h-4 rounded text-blue-600 border-gray-300 focus:ring-blue-500 cursor-pointer accent-[#2264A0]"
                            checked={line.qtecStock === 'Yes'}
                            onChange={(e) => updateLineTextField(line.lineKey, 'qtecStock', e.target.checked ? 'Yes' : 'No')}
                          />
                          <label htmlFor={`${line.lineKey}-qtecStock`} className="text-xs font-bold text-gray-700 select-none cursor-pointer" style={{ margin: 0 }}>
                            Is QTEC Stock?
                          </label>
                        </div>

                        {/* Is B1 Item Master */}
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id={`${line.lineKey}-b1Item`}
                            className="w-4 h-4 rounded text-blue-600 border-gray-300 focus:ring-blue-500 cursor-pointer accent-[#2264A0]"
                            checked={line.b1Item === 'Yes'}
                            onChange={(e) => updateLineTextField(line.lineKey, 'b1Item', e.target.checked ? 'Yes' : 'No')}
                          />
                          <label htmlFor={`${line.lineKey}-b1Item`} className="text-xs font-bold text-gray-700 select-none cursor-pointer" style={{ margin: 0 }}>
                            Is B1 Item Master?
                          </label>
                        </div>

                        {/* Serial Required */}
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id={`${line.lineKey}-serialRequired`}
                            className="w-4 h-4 rounded text-blue-600 border-gray-300 focus:ring-blue-500 cursor-pointer accent-[#2264A0]"
                            checked={line.serialRequired === 'Yes'}
                            onChange={(e) => updateLineTextField(line.lineKey, 'serialRequired', e.target.checked ? 'Yes' : 'No')}
                          />
                          <label htmlFor={`${line.lineKey}-serialRequired`} className="text-xs font-bold text-gray-700 select-none cursor-pointer" style={{ margin: 0 }}>
                            Serial Required?
                          </label>
                        </div>

                        {/* Is DG Item */}
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id={`${line.lineKey}-dgRequired`}
                            className="w-4 h-4 rounded text-blue-600 border-gray-300 focus:ring-blue-500 cursor-pointer accent-[#2264A0]"
                            checked={line.dgRequired === 'Yes'}
                            onChange={(e) => updateLineTextField(line.lineKey, 'dgRequired', e.target.checked ? 'Yes' : 'No')}
                          />
                          <label htmlFor={`${line.lineKey}-dgRequired`} className="text-xs font-bold text-gray-700 select-none cursor-pointer" style={{ margin: 0 }}>
                            Is DG Item?
                          </label>
                        </div>
                      </div>
                    </div>

                    {/* Long Description */}
                    <div className="line-edit-modal-field line-edit-modal-field--full">
                      <label>Long Description</label>
                      <textarea
                        rows={5}
                        className="line-edit-modal-input"
                        style={{ height: 'auto', padding: '8px 12px' }}
                        value={stripGeneratedLongDescSuffix([
                          line.longDesc1 || '',
                          line.longDesc2 || '',
                          line.longDesc3 || '',
                          line.longDesc4 || '',
                        ].join(''))}
                        onChange={(e) => updateLineLongDescription(line.lineKey, e.target.value)}
                        maxLength={Math.max(0, 1016 - (buildLongDescFooter(line.mfgPartNumber, line.manufacturer).length + 2))}
                        placeholder="Type the full long description here..."
                      />
                      <div className="mt-2 rounded border border-dashed border-gray-300 bg-gray-50 p-2 w-full">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Auto-appended (Locked)</p>
                        <pre className="mt-1 whitespace-pre-wrap text-[11px] text-gray-700 font-mono leading-tight">
                          {buildLongDescFooter(line.mfgPartNumber, line.manufacturer)}
                        </pre>
                      </div>
                    </div>

                    {/* ECCN */}
                    <div className="line-edit-modal-field">
                      <label>ECCN</label>
                      <input
                        type="text"
                        className="line-edit-modal-input"
                        value={line.eccn || ''}
                        onChange={(e) => updateLineTextField(line.lineKey, 'eccn', e.target.value)}
                      />
                    </div>

                    {/* UNSPSC */}
                    <div className="line-edit-modal-field">
                      <label>UNSPSC</label>
                      <input
                        type="text"
                        className="line-edit-modal-input"
                        value={line.unspsc || ''}
                        onChange={(e) => updateLineTextField(line.lineKey, 'unspsc', e.target.value)}
                      />
                    </div>

                    {/* e-Procurement Code */}
                    <div className="line-edit-modal-field">
                      <label>e-Procurement Code</label>
                      <input
                        type="text"
                        className="line-edit-modal-input"
                        value={line.eProcurementCode || ''}
                        onChange={(e) => updateLineTextField(line.lineKey, 'eProcurementCode', e.target.value)}
                      />
                    </div>

                    {/* Reference URL */}
                    <div className="line-edit-modal-field">
                      <label>Reference URL</label>
                      <input
                        type="text"
                        className="line-edit-modal-input"
                        value={line.referenceUrl || ''}
                        placeholder="https://..."
                        onChange={(e) => updateLineTextField(line.lineKey, 'referenceUrl', e.target.value)}
                      />
                    </div>

                    {/* Special Requirement */}
                    <div className="line-edit-modal-field line-edit-modal-field--full">
                      <label>Special Requirement</label>
                      <textarea
                        rows={2}
                        className="line-edit-modal-input"
                        style={{ height: 'auto', padding: '8px 12px' }}
                        value={line.specialRequirement || ''}
                        onChange={(e) => updateLineTextField(line.lineKey, 'specialRequirement', e.target.value)}
                        maxLength={254}
                        placeholder="Enter special requirement here..."
                      />
                    </div>

                    {/* REMARK */}
                    <div className="line-edit-modal-field line-edit-modal-field--full">
                      <label>REMARK</label>
                      <textarea
                        rows={2}
                        className="line-edit-modal-input"
                        style={{ height: 'auto', padding: '8px 12px' }}
                        value={line.remark || ''}
                        onChange={(e) => updateLineTextField(line.lineKey, 'remark', e.target.value)}
                        maxLength={254}
                        placeholder="Enter item remark here..."
                      />
                    </div>

                    {/* General Spec */}
                    <div className="line-edit-modal-field line-edit-modal-field--full">
                      <label>General Spec</label>
                      <textarea
                        rows={2}
                        className="line-edit-modal-input"
                        style={{ height: 'auto', padding: '8px 12px' }}
                        value={line.generalSpec || ''}
                        onChange={(e) => updateLineTextField(line.lineKey, 'generalSpec', e.target.value)}
                      />
                    </div>
                  </>
                )}
              </div>
            )}

            {editingModalTab === 'purchase-order-price' && (
              <div className="line-edit-modal-grid">
                {/* 1. Unit Price */}
                <div className="line-edit-modal-field">
                  <label>Unit Price (PCS/Ea) <span>*</span></label>
                  <FormattedNumberInput
                    className="line-edit-modal-input"
                    value={line.unitPrice}
                    onChange={(e) => updateLineNumberField(line.lineKey, 'unitPrice', e.target.value)}
                  />
                </div>

                {/* 2. Qty */}
                <div className="line-edit-modal-field">
                  <label>Qty <span>*</span></label>
                  <FormattedNumberInput
                    className="line-edit-modal-input"
                    value={line.qty}
                    onChange={(e) => updateLineNumberField(line.lineKey, 'qty', e.target.value)}
                  />
                </div>

                {/* 3. Amount */}
                <div className="line-edit-modal-field">
                  <label>Amount (Qty &times; Unit Price)</label>
                  <input
                    type="text"
                    className="line-edit-modal-input bg-slate-100 text-slate-500 cursor-not-allowed"
                    disabled
                    value={fmt(line.amount)}
                  />
                </div>

                {/* 4. Currency & Ex. Rate combo */}
                <div className="line-edit-modal-field">
                  <label>Currency & Ex. Rate <span>*</span></label>
                  <div className="flex gap-2">
                    <select
                      className="line-edit-modal-input flex-1 min-w-0"
                      value={line.currency}
                      onChange={(e) => updateLineTextField(line.lineKey, 'currency', e.target.value)}
                    >
                      <option value="">-</option>
                      {currencySelectOptions.map((opt) => (
                        <option key={opt.code} value={opt.code}>{currencyOptionLabel(opt)}</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      className="line-edit-modal-input w-28 shrink-0 bg-slate-100 text-slate-500 cursor-not-allowed"
                      disabled
                      value={costs.exchangeRate ? `${fmt(costs.exchangeRate)} THB` : '—'}
                    />
                  </div>
                </div>

                {/* Document Fees Toggle */}
                <div className="line-edit-modal-field line-edit-modal-field--full border-t border-slate-100 pt-4 mt-2">
                  <button
                    type="button"
                    className="flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors uppercase tracking-wider focus:outline-none py-2 px-1 text-left w-full hover:bg-slate-50 rounded"
                    onClick={() => setIsDocFeesExpanded(!isDocFeesExpanded)}
                  >
                    <span>{isDocFeesExpanded ? '▼' : '▶'} Document Fees / ค่าใช้จ่ายเอกสารเพิ่มเติม</span>
                  </button>
                </div>

                {isDocFeesExpanded && (
                  <div className="line-edit-modal-field line-edit-modal-field--full bg-slate-50 p-4 rounded-lg border border-slate-200/60 mb-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                      {DOC_FEE_FIELDS.map((field) => {
                        const feeVal = line.docFee[field.key];
                        return (
                          <div key={field.key} className="flex flex-col gap-1">
                            <label className="text-xs font-bold text-slate-600">
                              {field.label} Fee ({line.currency || 'USD'})
                            </label>
                            <input
                              type="text"
                              className="line-edit-modal-input w-full"
                              value={toEditableNumber(feeVal)}
                              onChange={(e) => updateLineDocFee(line.lineKey, field.key, e.target.value)}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 5. PKH ที่กระจายแล้ว */}
                <div className="line-edit-modal-field">
                  <label>Packing Handling (PKH) [Allocated]</label>
                  <input
                    type="text"
                    className="line-edit-modal-input bg-slate-100 text-slate-500 cursor-not-allowed"
                    disabled
                    value={(() => {
                      const calcResult = preview?.lines.find((r) => r.lineKey === line.lineKey);
                      if (calcResult) return `${fmt(calcResult.pkhPerEach)} ${line.currency || 'USD'}`;

                      // Live calculation
                      const isSelected = selectedKeys.has(line.lineKey);
                      if (!isSelected) return '—';
                      const weight = resolveLineWeight(line) ?? 0;
                      const lineWeight = weight * line.qty;
                      const weightRatio = totalWeight > 0 ? lineWeight / totalWeight : 0;
                      const safeQty = line.qty > 0 ? line.qty : 1;
                      const livePkhEach = (costs.pkh * weightRatio) / safeQty;
                      return `${fmt(livePkhEach)} ${line.currency || 'USD'}`;
                    })()}
                  />
                </div>

                {/* 6. SOC ที่กระจายแล้ว */}
                <div className="line-edit-modal-field">
                  <label>Supplier Outb Cost (SOC) [Allocated]</label>
                  <input
                    type="text"
                    className="line-edit-modal-input bg-slate-100 text-slate-500 cursor-not-allowed"
                    disabled
                    value={(() => {
                      const calcResult = preview?.lines.find((r) => r.lineKey === line.lineKey);
                      if (calcResult) return `${fmt(calcResult.socPerEach)} ${line.currency || 'USD'}`;

                      // Live calculation
                      const isSelected = selectedKeys.has(line.lineKey);
                      if (!isSelected) return '—';
                      const weight = resolveLineWeight(line) ?? 0;
                      const lineWeight = weight * line.qty;
                      const weightRatio = totalWeight > 0 ? lineWeight / totalWeight : 0;
                      const safeQty = line.qty > 0 ? line.qty : 1;
                      const liveSocEach = (costs.soc * weightRatio) / safeQty;
                      return `${fmt(liveSocEach)} ${line.currency || 'USD'}`;
                    })()}
                  />
                </div>

                {/* 7. Document Fee */}
                <div className="line-edit-modal-field">
                  <label>Document Fee ({line.currency || 'USD'})</label>
                  <input
                    type="text"
                    className="line-edit-modal-input bg-slate-100 text-slate-500 cursor-not-allowed"
                    disabled
                    value={(() => {
                      const total = Object.values(line.docFee).reduce((sum, val) => sum + (val || 0), 0);
                      return total > 0 ? `${fmt(total)} ${line.currency || 'USD'}` : `0 ${line.currency || 'USD'}`;
                    })()}
                  />
                </div>

                {/* 8. Order Price (OP1) (PCS) */}
                <div className="line-edit-modal-field">
                  <label>Order Price (OP1) (PCS)</label>
                  <input
                    type="text"
                    className="line-edit-modal-input bg-slate-100 text-slate-500 cursor-not-allowed"
                    disabled
                    value={(() => {
                      const calcResult = preview?.lines.find((r) => r.lineKey === line.lineKey);

                      let pkhEach = 0;
                      let socEach = 0;
                      if (calcResult) {
                        pkhEach = calcResult.pkhPerEach;
                        socEach = calcResult.socPerEach;
                      } else {
                        const isSelected = selectedKeys.has(line.lineKey);
                        if (isSelected) {
                          const weight = resolveLineWeight(line) ?? 0;
                          const lineWeight = weight * line.qty;
                          const weightRatio = totalWeight > 0 ? lineWeight / totalWeight : 0;
                          const safeQty = line.qty > 0 ? line.qty : 1;
                          pkhEach = (costs.pkh * weightRatio) / safeQty;
                          socEach = (costs.soc * weightRatio) / safeQty;
                        }
                      }

                      const docFeeTotal = Object.values(line.docFee).reduce((sum, val) => sum + (val || 0), 0);
                      const productCost = line.unitPrice || 0;
                      const liveOp1Source = productCost + pkhEach + socEach + docFeeTotal;
                      return `${fmt(liveOp1Source)} ${line.currency || 'USD'}`;
                    })()}
                  />
                </div>

                {/* 9. Order Price (OP1) (THB) */}
                <div className="line-edit-modal-field">
                  <label>Order Price (OP1) (THB)</label>
                  <input
                    type="text"
                    className="line-edit-modal-input bg-blue-50 text-blue-700 font-bold border-blue-200 cursor-not-allowed"
                    disabled
                    value={(() => {
                      const calcResult = preview?.lines.find((r) => r.lineKey === line.lineKey);

                      let pkhEach = 0;
                      let socEach = 0;
                      if (calcResult) {
                        pkhEach = calcResult.pkhPerEach;
                        socEach = calcResult.socPerEach;
                      } else {
                        const isSelected = selectedKeys.has(line.lineKey);
                        if (isSelected) {
                          const weight = resolveLineWeight(line) ?? 0;
                          const lineWeight = weight * line.qty;
                          const weightRatio = totalWeight > 0 ? lineWeight / totalWeight : 0;
                          const safeQty = line.qty > 0 ? line.qty : 1;
                          pkhEach = (costs.pkh * weightRatio) / safeQty;
                          socEach = (costs.soc * weightRatio) / safeQty;
                        }
                      }

                      const docFeeTotal = Object.values(line.docFee).reduce((sum, val) => sum + (val || 0), 0);
                      const productCost = line.unitPrice || 0;
                      const liveOp1Source = productCost + pkhEach + socEach + docFeeTotal;
                      const liveOp1 = liveOp1Source * (costs.exchangeRate || 1);
                      return `${fmt(liveOp1)} THB`;
                    })()}
                  />
                </div>

                {/* 10. Order Price (OP2) (THB) */}
                <div className="line-edit-modal-field">
                  <label>Order Price (OP2) (THB)</label>
                  <input
                    type="text"
                    className="line-edit-modal-input bg-blue-50 text-blue-700 font-bold border-blue-200 cursor-not-allowed"
                    disabled
                    value={(() => {
                      const calcResult = preview?.lines.find((r) => r.lineKey === line.lineKey);

                      let pkhEach = 0;
                      let socEach = 0;
                      if (calcResult) {
                        pkhEach = calcResult.pkhPerEach;
                        socEach = calcResult.socPerEach;
                      } else {
                        const isSelected = selectedKeys.has(line.lineKey);
                        if (isSelected) {
                          const weight = resolveLineWeight(line) ?? 0;
                          const lineWeight = weight * line.qty;
                          const weightRatio = totalWeight > 0 ? lineWeight / totalWeight : 0;
                          const safeQty = line.qty > 0 ? line.qty : 1;
                          pkhEach = (costs.pkh * weightRatio) / safeQty;
                          socEach = (costs.soc * weightRatio) / safeQty;
                        }
                      }

                      const docFeeTotal = Object.values(line.docFee).reduce((sum, val) => sum + (val || 0), 0);
                      const productCost = line.unitPrice || 0;
                      const liveOp1Source = productCost + pkhEach + socEach + docFeeTotal;
                      const liveOp1 = liveOp1Source * (costs.exchangeRate || 1);
                      const orderTerm = line.orderTerm || costs.orderTerm;
                      const shipModeNo = line.shipModeNo || costs.shipModeNo;
                      const isExworkTerm = orderTerm === 'Exwork' || orderTerm === 'Ex-work';
                      const isFOBType = isExworkTerm || ['FCA', 'FAS', 'FOB'].includes(orderTerm);
                      const exworkCase = (isFOBType && (shipModeNo === 3 || shipModeNo === 6)) ? 1.03 : 1;
                      const liveOp2 = liveOp1 * exworkCase;
                      return `${fmt(liveOp2)} THB`;
                    })()}
                  />
                </div>
              </div>
            )}

            {editingModalTab === 'import-freight-cif' && (
              <div className="line-edit-modal-grid">
                {/* 1. Purchase Term */}
                <div className="line-edit-modal-field">
                  <label>Purchase Term <span>*</span></label>
                  <select
                    className="line-edit-modal-input"
                    value={line.orderTerm}
                    onChange={(e) => updateLineTextField(line.lineKey, 'orderTerm', e.target.value)}
                  >
                    {orderTermSelectOptions.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>

                {/* 2. Valid From & Valid To */}
                <div className="line-edit-modal-field">
                  <label>Valid From &amp; Valid To</label>
                  <div className="flex gap-2 items-center">
                    <div className="flex-1 min-w-0">
                      <DatePicker
                        value={line.validFrom}
                        onChange={(date) => {
                          updateLineTextField(line.lineKey, 'validFrom', date);
                          if (!line.validTo && date) {
                            const from = new Date(date);
                            if (!isNaN(from.getTime())) {
                              from.setMonth(from.getMonth() + 1);
                              const yyyy = from.getFullYear();
                              const mm = String(from.getMonth() + 1).padStart(2, '0');
                              const dd = String(from.getDate()).padStart(2, '0');
                              updateLineTextField(line.lineKey, 'validTo', `${yyyy}-${mm}-${dd}`);
                            }
                          }
                        }}
                        placeholder="Valid From"
                      />
                    </div>
                    <span className="text-xs text-gray-400 shrink-0">—</span>
                    <div className="flex-1 min-w-0">
                      <DatePicker
                        value={line.validTo}
                        onChange={(date) => updateLineTextField(line.lineKey, 'validTo', date)}
                        placeholder="Valid To"
                      />
                    </div>
                  </div>
                </div>

                {/* 3. Term Location & Zone Rate */}
                <div className="line-edit-modal-field">
                  <label>Term Location &amp; Zone Rate <span>*</span></label>
                  <div className="flex gap-2">
                    <select
                      className="line-edit-modal-input flex-1 min-w-0"
                      value={line.location}
                      onChange={(e) => updateLineTextField(line.lineKey, 'location', e.target.value)}
                    >
                      <option value="">Select Location</option>
                      {locationSelectOptions.map((opt) => (
                        <option key={opt.code} value={opt.code}>{locationOptionLabel(opt)}</option>
                      ))}
                    </select>
                    <FormattedNumberInput
                      className="line-edit-modal-input w-24 shrink-0"
                      placeholder="Zone Rate"
                      value={line.zoneRate}
                      onChange={(e) => updateLineNumberField(line.lineKey, 'zoneRate', e.target.value)}
                    />
                  </div>
                </div>

                {/* 4. Sub Location */}
                <div className="line-edit-modal-field">
                  <label>Sub Location <span>*</span></label>
                  <select
                    className="line-edit-modal-input"
                    value={line.subLocation}
                    onChange={(e) => updateLineTextField(line.lineKey, 'subLocation', e.target.value)}
                  >
                    <option value="">Select Sub Location</option>
                    {getLineSubLocationOptions(line).map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>

                {/* 5. Supp Order Code */}
                <div className="line-edit-modal-field">
                  <label>Supp Order Code</label>
                  <input
                    type="text"
                    className="line-edit-modal-input"
                    value={line.supplierOrderCode || ''}
                    onChange={(e) => updateLineTextField(line.lineKey, 'supplierOrderCode', e.target.value)}
                  />
                </div>

                {/* 6. Ship Mode */}
                <div className="line-edit-modal-field">
                  <label>Ship Mode <span>*</span></label>
                  <select
                    className="line-edit-modal-input"
                    value={line.shipModeNo}
                    onChange={(e) => updateLineNumberField(line.lineKey, 'shipModeNo', e.target.value)}
                  >
                    {shipModeSelectOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                {/* 7. L/T (Days) & MOQ/MOV */}
                <div className="line-edit-modal-field">
                  <label>L/T (Days) &amp; MOQ/MOV</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      className="line-edit-modal-input flex-1 min-w-0"
                      placeholder="L/T (Days)"
                      value={line.deliveryLeadTime || ''}
                      onChange={(e) => updateLineTextField(line.lineKey, 'deliveryLeadTime', e.target.value)}
                    />
                    <input
                      type="text"
                      className="line-edit-modal-input w-28 shrink-0"
                      placeholder="MOQ/MOV"
                      value={line.moq || ''}
                      onChange={(e) => updateLineTextField(line.lineKey, 'moq', e.target.value)}
                    />
                  </div>
                </div>

                {/* Spacer to align grid cells perfectly */}
                <div></div>

                {/* Dimensions header */}
                <div className="line-edit-modal-field line-edit-modal-field--full border-t border-slate-100 pt-4 mt-2">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Dimensions & Weight</h4>
                </div>

                {/* Length */}
                <div className="line-edit-modal-field">
                  <label>Length</label>
                  <FormattedNumberInput
                    className="line-edit-modal-input"
                    value={line.length}
                    onChange={(e) => updateLineNumberField(line.lineKey, 'length', e.target.value)}
                  />
                </div>

                {/* Width */}
                <div className="line-edit-modal-field">
                  <label>Width</label>
                  <FormattedNumberInput
                    className="line-edit-modal-input"
                    value={line.width}
                    onChange={(e) => updateLineNumberField(line.lineKey, 'width', e.target.value)}
                  />
                </div>

                {/* Height */}
                <div className="line-edit-modal-field">
                  <label>Height</label>
                  <FormattedNumberInput
                    className="line-edit-modal-input"
                    value={line.height}
                    onChange={(e) => updateLineNumberField(line.lineKey, 'height', e.target.value)}
                  />
                </div>

                {/* Dim Unit */}
                <div className="line-edit-modal-field">
                  <label>Dim Unit</label>
                  <select
                    className="line-edit-modal-input"
                    value={line.dimUnit}
                    onChange={(e) => updateLineNumberField(line.lineKey, 'dimUnit', e.target.value)}
                  >
                    <option value={1}>CM</option>
                    <option value={2}>INCH</option>
                  </select>
                </div>

                {/* Dim Wt/Ea (kg) [Calculated] */}
                <div className="line-edit-modal-field">
                  <label>Dim Wt/Ea (kg) [Calculated]</label>
                  <input
                    type="text"
                    className="line-edit-modal-input"
                    disabled
                    value={line.dimensionWeightPerEach !== null ? fmtWeight(line.dimensionWeightPerEach) : '—'}
                  />
                </div>

                {/* Item Wt/Ea (kg) */}
                <div className="line-edit-modal-field">
                  <label>Item Wt/Ea (kg)</label>
                  <FormattedNumberInput
                    className="line-edit-modal-input"
                    nullable
                    value={line.itemWeightPerEach}
                    onChange={(e) => updateLineNullableNumberField(line.lineKey, 'itemWeightPerEach', e.target.value)}
                  />
                </div>

                {/* Chargeable Wt/Ea (kg) */}
                <div className="line-edit-modal-field">
                  <label>Chargeable Wt/Ea (kg)</label>
                  <FormattedNumberInput
                    className="line-edit-modal-input"
                    nullable
                    value={line.shippingWeightPerEach}
                    onChange={(e) => updateLineNullableNumberField(line.lineKey, 'shippingWeightPerEach', e.target.value)}
                  />
                </div>

                {/* Ship Wt/Ea (kg) [Calculated] */}
                <div className="line-edit-modal-field">
                  <label>Ship Wt/Ea (kg) [Calculated]</label>
                  <input
                    type="text"
                    className="line-edit-modal-input"
                    disabled
                    value={(() => {
                      const dw = line.dimensionWeightPerEach ?? 0;
                      const iw = line.itemWeightPerEach ?? 0;
                      const cw = line.shippingWeightPerEach ?? 0;
                      const maxVal = Math.max(dw, iw, cw);
                      return maxVal > 0 ? fmt(ceilToHalf(maxVal)) : '—';
                    })()}
                  />
                </div>

                {/* CWeight Lookup */}
                <div className="line-edit-modal-field line-edit-modal-field--full">
                  {(() => {
                    const isLoading = cweightLoadingKey === line.lineKey;
                    const cw = cweightResults[line.lineKey];
                    const decisionColor =
                      cw?.decision === 'AUTO_ACCEPT' ? 'bg-emerald-100 text-emerald-800' :
                      cw?.decision === 'REVIEW_SUGGESTION' ? 'bg-amber-100 text-amber-800' :
                      cw?.decision === 'NOT_FOUND' ? 'bg-slate-100 text-slate-500' : '';
                    return (
                      <div className="flex flex-col gap-2">
                        <button
                          type="button"
                          disabled={isLoading}
                          className="flex items-center gap-1.5 self-start px-3 py-1.5 text-xs font-medium rounded border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                          onClick={() => handleCWeightLookup(line)}
                        >
                          {isLoading
                            ? <Loader2 className="w-3 h-3 animate-spin" />
                            : <Search className="w-3 h-3" />}
                          {isLoading ? 'กำลังค้นหา...' : 'ค้นหา CWeight'}
                        </button>
                        {cw && (
                          <div className="rounded border border-slate-200 bg-slate-50 p-2 text-xs flex flex-col gap-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`px-1.5 py-0.5 rounded text-[11px] font-semibold ${decisionColor}`}>
                                {formatCWeightDecisionLabel(cw.decision)}
                              </span>
                              {cw.chargeableWeightKg !== null && (
                                <span className="font-mono font-bold text-slate-700">{cw.chargeableWeightKg} kg</span>
                              )}
                              <span className="text-slate-400">{Math.round(cw.confidence * 100)}%</span>
                              {cw.matchedGraingerNo && (
                                <span className="text-slate-500">GG: <span className="font-mono text-slate-700">{cw.matchedGraingerNo}</span></span>
                              )}
                              {cw.matchedMfgPartNo && (
                                <span className="text-slate-500">MFG: <span className="font-mono text-slate-700">{cw.matchedMfgPartNo}</span></span>
                              )}
                              {cw.matchedBrand && (
                                <span className="text-slate-500">Brand: <span className="text-slate-700">{cw.matchedBrand}</span></span>
                              )}
                            </div>
                            <p className="text-slate-500 leading-snug">{cw.reason}</p>
                            {cw.evidence && (() => {
                              const [desc, url] = cw.evidence.split(' | ');
                              return (
                                <p className="text-slate-400 leading-snug text-[11px]">
                                  {desc}
                                  {url && (
                                    <> · <a href={url} target="_blank" rel="noreferrer" className="underline hover:text-slate-600">{url}</a></>
                                  )}
                                </p>
                              );
                            })()}
                            {cw.candidates && cw.candidates.length > 1 && (
                              <div className="mt-1 flex flex-col gap-1">
                                <p className="text-[11px] text-slate-500 font-medium">พบหลายรายการใกล้เคียง เลือกน้ำหนักที่ถูกต้อง:</p>
                                {cw.candidates.map((c, i) => (
                                  <button
                                    key={i}
                                    type="button"
                                    className="text-left px-2 py-1 text-[11px] rounded border border-slate-200 hover:bg-slate-100 flex items-center gap-2"
                                    onClick={() => applyCWeightCandidate(line.lineKey, c)}
                                  >
                                    <span className="font-mono font-bold text-slate-700">{c.chargeableWeightKg} kg</span>
                                    {c.matchedGraingerNo && <span className="text-slate-500">GG: {c.matchedGraingerNo}</span>}
                                    {c.matchedBrand && <span className="text-slate-500">{c.matchedBrand}</span>}
                                    {c.evidence && <span className="text-slate-400 truncate">{c.evidence.split(' | ')[0]}</span>}
                                  </button>
                                ))}
                              </div>
                            )}
                            {cw.prefillAllowed && cw.chargeableWeightKg !== null && (
                              <button
                                type="button"
                                className="self-start mt-0.5 px-2 py-1 text-[11px] font-semibold rounded bg-emerald-600 text-white hover:bg-emerald-700"
                                onClick={() => applyCWeightSuggestion(line.lineKey, cw)}
                              >
                                ใช้ {cw.chargeableWeightKg} kg เป็น Ship Wt/Ea
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {/* Freight/Courier Rate */}
                <div className="line-edit-modal-field">
                  <label>Freight/Courier Rate</label>
                  <div className="flex gap-2">
                    <select
                      className="line-edit-modal-input flex-1 min-w-0"
                      value={line.freightType || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        const matched = freightTypeLookups.find((opt) => opt.code === val);
                        updateLineTextField(line.lineKey, 'freightType', val);
                        updateLineNullableNumberField(line.lineKey, 'freightRate', matched ? String(matched.rate) : '0');
                      }}
                    >
                      <option value="">- Please Select -</option>
                      {(() => {
                        const base = freightTypeLookups
                          .map((opt) => ({ value: opt.code, name: opt.name, rate: opt.rate }))
                          .sort((a, b) => a.name.localeCompare(b.name));
                        if (line.freightType) {
                          const exists = base.some((opt) => opt.value === line.freightType);
                          if (!exists) {
                            base.unshift({
                              value: line.freightType,
                              name: line.freightType,
                              rate: Number(line.freightRate || 0),
                            });
                          }
                        }
                        return base.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.name} {opt.rate > 0 ? `(${opt.rate})` : ''}
                          </option>
                        ));
                      })()}
                    </select>
                    <FormattedNumberInput
                      className="line-edit-modal-input w-24 shrink-0 bg-slate-100 text-slate-500 cursor-not-allowed"
                      nullable
                      disabled
                      value={line.freightRate}
                      onChange={(e) => updateLineNullableNumberField(line.lineKey, 'freightRate', e.target.value)}
                    />
                  </div>
                </div>

                {/* Freight to QTEC WH [Calculated] */}
                <div className="line-edit-modal-field">
                  <label>Freight to QTEC WH [Calculated]</label>
                  <input
                    type="text"
                    className="line-edit-modal-input bg-slate-100 text-slate-500 cursor-not-allowed"
                    disabled
                    value={(() => {
                      const dw = line.dimensionWeightPerEach ?? 0;
                      const iw = line.itemWeightPerEach ?? 0;
                      const cw = line.shippingWeightPerEach !== null
                        ? line.shippingWeightPerEach
                        : ceilToHalf(Math.max(dw, iw));
                      const rate = line.freightRate ?? 0;
                      const result = cw * rate;
                      return result > 0 ? fmt(result) : '0';
                    })()}
                  />
                </div>
              </div>
            )}

            {editingModalTab === 'landed-sales-price' && (
              <div className="line-edit-modal-grid">
                {/* หมวด: Landed Cost Factors / อัตราหลักและประกันภัย */}
                <div className="line-edit-modal-field line-edit-modal-field--full border-b border-slate-100 pb-2 mb-1">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Landed Cost Factors / ประกันภัยและพิกัดภาษี</h4>
                </div>

                {/* 1. Insurance (INS %) */}
                <div className="line-edit-modal-field">
                  <label>Insurance (INS %)</label>
                  <FormattedNumberInput
                    className="line-edit-modal-input"
                    value={line.insPercent}
                    onChange={(e) => updateLineNumberField(line.lineKey, 'insPercent', e.target.value)}
                  />
                </div>

                {/* 2. Duty % */}
                <div className="line-edit-modal-field">
                  <label>Duty %</label>
                  <FormattedNumberInput
                    className="line-edit-modal-input"
                    value={line.importDutyPercent}
                    onChange={(e) => updateLineNumberField(line.lineKey, 'importDutyPercent', e.target.value)}
                  />
                </div>

                {/* 3. Misc Tax (ETC) (THB) */}
                <div className="line-edit-modal-field">
                  <label>Misc Tax (ETC) (THB)</label>
                  <FormattedNumberInput
                    className="line-edit-modal-input"
                    value={line.miscTax}
                    onChange={(e) => updateLineNumberField(line.lineKey, 'miscTax', e.target.value)}
                  />
                </div>

                {/* 4. Excise Tax (%ET) */}
                <div className="line-edit-modal-field">
                  <label>Excise Tax (%ET)</label>
                  <FormattedNumberInput
                    className="line-edit-modal-input"
                    value={line.etPercent}
                    onChange={(e) => updateLineNumberField(line.lineKey, 'etPercent', e.target.value)}
                  />
                </div>

                {/* 5. SCC (Special Custom Clear) */}
                <div className="line-edit-modal-field">
                  <label>SCC (Special Custom Clear)</label>
                  <FormattedNumberInput
                    className="line-edit-modal-input"
                    value={line.scc}
                    onChange={(e) => updateLineNumberField(line.lineKey, 'scc', e.target.value)}
                  />
                </div>

                {/* 6. Stock Fee (SF) (%) */}
                <div className="line-edit-modal-field">
                  <label>Stock Fee (SF) (%)</label>
                  <FormattedNumberInput
                    className="line-edit-modal-input"
                    value={line.stkPercent}
                    onChange={(e) => updateLineNumberField(line.lineKey, 'stkPercent', e.target.value)}
                  />
                </div>

                {/* Final Calculated Result Outputs Box */}
                {(() => {
                  const calcResult = preview?.lines.find((r) => r.lineKey === line.lineKey);
                  const finalResult = calcResult ? getFinalResultForLine(calcResult) : null;
                  if (!finalResult) return null;
                  return (
                    <div className="line-edit-modal-field line-edit-modal-field--full line-edit-modal-calc-box border-t border-slate-100 pt-4 mt-2">
                      <h4 className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">Calculated QLC &amp; Sales Price</h4>
                      <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
                        <div>
                          <span className="block text-[11px] text-slate-500 font-semibold">Pre-QLC (THB)</span>
                          <strong className="text-slate-800 text-sm">{fmt(finalResult.preQLC)} THB</strong>
                        </div>
                        <div>
                          <span className="block text-[11px] text-slate-500 font-semibold">QTEC WH Cost (QLC)</span>
                          <strong className="text-slate-800 text-sm">{fmt(finalResult.qlc)} THB</strong>
                        </div>
                        <div>
                          <span className="block text-[11px] text-slate-500 font-semibold">Total Price (THB)</span>
                          <strong className="text-slate-800 text-sm">{fmt(finalResult.totalQLC)} THB</strong>
                        </div>
                        <div className="border-l border-slate-200 pl-3">
                          <span className="block text-[11px] text-slate-500 font-semibold text-blue-600">Final Sale Price (THB)</span>
                          <strong className="text-blue-700 text-base font-bold">{fmt(finalResult.roundUp)} THB</strong>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* REMARK box at the bottom */}
                <div className="line-edit-modal-field line-edit-modal-field--full border-t border-slate-100 pt-4 mt-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Remarks / หมายเหตุ</label>
                  <textarea
                    rows={2}
                    className="line-edit-modal-input"
                    style={{ height: 'auto', padding: '8px 12px' }}
                    value={line.remark || ''}
                    onChange={(e) => updateLineTextField(line.lineKey, 'remark', e.target.value)}
                    maxLength={254}
                    placeholder="Enter remarks... (max 254 chars)"
                  />
                </div>
              </div>
            )}

            {editingModalTab === 'uom-selling-terms' && (
              <div className="line-edit-modal-grid">
                {/* 1. Sales Term */}
                <div className="line-edit-modal-field">
                  <label>Sales Term</label>
                  <select
                    className="line-edit-modal-input"
                    value={line.salesTerm || ''}
                    onChange={(e) => updateLineTextField(line.lineKey, 'salesTerm', e.target.value)}
                  >
                    <option value="">-</option>
                    {orderTermSelectOptions.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>

                {/* 2. Sub Location */}
                <div className="line-edit-modal-field">
                  <label>Sub Location</label>
                  <select
                    className="line-edit-modal-input"
                    value={line.salesSubLocation || ''}
                    disabled={!line.salesTerm}
                    onChange={(e) => updateLineTextField(line.lineKey, 'salesSubLocation', e.target.value)}
                  >
                    <option value="">-</option>
                    {salesSubLocationLookups.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>

                {/* 3. Purchase UOM (หน่วยซื้อ) */}
                <div className="line-edit-modal-field">
                  <label>Purchase UOM (หน่วยซื้อ) <span>*</span></label>
                  <select
                    className="line-edit-modal-input"
                    value={line.purchaseUOM}
                    onChange={(e) => updateLineTextField(line.lineKey, 'purchaseUOM', e.target.value)}
                  >
                    <option value="">-</option>
                    {uomLookups.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                {/* 4. Stock Conversion */}
                <div className="line-edit-modal-field">
                  <label>Stock Conversion <span>*</span></label>
                  <FormattedNumberInput
                    className="line-edit-modal-input"
                    value={line.stockConversion}
                    onChange={(e) => updateLineNumberField(line.lineKey, 'stockConversion', e.target.value)}
                  />
                </div>

                {/* 5. Stock UOM (หน่วยเก็บ) */}
                <div className="line-edit-modal-field">
                  <label>Stock UOM (หน่วยเก็บ)</label>
                  <input
                    type="text"
                    className="line-edit-modal-input bg-slate-50 cursor-not-allowed"
                    disabled
                    value={uomLookups.find((opt) => opt.value === line.uom)?.label || line.uom || ''}
                  />
                </div>

                {/* 6. Sales Conversion */}
                <div className="line-edit-modal-field">
                  <label>Sales Conversion <span>*</span></label>
                  <FormattedNumberInput
                    className="line-edit-modal-input"
                    value={line.saleConversion}
                    onChange={(e) => updateLineNumberField(line.lineKey, 'saleConversion', e.target.value)}
                  />
                </div>

                {/* 7. Sales UOM (หน่วยขาย) */}
                <div className="line-edit-modal-field">
                  <label>Sales UOM (หน่วยขาย) <span>*</span></label>
                  <select
                    className="line-edit-modal-input"
                    value={line.saleUOM}
                    onChange={(e) => updateLineTextField(line.lineKey, 'saleUOM', e.target.value)}
                  >
                    <option value="">-</option>
                    {uomLookups.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                {/* 8. SPK (%) + QOC (THB/kg) */}
                <div className="line-edit-modal-field">
                  <label>SPK (%) + QOC (THB/kg)</label>
                  <div className="flex gap-2">
                    <FormattedNumberInput
                      className="line-edit-modal-input flex-1 min-w-0"
                      placeholder="SPK (%)"
                      value={line.spkPercent}
                      onChange={(e) => updateLineNumberField(line.lineKey, 'spkPercent', e.target.value)}
                    />
                    <FormattedNumberInput
                      className="line-edit-modal-input flex-1 min-w-0"
                      placeholder="QOC (THB/kg)"
                      value={line.qocRate}
                      onChange={(e) => updateLineNumberField(line.lineKey, 'qocRate', e.target.value)}
                    />
                  </div>
                </div>

                {/* 9. Markup % */}
                <div className="line-edit-modal-field">
                  <label>Markup %</label>
                  <FormattedNumberInput
                    className="line-edit-modal-input"
                    value={line.markupPercent}
                    onChange={(e) => updateLineNumberField(line.lineKey, 'markupPercent', e.target.value)}
                  />
                </div>

                {/* Spacer to align grid cells perfectly */}
                <div></div>
              </div>
            )}

            {/* registration-details tab content was merged into item-data tab */}
          </div>

          {/* Footer */}
          {(() => {
            const currentTabIndex = tabs.findIndex(t => t.key === editingModalTab);
            const prevTab = currentTabIndex > 0 ? tabs[currentTabIndex - 1] : null;
            const nextTab = currentTabIndex < tabs.length - 1 ? tabs[currentTabIndex + 1] : null;

            return (
              <div className="line-edit-modal-footer">
                <div className="line-edit-modal-footer-nav">
                  <button
                    type="button"
                    className="secondary-button compact-btn"
                    disabled={!prevTab}
                    onClick={() => prevTab && setEditingModalTab(prevTab.key)}
                    title={prevTab ? `Go to ${prevTab.label}` : undefined}
                  >
                    ← Prev Tab
                  </button>
                  <button
                    type="button"
                    className="secondary-button compact-btn"
                    disabled={!nextTab}
                    onClick={() => nextTab && setEditingModalTab(nextTab.key)}
                    title={nextTab ? `Go to ${nextTab.label}` : undefined}
                  >
                    Next Tab →
                  </button>
                </div>
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => setEditingLineKey(null)}
                >
                  Done
                </button>
              </div>
            );
          })()}
        </div>
      </div>
    );
  };

  const renderRegistrationDrawer = () => {
    if (!activeRegistrationDrawerLineKey) return null;
    const line = allLines.find(l => l.lineKey === activeRegistrationDrawerLineKey);
    if (!line) return null;

    return (
      <div className="pc-drawer-overlay" onClick={() => setActiveRegistrationDrawerLineKey(null)}>
        <div className="pc-drawer" onClick={(e) => e.stopPropagation()}>
          <div className="pc-drawer-header">
            <h3 className="flex items-center gap-2">
              <FileText size={18} className="text-emerald-600" />
              Item Details — #{line.no}
            </h3>
            <button className="pc-drawer-close" onClick={() => setActiveRegistrationDrawerLineKey(null)}>&times;</button>
          </div>
          <div className="pc-drawer-body">
            <div className="line-edit-modal-grid pc-drawer-grid">
              {/* ECCN */}
              <div className="line-edit-modal-field">
                <label>ECCN</label>
                <input
                  type="text"
                  className="line-edit-modal-input"
                  value={line.eccn || ''}
                  onChange={(e) => updateLineTextField(line.lineKey, 'eccn', e.target.value)}
                />
              </div>

              {/* UNSPSC */}
              <div className="line-edit-modal-field">
                <label>UNSPSC</label>
                <input
                  type="text"
                  className="line-edit-modal-input"
                  value={line.unspsc || ''}
                  onChange={(e) => updateLineTextField(line.lineKey, 'unspsc', e.target.value)}
                />
              </div>

              {/* e-Procurement Code */}
              <div className="line-edit-modal-field">
                <label>e-Procurement Code</label>
                <input
                  type="text"
                  className="line-edit-modal-input"
                  value={line.eProcurementCode || ''}
                  onChange={(e) => updateLineTextField(line.lineKey, 'eProcurementCode', e.target.value)}
                />
              </div>

              {/* Customer BPA */}
              <div className="line-edit-modal-field">
                <label>Customer BPA</label>
                <input
                  type="text"
                  className="line-edit-modal-input"
                  value={line.customerBpa || ''}
                  onChange={(e) => updateLineTextField(line.lineKey, 'customerBpa', e.target.value)}
                />
              </div>

              {/* SDS Required */}
              <div className="line-edit-modal-field">
                <label>SDS Required</label>
                <select
                  className="line-edit-modal-input"
                  value={line.sdsRequired || 'No'}
                  onChange={(e) => updateLineTextField(line.lineKey, 'sdsRequired', e.target.value)}
                >
                  <option value="No">No</option>
                  <option value="Yes">Yes</option>
                </select>
              </div>

              {/* Certificate Required */}
              <div className="line-edit-modal-field">
                <label>Certificate Required</label>
                <select
                  className="line-edit-modal-input"
                  value={line.certificateRequired || 'No'}
                  onChange={(e) => updateLineTextField(line.lineKey, 'certificateRequired', e.target.value)}
                >
                  <option value="No">No</option>
                  <option value="Yes">Yes</option>
                </select>
              </div>

              {/* QTEC Stock */}
              <div className="line-edit-modal-field">
                <label>QTEC Stock</label>
                <select
                  className="line-edit-modal-input"
                  value={line.qtecStock || 'No'}
                  onChange={(e) => updateLineTextField(line.lineKey, 'qtecStock', e.target.value)}
                >
                  <option value="No">No</option>
                  <option value="Yes">Yes</option>
                </select>
              </div>

              {/* Serial Required */}
              <div className="line-edit-modal-field">
                <label>Serial Required</label>
                <select
                  className="line-edit-modal-input"
                  value={line.serialRequired || 'No'}
                  onChange={(e) => updateLineTextField(line.lineKey, 'serialRequired', e.target.value)}
                >
                  <option value="No">No</option>
                  <option value="Yes">Yes</option>
                </select>
              </div>

              {/* DG Required */}
              <div className="line-edit-modal-field">
                <label>DG Required (Dangerous Goods)</label>
                <select
                  className="line-edit-modal-input"
                  value={line.dgRequired || 'No'}
                  onChange={(e) => updateLineTextField(line.lineKey, 'dgRequired', e.target.value)}
                >
                  <option value="No">No</option>
                  <option value="Yes">Yes</option>
                </select>
              </div>

              {/* E-Commerce */}
              <div className="line-edit-modal-field">
                <label>E-Commerce Item</label>
                <select
                  className="line-edit-modal-input"
                  value={line.eCommerce || 'No'}
                  onChange={(e) => updateLineTextField(line.lineKey, 'eCommerce', e.target.value)}
                >
                  <option value="No">No</option>
                  <option value="Yes">Yes</option>
                </select>
              </div>

              {/* Shelf Life */}
              <div className="line-edit-modal-field">
                <label>Shelf Life Require</label>
                <select
                  className="line-edit-modal-input"
                  value={line.shelfLifeRequire || 'No'}
                  onChange={(e) => updateLineTextField(line.lineKey, 'shelfLifeRequire', e.target.value)}
                >
                  <option value="No">No</option>
                  <option value="Yes">Yes</option>
                </select>
              </div>

              {/* Reference URL */}
              <div className="line-edit-modal-field">
                <label>Reference URL</label>
                <input
                  type="text"
                  className="line-edit-modal-input"
                  value={line.referenceUrl || ''}
                  placeholder="https://..."
                  onChange={(e) => updateLineTextField(line.lineKey, 'referenceUrl', e.target.value)}
                />
              </div>

              {/* General Spec */}
              <div className="line-edit-modal-field line-edit-modal-field--full">
                <label>General Spec</label>
                <textarea
                  rows={2}
                  className="line-edit-modal-input"
                  style={{ height: 'auto', padding: '8px 12px' }}
                  value={line.generalSpec || ''}
                  onChange={(e) => updateLineTextField(line.lineKey, 'generalSpec', e.target.value)}
                />
              </div>

              {/* Long Description */}
              <div className="line-edit-modal-field line-edit-modal-field--full">
                <label>Long Description</label>
                <textarea
                  rows={5}
                  className="line-edit-modal-input"
                  style={{ height: 'auto', padding: '8px 12px' }}
                  value={stripGeneratedLongDescSuffix([
                    line.longDesc1 || '',
                    line.longDesc2 || '',
                    line.longDesc3 || '',
                    line.longDesc4 || '',
                  ].join(''))}
                  onChange={(e) => updateLineLongDescription(line.lineKey, e.target.value)}
                  maxLength={Math.max(0, 1016 - (buildLongDescFooter(line.mfgPartNumber, line.manufacturer).length + 2))}
                  placeholder="Type the full long description here..."
                />
                <div className="mt-2 rounded border border-dashed border-gray-300 bg-gray-50 p-2 w-full">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Auto-appended (Locked)</p>
                  <pre className="mt-1 whitespace-pre-wrap text-[11px] text-gray-700 font-mono leading-tight">
                    {buildLongDescFooter(line.mfgPartNumber, line.manufacturer)}
                  </pre>
                </div>
              </div>
            </div>
          </div>
          <div className="pc-drawer-footer">
            <button type="button" className="primary-button" onClick={() => setActiveRegistrationDrawerLineKey(null)}>
              Done
            </button>
          </div>
        </div>
      </div>
    );
  };

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
            <p className="eyebrow">{pageEyebrow}</p>
            <h1>{pageTitle}</h1>
            <div className="manual-workspace-meta">
              <span className="manual-state-pill">{revisionStatusLabel}</span>
              <span>{revisionHelpText}</span>
            </div>
          </div>
        </div>
        <div className={`workspace-actions ${isReviewFinalizeActive ? 'workspace-actions--review' : ''}`} aria-label="Workspace actions">
          {isReviewFinalizeActive ? (
            <>
              <button
                className="secondary-button"
                type="button"
                onClick={() => setIsReviewFinalizeActive(false)}
                title="Back to the editable workspace"
              >
                <Edit3 size={16} aria-hidden="true" />
                Back to Editor
              </button>
              <span className="workspace-revision-chip">
                <Save size={14} aria-hidden="true" />
                Rev {revisionNo ?? '-'} saved
              </span>
            </>
          ) : (
            <>
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
                  className="secondary-button"
                  type="button"
                  onClick={() => setIsReviewFinalizeActive(true)}
                  title="Validate Item/Term candidates"
                >
                  <Eye size={16} aria-hidden="true" />
                  Review
                </button>
              )}
            </>
          )}
          {savedRunId !== null && (
            <div className="workspace-status-actions" aria-label="Local workspace status">
              <span className="workspace-status-actions-label">Local status</span>
              {runStatus === 'DRAFT' ? (
                <>
                  <button
                    className="status-mini-button status-mini-button--won"
                    type="button"
                    disabled={isUpdatingStatus}
                    onClick={() => { void handleMarkStatus('AWARDED'); }}
                    title="ทำเครื่องหมาย ชนะ (สถานะภายใน Workspace เท่านั้น ไม่ใช่ AXON Award)"
                  >
                    {isUpdatingStatus ? (
                      <Loader2 size={13} className="spin-icon" aria-hidden="true" />
                    ) : (
                      <Trophy size={13} aria-hidden="true" />
                    )}
                    Won
                  </button>
                  <button
                    className="status-mini-button status-mini-button--lost"
                    type="button"
                    disabled={isUpdatingStatus}
                    onClick={() => { void handleMarkStatus('LOST'); }}
                    title="ทำเครื่องหมาย แพ้ (สถานะภายใน Workspace เท่านั้น ไม่ใช่ AXON Award)"
                  >
                    {isUpdatingStatus ? (
                      <Loader2 size={13} className="spin-icon" aria-hidden="true" />
                    ) : (
                      <XCircle size={13} aria-hidden="true" />
                    )}
                    Lost
                  </button>
                </>
              ) : (
                <span className={`workspace-status-badge workspace-status-badge--${runStatus.toLowerCase()}`}>
                  {runStatus === 'AWARDED' ? <Trophy size={14} aria-hidden="true" /> : <XCircle size={14} aria-hidden="true" />}
                  {runStatus === 'AWARDED' ? 'WON' : runStatus}
                </span>
              )}
            </div>
          )}
        </div>
      </section>

      {isReviewFinalizeActive ? (
        <div className="review-finalize-container">
          {/* Left panel: Lines List */}
          <div className="review-sidebar">
            <div className="review-sidebar-header">
              <h3>Line Items Validation (ตรวจสอบความครบถ้วนของข้อมูล)</h3>
              <p style={{ margin: 0, fontSize: 11, color: 'var(--pc-muted)' }}>
                เลือกรายการสินค้าด้านซ้ายเพื่อตรวจสอบฟิลด์ข้อมูลที่จำเป็นของ Item &amp; Term candidate ก่อนยืนยันข้อมูล
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
                        {selectedLine.mfgPartNumber || '-'}
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
                        value={uomLookups.find((opt) => opt.value === selectedLine.uom)?.label || selectedLine.uom || ''}
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
                      {/* Harmonized Code */}
                      <ValidationFieldRow
                        label="Harmonized Code"
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
                        value={formatExchangeRate(costs.exchangeRate)}
                        issue={validation.termIssues.find(i => i.field === 'exchangeRate')}
                      />
                      <ValidationFieldRow
                        label="Product Cost (PCS)"
                        value={formatNumber(selectedLine.unitPrice, 2)}
                        issue={validation.termIssues.find(i => i.field === 'unitPrice')}
                      />
                      <ValidationFieldRow
                        label="Quantity"
                        value={formatNumber(selectedLine.qty, 0)}
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
                        value={formatNumber(selectedLine.stockConversion, 0)}
                        issue={validation.termIssues.find(i => i.field === 'stockConversion')}
                      />
                      <ValidationFieldRow
                        label="Sale Conv (NumInSale)"
                        value={formatNumber(selectedLine.saleConversion, 0)}
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
                        value={formatNumber(finalResult?.op1Source, 2)}
                        issue={validation.calcIssues.find(i => i.field === 'op1Source')}
                      />
                      <ValidationFieldRow
                        label="OP1 (THB)"
                        value={formatNumber(finalResult?.op1, 2)}
                        issue={validation.calcIssues.find(i => i.field === 'op1')}
                      />
                      <ValidationFieldRow
                        label="OP2 (THB)"
                        value={formatNumber(finalResult?.op2, 2)}
                        issue={validation.calcIssues.find(i => i.field === 'op2')}
                      />
                      <ValidationFieldRow
                        label="Ship Weight Cal"
                        value={finalResult?.shipWeightCal !== undefined ? `${formatNumber(finalResult.shipWeightCal, 2)} kg` : undefined}
                        issue={validation.calcIssues.find(i => i.field === 'shipWeightCal')}
                      />
                      <ValidationFieldRow
                        label="Allocated Freight (FR)"
                        value={formatNumber(finalResult?.frQTEC, 2)}
                        issue={validation.calcIssues.find(i => i.field === 'frQTEC')}
                      />
                      <ValidationFieldRow
                        label="Insurance (INS)"
                        value={formatNumber(finalResult?.ins, 2)}
                        issue={validation.calcIssues.find(i => i.field === 'ins')}
                      />
                      <ValidationFieldRow
                        label="CIF Price"
                        value={formatNumber(finalResult?.cifQTEC, 2)}
                        issue={validation.calcIssues.find(i => i.field === 'cifQTEC')}
                      />
                      <ValidationFieldRow
                        label="Import Duty Tax"
                        value={formatNumber(finalResult?.selectedDuty, 2)}
                        issue={validation.calcIssues.find(i => i.field === 'selectedDuty')}
                      />
                      <ValidationFieldRow
                        label="Landed Cost (QLC)"
                        value={formatNumber(finalResult?.qlc, 2)}
                        issue={validation.calcIssues.find(i => i.field === 'qlc')}
                      />
                      <ValidationFieldRow
                        label="Total QLC"
                        value={formatNumber(finalResult?.totalQLC, 2)}
                        issue={validation.calcIssues.find(i => i.field === 'totalQLC')}
                      />
                      <ValidationFieldRow
                        label="Sales Price"
                        value={formatNumber(finalResult?.roundUp, 2)}
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
                      บันทึกร่างการคำนวณ จะบันทึกใน พื้นที่ทดสอบ เท่านั้น ยังไม่เข้า PartCatalog/SAP จริง
                    </p>
                    <button
                      className="primary-button"
                      type="button"
                      disabled
                      style={{ opacity: 0.6, cursor: 'not-allowed', width: '260px' }}
                    >
                      Master Write to PartCatalog/SAP (Blocked)
                    </button>

                    {/* Sandbox Finalize — พื้นที่ทดสอบ เท่านั้น */}
                    <div className="sandbox-finalize-section">
                      <p className="sandbox-finalize-section__title">
                        ⚠️ ทดสอบการเขียนข้อมูล — พื้นที่ทดสอบ เท่านั้น
                      </p>
                      <p className="sandbox-finalize-section__desc">
                        เขียน Item/Term ลง <strong>พื้นที่ทดสอบ</strong> เพื่อทดสอบโครงสร้างข้อมูลและความถูกต้องของระบบ
                        เท่านั้น ยังไม่เข้า PartCatalog/SAP จริง ก่อนใช้งานจริง ข้อมูลจำเป็นต้องผ่านกระบวนการอนุมัติก่อน
                      </p>
                      {sandboxFinalizeConfirming ? (
                        <div className="sandbox-finalize-confirm">
                          <p className="sandbox-finalize-confirm__text">
                            ยืนยันการเขียนลง พื้นที่ทดสอบ ใช่หรือไม่?
                          </p>
                          <div className="sandbox-finalize-confirm__actions">
                            <button
                              className="primary-button compact-btn sandbox-finalize-btn--confirm"
                              type="button"
                              disabled={isSandboxFinalizing || !savedRunId}
                              onClick={handleSandboxFinalize}
                            >
                              {isSandboxFinalizing
                                ? <><Loader2 size={12} className="spin-icon" aria-hidden="true" />&nbsp;กำลังเขียน…</>
                                : 'ยืนยันเขียนข้อมูลลงพื้นที่ทดสอบ'}
                            </button>
                            <button
                              className="secondary-button compact-btn"
                              type="button"
                              onClick={() => setSandboxFinalizeConfirming(false)}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          className="secondary-button compact-btn sandbox-finalize-btn"
                          type="button"
                          disabled={!savedRunId || isSandboxFinalizing}
                          onClick={() => setSandboxFinalizeConfirming(true)}
                          title="เขียน Item/Term ลง พื้นที่ทดสอบ เพื่อทดสอบเท่านั้น ยังไม่เข้า PartCatalog/SAP จริง"
                        >
                          ทดสอบการเขียนข้อมูล → พื้นที่ทดสอบ (ทดสอบ)
                        </button>
                      )}
                      {sandboxFinalizeResult && (
                        <div className={`sandbox-finalize-result ${sandboxFinalizeResult.success ? 'sandbox-finalize-result--success' : 'sandbox-finalize-result--error'}`}>
                          {sandboxFinalizeResult.success
                            ? (() => {
                                const reusedCount = sandboxFinalizeResult.written.filter(w => w.reused).length;
                                const reusedText = reusedCount > 0 ? `, ใช้รายการเดิม ${reusedCount} รายการ (ไม่สร้างซ้ำ)` : '';
                                return `✅ สำเร็จ: ${sandboxFinalizeResult.written.length} รายการ${reusedText} → พื้นที่ทดสอบ (ItemID: ${sandboxFinalizeResult.written.map(w => w.sandboxItemId).join(', ')})`;
                              })()
                            : `❌ มีข้อผิดพลาด: ${sandboxFinalizeResult.errors?.map(e => e.message).join('; ')}`
                          }
                        </div>
                      )}
                    </div>
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
            <div className="bulk-setup-card-title">1.1 Initial Order Data</div>
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
                placeholder="-"
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
                onValueChange={(val) => {
                  if (val) updateCurrency(val);
                }}
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
            <div className="cost-bar-apply-buttons">
              <button
                className="cost-bar-apply-defaults"
                type="button"
                onClick={() => applyOrderSettingsToAllLines(false)}
                disabled={allLines.length === 0}
                title="ใช้ Purchase Term, Location, Sub Location, Ship Mode, Currency กับทุกรายการ"
              >
                <Sparkles size={13} />
                Apply Order Settings to All
              </button>
              {lineChanges.length > 0 && (
                <button
                  className="cost-bar-apply-defaults cost-bar-apply-defaults--secondary"
                  type="button"
                  onClick={() => applyOrderSettingsToAllLines(true)}
                  title="ใช้เฉพาะรายการที่ยังไม่ได้แก้ไขค่า Order Settings เอง"
                >
                  <CheckCircle2 size={13} />
                  To Unedited Only
                </button>
              )}
            </div>
          </div>

          <div className="bulk-setup-card bulk-setup-card--costs">
            <div className="bulk-setup-card-title">1.2 Shared Costs</div>
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
            <div className="bulk-setup-card-title">1.3 Global Variables</div>
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
                <span>SPK (%)</span>
                <FormattedNumberInput
                  id="bulk-cost-default-spk"
                  name="bulkCost.defaults.spkPercent"
                  value={globalDefaults.spkPercent}
                  focused={focusedCostInput === 'default-spk'}
                  onBlur={() => setFocusedCostInput(null)}
                  onChange={(event) => updateGlobalDefault('spkPercent', event.target.value)}
                  onFocus={() => setFocusedCostInput('default-spk')}
                />
              </label>
              <label className="cost-bar-field">
                <span>QOC (THB/kg)</span>
                <FormattedNumberInput
                  id="bulk-cost-default-qoc"
                  name="bulkCost.defaults.qocRate"
                  value={globalDefaults.qocRate}
                  focused={focusedCostInput === 'default-qoc'}
                  onBlur={() => setFocusedCostInput(null)}
                  onChange={(event) => updateGlobalDefault('qocRate', event.target.value)}
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
              <Sparkles size={13} />
              Apply to All Items
            </button>
          </div>
        </div>

        <details className="cost-bar-run-details" open>
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
            <Info size={14} className="text-pc-blue flex-shrink-0" style={{ color: 'var(--pc-blue)' }} />
            <div className="flex items-center gap-2 flex-wrap" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span>Vendor: <strong className="vendor-badge">{supplierCode}</strong></span>
              <small style={{ color: 'var(--pc-muted)', fontSize: '12px' }}>
                Double-click a row or click <span className="inline-flex items-center justify-center" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '2px 4px', margin: '0 2px' }}><Edit3 size={11} style={{ color: '#475569' }} /></span> to edit. Selected rows are sent to CAL.
              </small>
              <button
                type="button"
                disabled={cweightBatchLoading || allLines.length === 0}
                className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed ml-auto"
                onClick={handleCWeightLookupAll}
              >
                {cweightBatchLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
                {cweightBatchLoading ? 'กำลังค้นหา...' : `ค้นหา CWeight (${allLines.length} รายการ)`}
              </button>
            </div>
            {cweightBatchStats && (
              <div className="flex items-center gap-2 text-[11px] text-slate-500 pt-0.5 pl-5">
                <span>ผลค้นหา CWeight:</span>
                <span className="text-emerald-700 font-medium">{cweightBatchStats.exact} พบตรง</span>
                <span className="text-amber-700 font-medium">{cweightBatchStats.semantic} ให้ตรวจ</span>
                <span className="text-slate-400">{cweightBatchStats.notFound} ไม่พบ</span>
                <span className="text-slate-300">/ {cweightBatchStats.total} รายการ</span>
              </div>
            )}
          </div>

          <div className="summary-strip source-summary-strip">
            <SummaryItem label="Selected lines" value={`${selectedLines.length} / ${allLines.length}`} className="summary-item-selected" />
            <SummaryItem label="Total qty" value={fmt(totalQty)} className="summary-item-qty" />
            <SummaryItem label="Total amount" value={`${selectedLines[0]?.currency ?? ''} ${fmt(totalAmount)}`} className="summary-item-amount" />
            <SummaryItem
              label="Known weight"
              value={`${fmt(totalWeight)} kg`}
              warning={linesWithWarning > 0 ? `${linesWithWarning} missing` : undefined}
              className={linesWithWarning > 0 ? 'summary-item-warning' : 'summary-item-weight'}
            />
            <SummaryItem
              label="Chargeable W"
              value={totalChargeableWeight > 0 ? `${fmt(totalChargeableWeight)} kg` : '—'}
              className="summary-item-chargeable"
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
              <div className="line-add-controls">
                <button
                  type="button"
                  className="primary-button compact-btn add-item-btn"
                  onClick={addLine}
                >
                  + Add Item
                </button>
                <div className="bulk-add-control">
                  <input
                    aria-label="Number of items to add"
                    className="bulk-add-count-input"
                    min={1}
                    max={100}
                    type="number"
                    value={bulkAddCount}
                    onChange={(event) => setBulkAddCount(event.target.value)}
                  />
                  <button
                    type="button"
                    className="secondary-button compact-btn add-multiple-btn"
                    onClick={addMultipleLines}
                  >
                    + Add
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Column Preset Tabs Bar */}
          <div className="line-column-presets-bar">
            {PRESET_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={`line-column-preset-btn ${lineColumnPreset === tab.key ? 'line-column-preset-btn--active' : ''}`}
                onClick={() => setLineColumnPreset(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>



          {allLines.length === 0 ? (
            <div className="empty-state">
              <Search size={32} aria-hidden="true" />
              <p>ยังไม่มีรายการ</p>
              <small>กด "+ Add Item" เพื่อเพิ่มรายการแรก จากนั้นกรอก Qty / Price / Weight ก่อนกด CAL</small>
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
                            className={`resizable-table-header center-cell ${stickyLeft !== undefined ? 'sticky-col' : ''}`}
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
                        <tr
                          className={`${checked ? '' : 'row-muted'} cursor-pointer hover:bg-slate-50 transition-colors`}
                          key={line.lineKey}
                          onDoubleClick={() => {
                            if (isLatestView) {
                              setEditingLineKey(line.lineKey);
                              setEditingModalTab('item-data');
                            }
                          }}
                        >
                          {visibleLineColumns.map((column) => (
                            <SourceLineCell
                              key={column.key}
                              columnKey={column.key}
                              allocatedCosts={(() => {
                                const result = preview?.lines.find((r) => r.lineKey === line.lineKey);
                                const fr = result ? getFinalResultForLine(result) : null;

                                // Live calculate allocated costs if preview is not calculated yet
                                const isSelected = selectedKeys.has(line.lineKey);
                                const weight = resolveLineWeight(line) ?? 0;
                                const lineWeight = weight * line.qty;
                                const weightRatio = totalWeight > 0 ? lineWeight / totalWeight : 0;
                                const valueRatio = totalAmount > 0 ? line.amount / totalAmount : 0;
                                const safeQty = line.qty > 0 ? line.qty : 1;

                                const livePkhEa = isSelected ? (costs.pkh * weightRatio) / safeQty : 0;
                                const liveSocEa = isSelected ? (costs.soc * weightRatio) / safeQty : 0;
                                const liveFrEa = isSelected ? (costs.freight * weightRatio) / safeQty : 0;
                                const liveCcEa = isSelected ? (costs.customs * weightRatio) / safeQty : 0;
                                const liveTtEa = isSelected ? (costs.wireTT * valueRatio) / safeQty : 0;

                                return {
                                  pkhEa: result ? result.pkhPerEach : livePkhEa,
                                  socEa: result ? result.socPerEach : liveSocEa,
                                  frEa: result ? result.freightPerEach : liveFrEa,
                                  ccEa: result ? result.ccPerEach : liveCcEa,
                                  ttEa: result ? result.wireTTPerEach : liveTtEa,
                                  op1Fcy: fr ? fr.op1Source : 0,
                                  exRate: fr ? fr.rateExchange : costs.exchangeRate,
                                  op1Thb: fr ? fr.op1 : 0,
                                  insAmount: fr ? fr.ins : 0,
                                  cifQTEC: fr?.cifQTEC,
                                  preQLC: fr?.preQLC,
                                  qlc: fr?.qlc,
                                  totalQLC: fr?.totalQLC,
                                  roundUp: fr?.roundUp,
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
                              onEditLine={isLatestView ? (key) => { setEditingLineKey(key); setEditingModalTab('item-data'); } : undefined}
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
      {renderLineEditModal()}
    </div>
  );
}
