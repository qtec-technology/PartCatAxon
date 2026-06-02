// ─── Bulk Cost Run — shared API contract ────────────────────────────────────
// Identical shape in server/src/types/bulk-cost.types.ts and
// next-shell/src/features/bulk-cost/bulk-cost.types.ts

export const BULK_COST_RUN_STATUSES = [
  'DRAFT',
  'QUOTED',
  'AWARDED',
  'REVERSE_MAPPED',
  'LOST',
  'ARCHIVED',
] as const;

export type BulkCostRunStatus = (typeof BULK_COST_RUN_STATUSES)[number];

export interface BulkCostRunSummary {
  runId: number;
  revisionGroupId: number;
  revisionNo: number;
  revisionSourceRunId: number | null;
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

export interface SaveBulkCostRunInput {
  sourceRunId?: number;
  supplierCode: string;
  supplierName?: string;
  status: 'DRAFT';
  costs: Record<string, unknown>;
  originLines: Record<string, unknown>[];
  latestLines: Record<string, unknown>[];
  preview: Record<string, unknown>;
  lines: SaveBulkCostDraftLineInput[];
}

export interface SaveBulkCostDraftLineInput {
  lineKey: string;
  origin: Record<string, unknown> | null;
  latest: Record<string, unknown>;
  result: Record<string, unknown>;
  axon?: BulkCostAxonHints;
}

export interface BulkCostAxonHints {
  uniqueLineId?: string;
  matchMethod?: string;
  matchConfidence?: number | null;
}
