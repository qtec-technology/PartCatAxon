// ─────────────────────────────────────────────────────────────────────────────
// Bulk Cost Allocation – TypeScript Domain Model
// ─────────────────────────────────────────────────────────────────────────────
//
// Aligned with: ผลลัพธ์สุดท้ายที่ต้องได้ครบ.md
//
// This file defines the data contracts for the Bulk Cost Allocation workspace.
// All types here are independent of the existing Express API / SQL Server layer.
//
// Column mapping reference (from the AXON extraction sheet):
//   PART 1: Source fields (A-AA)
//   PART 2: Weight, Ratio, Duty (AC-AK)
//   PART 3: PKH, SOC allocated by weight (AM-AP)
//   PART 4: Freight, TT, CC allocated (AR-AW)
//   Final Result: Full term-level output (AY-CP)
// ─────────────────────────────────────────────────────────────────────────────

// ─── PART 1: Allocation Line Source ─────────────────────────────────────────
// Represents a single item/term line selected for a bulk allocation run.

export const ITEM_GROUP_OPTIONS = [
  { code: '104', name: 'FG' },
  { code: '107', name: 'SV' },
  { code: '105', name: 'SM' },
  { code: '106', name: 'CM' },
] as const;

export function getItemGroupName(code: string): string {
  return ITEM_GROUP_OPTIONS.find((option) => option.code === code)?.name ?? '';
}

export function formatItemGroup(code: string): string {
  return getItemGroupName(code) || code || '-';
}

export const SHIP_MODE_LABELS: Record<number, string> = {
  1: 'Air Forwarder',
  2: 'Sea',
  3: 'Truck',
  4: 'QTEC-Motorcycle',
  5: 'QTEC-Truck',
  6: 'Air Courier',
};

export function formatShipMode(shipModeNo: number): string {
  return SHIP_MODE_LABELS[shipModeNo] ?? (shipModeNo > 0 ? String(shipModeNo) : '-');
}

export interface AllocationLineSource {
  /** Internal unique key for this line within the allocation run */
  lineKey: string;

  /** Hidden AXON matching hints. Persisted for reverse mapping, not shown to sales users. */
  axonUniqueLineId?: string;
  axonMatchMethod?: string;
  axonMatchConfidence?: number | null;

  // ── PART 1 columns A–J ────────────────────────────────────────────────────
  no: number;                      // A6: NO.
  itemGroup: string;               // User-confirmed ItemGroupCode for new item code generation
  itemCategory: string;            // Item master category candidate
  customerStockCode: string;       // Customer stock code candidate
  sapDescription: string;          // B6: SAP PART DESCRIPTION
  manufacturer: string;            // C6: MANUFACTURE
  mfgPartNumber: string;           // D6: MFG P/N
  supplierOrderCode: string;       // E5+E6: Supp Order Code / GG CODE
  ggCode: string;                  // E6: GG CODE
  qty: number;                     // F6: Qty
  uom: string;                     // G6: Stock UOM candidate (InvntryUom)
  unitPrice: number;               // H6: Unit Price
  amount: number;                  // I6: Amount (qty * unitPrice)
  currency: string;                // J6: Currency
  countryOfOrigin: string;         // Item master country of origin candidate
  hsCode: string;                  // Item master HS/Harmonized Code candidate

  // ── PART 1 columns K–V: Document Fees (per each) ─────────────────────────
  // These are costs per item that need to be divided to per-each.
  // Rule: if cost is per-item, divide by qty to get per-each.
  docFee: DocumentFees;

  // ── PART 1 columns W–AA: Term context ─────────────────────────────────────
  deliveryLeadTime: string;        // W6: Delivery Lead time
  orderTerm: string;               // X6: Purchase Term (Exwork/FCA/FAS/FOB/CIF/CFR/DDP)
  location: string;                // Y6: Term Location
  subLocation: string;             // Purchase Sub Location
  salesTerm?: string;              // Sales Term
  salesSubLocation?: string;       // Sales Sub Location
  importPermit: string;            // Z6: Import Permit
  permitType: string;              // Permit Type
  shelfLifeRequire: string;        // AA6: Shelf Life Require

  // ── PART 2 columns AC–AK: Weight & Ratio ──────────────────────────────────
  itemWeightPerEach: number | null;         // AC6: Item Weight (kg) Per Each "A"
  dimensionWeightPerEach: number | null;    // AD6: Dimension Weight (kg) Per Each "B"
  shippingWeightPerEach: number | null;     // AE6: Shipping or Chargeable (kg) Per Each Max("A","B")
  totalShippingWeight: number | null;       // AF6: Total Shipping or Chargeable (kg)
  // AG6, AH6: Weight Ratio — calculated, not input
  // AI6, AJ6: Value Ratio — calculated, not input

  // ── Duty ──────────────────────────────────────────────────────────────────
  importDutyPercent: number;       // AK6: Import Duty (%)

  // ── Document fee basis (per fee kind) ─────────────────────────────────────
  // 'PER_EACH': fee enters OP1 (default). 'BY_LOT_BATCH': fee becomes a
  // separate service-line candidate and is excluded from product OP1.
  docFeeBasis?: Partial<Record<keyof DocumentFees, 'PER_EACH' | 'BY_LOT_BATCH'>>;

  // ── Supplier identity ─────────────────────────────────────────────────────
  vendorCode: string;
  vendorName: string;              // AY6: Supplier name

  // ── Term identity (for linking back) ──────────────────────────────────────
  termId: number | null;
  itemCode: string;                // Existing matched ItemCode only; new items are auto-generated after save

  // ── UOM & Conversion (for final result) ───────────────────────────────────
  purchaseUOM: string;             // BO6
  stockUOM: string;                // BP6
  saleUOM: string;                 // BQ6
  stockConversion: number;         // BR6
  saleConversion: number;          // BS6
  moq: string | null;              // BT6

  // ── Term calculation inputs (for final result) ────────────────────────────
  insPercent: number;              // BM6: Insurance (INS%)
  shipModeNo: number;              // Needed for Exwork Case calculation
  freightRate: number;             // For FR QTEC calc
  freightType?: string;
  dimUnit: number;                 // 1=CM, 2=INCH
  length: number;
  width: number;
  height: number;
  zoneRate: number;
  etPercent: number;               // Excise Tax %
  miscTax: number;                 // ETC (Misc Tax)
  scc: number;                     // Special Custom Clear
  stkPercent: number;              // Stock Fee %
  markupPercent: number;           // CO6: Mark Up %
  spkPercent: number;              // SPK percentage of QLC
  qocRate: number;                 // QOC rate in THB/kg

  // ── Registration Details (UI-only / Snapshot Persisted) ───────────────────
  eccn?: string;
  unspsc?: string;
  eProcurementCode?: string;
  longDesc1?: string;
  longDesc2?: string;
  longDesc3?: string;
  longDesc4?: string;
  generalSpec?: string;
  referenceUrl?: string;
  sdsRequired?: string;
  certificateRequired?: string;
  customerBpa?: string;
  qtecStock?: string;
  serialRequired?: string;
  dgRequired?: string;
  eCommerce?: string;
  vmi?: string;
  b1Item?: string;
  specialRequirement?: string;
  remark?: string;
  validFrom?: string;
  validTo?: string;
}


// ─── Document Fees ──────────────────────────────────────────────────────────
// Columns K–V in PART 1. Each is per-each (UOM By Each only).
// If the source value is per-item, it must be divided by qty before storing here.

export interface DocumentFees {
  coc: number;                     // K6: COC per each
  millCert: number;                // M6: Mill Cert per each
  testCert: number;                // O6: Test Cert per each
  coa: number;                     // Q6: COA per each (maps to COO in some contexts)
  coo: number;                     // S6: COO per each
  anyOther: number;                // U6: Any Other per each
}

export const EMPTY_DOCUMENT_FEES: DocumentFees = {
  coc: 0,
  millCert: 0,
  testCert: 0,
  coa: 0,
  coo: 0,
  anyOther: 0,
};

// ─── Bulk Cost Input ────────────────────────────────────────────────────────
// Total costs for the shipment entered by the user.
// Allocation rule from spec:
//   PKH, SOC, Freight, CC → by weight
//   TT → by value

export interface BulkCostInput {
  /** Weight-based costs (total for the shipment) */
  pkh: number;            // Packing Handling
  soc: number;            // Supplier Outbound Cost
  freight: number;        // Shipment Freight
  customs: number;        // Custom Clear / Customs (CC) — by weight per spec

  /** Value-based costs (total for the shipment) */
  wireTT: number;         // Wire TT / Bank Fee — by value

  /** Context */
  currency: string;       // Currency of the input costs
  exchangeRate: number;   // Exchange rate to THB
  referenceNo: string;    // Allocation reference number
  remark: string;         // User remark

  /** Shipping context — same for all lines in one quotation run */
  orderTerm: string;      // e.g. 'Exwork', 'FOB', 'CIF'
  location: string;       // Ship From — e.g. 'US', 'California'
  subLocation: string;    // Purchase Sub Location filtered by Term Location
  shipModeNo: number;     // 1=Air FWD, 2=Sea, 3=Truck, 4=QTEC-MC, 5=QTEC-Truck, 6=Air COUR

  /** Contact info — read-only display in Step 1 header */
  contactPerson: string;
  saleIncharge: string;
}

// ─── Allocation Result (per line) ───────────────────────────────────────────
// PART 3 + PART 4 columns: allocated costs per-each and per-item.

export interface AllocationLineResult {
  lineKey: string;

  // ── PART 2: Ratios ────────────────────────────────────────────────────────
  weightRatioPerItem: number;      // AG6: Weight Ratio Per Item
  weightRatioPerEach: number;      // AH6: Weight Ratio Per Each
  valueRatioPerItem: number;       // AI6: Value Ratio Per Item
  valueRatioPerEach: number;       // AJ6: Value Ratio Per Each

  // ── PART 3: PKH + SOC (by weight) ────────────────────────────────────────
  pkhPerEach: number;              // AM6: Packing Handling (PKH) / Each
  pkhPerItem: number;              // AN6: Packing Handling (PKH) / Item
  socPerEach: number;              // AO6: Supplier Outbound Cost / Each
  socPerItem: number;              // AP6: Supplier Outbound Cost / Item

  // ── PART 4: Freight, TT, CC ──────────────────────────────────────────────
  freightPerEach: number;          // AR6: Freight Cost Per Each (by weight)
  freightPerItem: number;          // AS6: Freight Cost Per Item (by weight)
  wireTTPerEach: number;           // AT6: Wire TT Per Each (by value)
  wireTTPerItem: number;           // AU6: Wire TT Per Item (by value)
  ccPerEach: number;               // AV6: Custom Fee Per Each (by weight)
  ccPerItem: number;               // AW6: Custom Fee Per Item (by weight)

  // ── Final Result (AY–CP) ──────────────────────────────────────────────────
  // These are the Term calculation outputs with allocated costs applied.
  finalResult: FinalResultColumns;

  /** Status */
  warnings: AllocationWarning[];
  status: 'ready' | 'warning' | 'error';
}

// ─── Final Result Columns ───────────────────────────────────────────────────
// Maps to columns AY–CP in the spec.

export interface FinalResultColumns {
  supplierName: string;            // AY6
  purchaseOrderTerm: string;       // AZ6
  termLocation: string;            // BA6
  productCost: number;             // BB6: Product Cost (PCS) — original unit price
  pkh: number;                     // BC6: PKH per each (allocated)
  soc: number;                     // BD6: SOC per each (allocated)

  // Document Fees (per each)
  docCOC: number;                  // BE6
  docMill: number;                 // BF6
  docTestCert: number;             // BG6
  docCOO: number;                  // BH6
  docAnyOther: number;             // BI6
  docFees: number;                 // Diagnostic total: Documents Fees (FEES)

  currency: string;                // BJ6
  rateExchange: number;            // BK6
  shipWeightCal: number;           // BL6: ShipWeightCal (KG)
  insPercent: number;              // BM6: Insurance (INS%)
  importDutyPercent: number;       // BN6: Import Duty (%)

  purchaseUOM: string;             // BO6
  stockUOM: string;                // BP6
  saleUOM: string;                 // BQ6
  stockConversion: number;         // BR6
  saleConversion: number;          // BS6
  purchaseMOQ: string | null;      // BT6

  wireTT: number;                  // BU6: Wire Transfer (TT) (THB) per each
  customClear: number;             // BV6: Custom Clear (CC) (THB) per each

  op1Source: number;               // Order Price (OP1) before exchange rate
  op1: number;                     // BW6: Order Price (OP1) (THB)
  exworkCase: number;              // BX6: EXWORK CASE multiplier
  op2: number;                     // BY6: Order Price (OP2) (THB)
  ins: number;                     // BZ6: Insurance (INS) (THB)

  frQTEC: number;                  // CA6: Freight Actual Cost Per Shipment (THB)
  frZoneRate: number;              // CB6: Freight Zone Cost Per KG (THB)
  frZoneCost: number;              // CC6: Freight Zone Cost Per Shipment (THB)

  cifQTEC: number;                 // CD6: CIF Price FR_FREIGHT Actual
  cifZone: number;                 // CE6: CIF Price FR_FREIGHT ZONE

  dtQTEC: number;                  // CF6: Duty Tax FR_FREIGHT Actual
  dtZone: number;                  // CG6: Duty Tax FR_FREIGHT Zone
  selectedDuty: number;            // CH6: Final DT = MAX(Duty QT, Duty Zone)

  ttFinal: number;                 // CI6: Wire Transfer (TT) (THB)
  ccFinal: number;                 // CJ6: Custom Clear (CC) (THB)

  et: number;                      // Excise Tax (THB)
  mt: number;                      // Municipal Tax (THB)
  miscTaxVal: number;              // Misc Tax (THB)
  scc: number;                     // Special Custom Clear (THB)
  preQLC: number;                  // Pre-QLC sum before STK
  stk: number;                     // Stock Fee amount (THB)

  qlc: number;                     // CK6: QTEC WH COST (QLC)
  spk: number;                     // CL6: SPK
  qocVal: number;                  // CM6: QOC
  totalQLC: number;                // CN6: Total QLC (THB)
  markup: number;                  // CO6: Mark Up
  roundUp: number;                 // CP6: Round Up
}

// ─── Warning Model ──────────────────────────────────────────────────────────

export type AllocationWarningCode =
  | 'MISSING_WEIGHT'
  | 'MISSING_AMOUNT'
  | 'ZERO_QTY'
  | 'MIXED_VENDOR'
  | 'MIXED_CURRENCY'
  | 'NEGATIVE_COST'
  | 'ROUNDING_RESIDUAL';

export interface AllocationWarning {
  code: AllocationWarningCode;
  message: string;
  severity: 'warning' | 'error';
  field?: string;
}

// ─── Allocation Preview ─────────────────────────────────────────────────────

export interface AllocationPreview {
  previewedAt: string;

  vendorCode: string;
  vendorName: string;
  totalLines: number;
  totalQty: number;
  totalAmount: number;
  totalWeight: number;
  weightAvailable: number;
  weightMissing: number;

  lines: AllocationLineResult[];

  runWarnings: AllocationWarning[];

  roundingResidual: {
    pkh: number;
    soc: number;
    freight: number;
    customs: number;
    wireTT: number;
  };
}

// ─── Allocation Run ──────────────────────────────────────────────────────────

export type AllocationRunStatus = 'DRAFT' | 'QUOTED' | 'AWARDED' | 'REVERSE_MAPPED' | 'LOST' | 'ARCHIVED';

export interface BulkCostRunSummary {
  runId: number;
  revisionGroupId: number;
  revisionNo: number;
  revisionSourceRunId: number | null;
  status: AllocationRunStatus;
  vendorCode: string;
  vendorName: string;
  referenceNo: string;
  totalLines: number;
  totalQty: number;
  totalAmount: number;
  currency: string;
  saleIncharge: string;
  updatedBy: string;
  updatedAt: string;
  createdAt: string;
}

export interface AllocationRun {
  runId: string;
  status: AllocationRunStatus;
  createdBy: string;
  createdAt: string;
  updatedBy: string;
  updatedAt: string;

  input: {
    vendor: { code: string; name: string };
    lines: AllocationLineSource[];
    costs: BulkCostInput;
  };

  preview: AllocationPreview | null;
}

// ─── UI State ───────────────────────────────────────────────────────────────

export type WorkspaceStep = 'select' | 'input' | 'preview' | 'saved';

export interface BulkCostWorkspaceState {
  step: WorkspaceStep;
  selectedLines: AllocationLineSource[];
  costs: BulkCostInput;
  preview: AllocationPreview | null;
  isCalculating: boolean;
  isDirty: boolean;
}

// ─── Empty Defaults ─────────────────────────────────────────────────────────

export const EMPTY_BULK_COST_INPUT: BulkCostInput = {
  pkh: 0,
  soc: 0,
  freight: 0,
  customs: 0,
  wireTT: 0,
  currency: '',
  exchangeRate: 1,
  referenceNo: '',
  remark: '',
  orderTerm: '',
  location: '',
  subLocation: '',
  shipModeNo: -1,
  contactPerson: '',
  saleIncharge: '',
};

export const INITIAL_WORKSPACE_STATE: BulkCostWorkspaceState = {
  step: 'select',
  selectedLines: [],
  costs: { ...EMPTY_BULK_COST_INPUT },
  preview: null,
  isCalculating: false,
  isDirty: false,
};
