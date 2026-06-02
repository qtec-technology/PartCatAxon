// ─────────────────────────────────────────────────────────────────────────────
// Bulk Cost Preview — sessionStorage bridge for opening Item/Term preview tabs
// ─────────────────────────────────────────────────────────────────────────────
import type { AllocationLineSource, BulkCostInput, FinalResultColumns } from './bulk-cost.types';
import type { ItemData } from '../../types/item_types';
import type { TermCalcResults, TermFormData } from '../../types/term_form.types';
import { defaultTermFormData } from '../../types/term_form.types';

export type BulkCostPreviewType = 'item' | 'term';

export interface BulkCostPreviewMeta {
  type: BulkCostPreviewType;
  lineKey: string;
  description: string;
  supplierName: string;
  createdAt: number;
}

export interface BulkCostTermPreviewPayload {
  type: 'term';
  meta: BulkCostPreviewMeta;
  formData: TermFormData;
  calcResults: TermCalcResults;
}

export interface BulkCostItemPreviewPayload {
  type: 'item';
  meta: BulkCostPreviewMeta;
  itemData: ItemData;
}

export type BulkCostPreviewPayload = BulkCostTermPreviewPayload | BulkCostItemPreviewPayload;

const PREVIEW_KEY_PREFIX = 'bulk-cost-preview';
const PREVIEW_TTL_MS = 30 * 60 * 1000; // 30 minutes

/** Removes expired preview keys from localStorage. */
function cleanupExpiredPreviews(): void {
  try {
    const now = Date.now();
    const toDelete: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(PREVIEW_KEY_PREFIX)) {
        const raw = localStorage.getItem(k);
        if (!raw) continue;
        try {
          const parsed = JSON.parse(raw) as { meta?: { createdAt?: number } };
          const age = now - (parsed.meta?.createdAt ?? 0);
          if (age > PREVIEW_TTL_MS) toDelete.push(k);
        } catch {
          toDelete.push(k);
        }
      }
    }
    toDelete.forEach((k) => localStorage.removeItem(k));
  } catch {
    // ignore
  }
}

/** Stores preview payload in localStorage and returns the storage key. */
export function storeBulkCostPreview(payload: BulkCostPreviewPayload): string {
  const key = `${PREVIEW_KEY_PREFIX}-${payload.type}-${payload.meta.createdAt}`;
  try {
    cleanupExpiredPreviews();
    localStorage.setItem(key, JSON.stringify(payload));
  } catch {
    // localStorage full or unavailable — silently ignore
  }
  return key;
}

/** Reads a stored preview payload, or null if not found / parse error. */
export function loadBulkCostPreview(key: string): BulkCostPreviewPayload | null {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(key) : null;
    if (!raw) return null;
    return JSON.parse(raw) as BulkCostPreviewPayload;
  } catch {
    return null;
  }
}

// ─── Mappers ─────────────────────────────────────────────────────────────────

/** Maps bulk cost allocation data to TermFormData for read-only preview. */
export function mapBulkCostToTermFormData(
  source: AllocationLineSource,
  costs: BulkCostInput,
  finalResult: FinalResultColumns,
): TermFormData {
  return {
    ...defaultTermFormData,
    // Supplier / context
    supplier: source.vendorCode,
    suppOrderCode: source.supplierOrderCode,
    validFrom: source.validFrom || todayIsoDate(),
    validTo: source.validTo || '',
    // Pricing
    prodCost: finalResult.productCost,
    currency: source.currency || costs.currency,
    exRate: costs.exchangeRate,
    // Allocated per-each costs
    pkh: finalResult.pkh,
    soc: finalResult.soc,
    wireTT: finalResult.wireTT,
    customClear: finalResult.customClear,
    // Shipment context
    purchaseTerm: source.orderTerm || costs.orderTerm,
    purchaseTermLocation: source.location || costs.location,
    purchaseSubLocation: source.subLocation || costs.subLocation,
    shipMode: String(source.shipModeNo > 0 ? source.shipModeNo : (costs.shipModeNo ?? -1)),
    // Dimensions / weight
    dimUnit: String(source.dimUnit || 1),
    length: source.length,
    width: source.width,
    height: source.height,
    weight: source.shippingWeightPerEach ?? source.itemWeightPerEach ?? 0,
    // Rate inputs
    freightRate: source.freightRate,
    fr: finalResult.frQTEC,
    insPercent: source.insPercent,
    zoneRate: source.zoneRate,
    dutyPercent: source.importDutyPercent,
    excisePercent: source.etPercent,
    miscTax: source.miscTax,
    // Cost parameters
    stockFeePercent: source.stkPercent,
    spk: source.spkPercent,
    qoc: source.qocRate,
    markup: source.markupPercent,
    // UOM & Conversion
    purchaseUOM: source.purchaseUOM,
    salesUOM: source.saleUOM,
    stockUOM: source.stockUOM || 'EA',
    numInBuy: source.stockConversion || 1,
    numInSale: source.saleConversion || 1,
    moq: source.moq != null ? String(source.moq) : '',
    // Meta
    leadTime: source.deliveryLeadTime,
    salesPerson: costs.saleIncharge,
    sourcedBy: costs.contactPerson,
  };
}

/** Maps FinalResultColumns to TermCalcResults for display in the Term preview. */
export function mapBulkCostToTermCalcResults(
  source: AllocationLineSource,
  finalResult: FinalResultColumns,
): TermCalcResults {
  const qlc2 = finalResult.stockConversion > 0 ? finalResult.qlc / finalResult.stockConversion : 0;

  return {
    OP1: finalResult.op1Source,
    OP1_THB: finalResult.op1,
    OP2_THB: finalResult.op2,
    DIM_WEIGHT: source.dimensionWeightPerEach ?? 0,
    SHP_WEIGHT: finalResult.shipWeightCal,
    INS: finalResult.ins,
    FR_QTEC: calcFreightQtecReference(source, finalResult),
    FR_ZONE: finalResult.frZoneCost,
    CIF: finalResult.cifQTEC,
    CIF_ZONE: finalResult.cifZone,
    DT: Math.max(finalResult.dtQTEC, finalResult.dtZone),
    DT_FR: finalResult.dtQTEC,
    DT_ZONE: finalResult.dtZone,
    ET: finalResult.et,
    MT: finalResult.mt,
    PRE_QLC: finalResult.preQLC,
    STK: finalResult.stk,
    QLC: finalResult.qlc,
    QLC2: qlc2,
    QLC3: finalResult.totalQLC,
    TOTAL_PRICE: finalResult.totalQLC,
    MK_THB: finalResult.markup,
    SALES_PRICE: finalResult.roundUp,
  };
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function calcFreightQtecReference(source: AllocationLineSource, finalResult: FinalResultColumns): number {
  return round6(finalResult.shipWeightCal * source.freightRate);
}

function round6(value: number): number {
  return Math.round(value * 1000000) / 1000000;
}

/** Maps AllocationLineSource to ItemData for display in the Item preview. */
export function mapBulkCostToItemData(source: AllocationLineSource): ItemData {
  const yesNo = (value: unknown): boolean => {
    const normalized = String(value ?? '').trim().toUpperCase();
    return normalized === 'YES' || normalized === 'Y' || normalized === '1' || normalized === 'TRUE';
  };

  const permitRequired =
    yesNo(source.importPermit);

  const shelfLifeRequired =
    yesNo(source.shelfLifeRequire);

  return {
    itemGroup: source.itemGroup,
    itemCategory: source.itemCategory,
    catalogNo: source.itemCode.trim() || '',
    b1ItemNo: '',
    mfrBrand: source.manufacturer,
    mfrCatalogNo: source.mfgPartNumber,
    itemDescription: source.sapDescription,
    specialRequirement: '',
    customerStockCode: source.customerStockCode || '',
    stockUOM: source.uom || 'EA',
    countryOfOrigin: source.countryOfOrigin,
    eccn: source.eccn || '',
    unspsc: source.unspsc || '',
    eProcurementCode: source.eProcurementCode || '',
    remark: '',
    active: true,
    masterFG: false,
    shelfLifeRequired,
    punchOut: false,
    vmi: false,
    customerBPA: yesNo(source.customerBpa),
    isQTECStock: yesNo(source.qtecStock),
    serialRequired: yesNo(source.serialRequired),
    sdsRequired: yesNo(source.sdsRequired),
    certificateRequired: yesNo(source.certificateRequired),
    eCommerce: yesNo(source.eCommerce),
    b1Item: false,
    dgRequired: yesNo(source.dgRequired),
    permitRequired,
    permitType: source.permitType || '',
    hsCode: source.hsCode,
    longDesc1: source.longDesc1 || '',
    longDesc2: source.longDesc2 || '',
    longDesc3: source.longDesc3 || '',
    longDesc4: source.longDesc4 || '',
    generalSpec: source.generalSpec || '',
    referenceUrl: source.referenceUrl || '',
    updatedBy: '',
    updatedDate: '',
    hasImage: false,
  };
}
