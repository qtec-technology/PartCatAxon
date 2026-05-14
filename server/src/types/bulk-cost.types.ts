import type { HeaderCostSuggestions } from '#src/services/axon-payload.service.js';

export const BULK_COST_RUN_STATUSES = ['DRAFT', 'QUOTED', 'AWARDED', 'REVERSE_MAPPED', 'LOST', 'ARCHIVED'] as const;

export type BulkCostRunStatus = (typeof BULK_COST_RUN_STATUSES)[number];

export const AXON_QUEUE_STATUSES = ['PENDING', 'OPENED', 'PROCESSED', 'REJECTED'] as const;
export type AxonQueueStatus = (typeof AXON_QUEUE_STATUSES)[number];

export interface AxonQueueItem {
    queueId: number;
    sourceFileId: string;
    sourceFileName: string | null;
    documentType: string | null;
    documentNo: string | null;
    documentDate: string | null;
    supplierRawName: string;
    supplierCodeHint: string | null;
    supplierConfidence: number | null;
    currency: string | null;
    purchaseTerm: string | null;
    termLocation: string | null;
    totalLines: number;
    status: AxonQueueStatus;
    receivedAt: string;
    openedAt: string | null;
    openedBy: string | null;
    runId: number | null;
    headerCostSuggestions: HeaderCostSuggestions | null;
}

export interface BulkCostRunSummary {
    runId: number;
    status: BulkCostRunStatus;
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

export interface LoadedBulkCostRunLine {
    lineNo: number;
    lineKey: string;
    latestSnapshot: Record<string, unknown>;
    originSnapshot: Record<string, unknown> | null;
}

export interface LoadedBulkCostRun {
    runId: number;
    status: BulkCostRunStatus;
    vendorCode: string;
    vendorName: string;
    referenceNo: string;
    inputSnapshot: Record<string, unknown>;
    previewSnapshot: Record<string, unknown> | null;
    lines: LoadedBulkCostRunLine[];
}

export interface BulkCostAxonHints {
    uniqueLineId?: string;
    matchMethod?: string;
    matchConfidence?: number | null;
}

export interface SaveBulkCostDraftLineInput {
    lineKey: string;
    origin: Record<string, unknown> | null;
    latest: Record<string, unknown>;
    result: Record<string, unknown>;
    axon?: BulkCostAxonHints;
}

export interface SaveBulkCostRunInput {
    supplierCode: string;
    supplierName?: string;
    status: 'DRAFT';
    costs: Record<string, unknown>;
    originLines: Record<string, unknown>[];
    latestLines: Record<string, unknown>[];
    preview: Record<string, unknown>;
    lines: SaveBulkCostDraftLineInput[];
}

export interface SavedBulkCostRun {
    runId: number;
    status: BulkCostRunStatus;
    supplierCode: string;
    supplierName: string;
    referenceNo: string;
    currency: string;
    exchangeRate: number;
    orderTerm: string;
    location: string;
    shipModeNo: number | null;
    totalLines: number;
    totalQty: number;
    totalAmount: number;
    totalWeight: number;
    lineCount: number;
    createdBy: string;
    createdAt: string;
    updatedBy: string;
    updatedAt: string;
}
