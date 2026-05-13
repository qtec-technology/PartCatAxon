import type { ItemData } from '../../types/item_types';
import type { AllocationLineSource, DocumentFees } from './bulk-cost.types';

export type DocumentFeeKind = keyof DocumentFees;
export type DocumentFeeBasis = 'PER_EACH' | 'ITEM_TOTAL' | 'BY_LOT_BATCH';

export interface DocumentFeeInput {
  kind: DocumentFeeKind;
  amount: number;
  basis: DocumentFeeBasis;
  label?: string;
  quantity?: number | null;
}

export interface BulkCostDocumentFeeLineCandidate {
  lineKey: string;
  sourceLineKey: string;
  sourceLineNo: number;
  feeKind: DocumentFeeKind;
  description: string;
  qty: number;
  uom: string;
  unitPrice: number;
  amount: number;
  currency: string;
  itemGroup: string;
  itemCategory: string;
}

export interface DocumentFeeNormalizationResult {
  line: AllocationLineSource;
  separateLineCandidates: BulkCostDocumentFeeLineCandidate[];
}

const DOCUMENT_FEE_LABELS: Record<DocumentFeeKind, string> = {
  coc: 'COC',
  millCert: 'Mill Certificate',
  testCert: 'Test Certificate',
  coa: 'COA',
  coo: 'COO',
  anyOther: 'Document Fee',
};

const DOCUMENT_FEE_ITEM_GROUP = '107';
const DOCUMENT_FEE_ITEM_CATEGORY = 'Service';

export function normalizeDocumentFeesForLine(
  line: AllocationLineSource,
  fees: readonly DocumentFeeInput[],
): DocumentFeeNormalizationResult {
  const docFee: DocumentFees = { ...line.docFee };
  const separateLineCandidates: BulkCostDocumentFeeLineCandidate[] = [];

  fees.forEach((fee, index) => {
    const amount = round6(Number(fee.amount || 0));
    if (!Number.isFinite(amount) || amount === 0) return;

    const label = String(fee.label || DOCUMENT_FEE_LABELS[fee.kind]).trim();

    if (fee.basis === 'PER_EACH') {
      docFee[fee.kind] = round6(docFee[fee.kind] + amount);
      return;
    }

    if (fee.basis === 'ITEM_TOTAL') {
      const quantity = Number(fee.quantity ?? line.qty);
      if (!Number.isFinite(quantity) || quantity <= 0) {
        throw new Error(`Cannot normalize ${label}: quantity must be greater than zero`);
      }

      docFee[fee.kind] = round6(docFee[fee.kind] + (amount / quantity));
      return;
    }

    separateLineCandidates.push({
      lineKey: `${line.lineKey}-DOC-${fee.kind}-${index + 1}`,
      sourceLineKey: line.lineKey,
      sourceLineNo: line.no,
      feeKind: fee.kind,
      description: `${label} By Lot / Batch`,
      qty: 1,
      uom: 'EA',
      unitPrice: amount,
      amount,
      currency: line.currency,
      itemGroup: DOCUMENT_FEE_ITEM_GROUP,
      itemCategory: DOCUMENT_FEE_ITEM_CATEGORY,
    });
  });

  return {
    line: { ...line, docFee },
    separateLineCandidates,
  };
}

export function mapDocumentFeeCandidateToItemData(
  candidate: BulkCostDocumentFeeLineCandidate,
  source?: Pick<AllocationLineSource, 'vendorName' | 'manufacturer' | 'countryOfOrigin'>,
): ItemData {
  return {
    itemGroup: candidate.itemGroup,
    itemCategory: candidate.itemCategory,
    catalogNo: '',
    b1ItemNo: '',
    mfrBrand: source?.vendorName || source?.manufacturer || 'Document Fee',
    mfrCatalogNo: '',
    itemDescription: candidate.description,
    specialRequirement: '',
    customerStockCode: '',
    stockUOM: candidate.uom,
    countryOfOrigin: source?.countryOfOrigin || '_Null',
    eccn: '',
    unspsc: '',
    eProcurementCode: '',
    remark: `Generated from Bulk Cost ${candidate.feeKind} for source line ${candidate.sourceLineNo}. Sales can edit, delete, or redistribute manually before save.`,
    active: true,
    masterFG: false,
    shelfLifeRequired: false,
    punchOut: false,
    vmi: false,
    customerBPA: false,
    isQTECStock: false,
    serialRequired: false,
    sdsRequired: false,
    certificateRequired: true,
    eCommerce: false,
    b1Item: false,
    dgRequired: false,
    permitRequired: false,
    permitType: '',
    hsCode: '',
    longDesc1: '',
    longDesc2: '',
    longDesc3: '',
    longDesc4: '',
    generalSpec: '',
    referenceUrl: '',
    updatedBy: '',
    updatedDate: '',
    hasImage: false,
  };
}

function round6(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}
