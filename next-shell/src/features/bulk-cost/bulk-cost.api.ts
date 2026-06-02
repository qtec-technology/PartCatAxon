import { requestJson } from '@/services/http';
import type {
  AllocationLineResult,
  AllocationLineSource,
  AllocationPreview,
  AllocationRunStatus,
  BulkCostInput,
  BulkCostRunSummary,
  FinalResultColumns,
} from './bulk-cost.types';

export interface LoadedBulkCostRunLine {
  lineNo: number;
  lineKey: string;
  latestSnapshot: AllocationLineSource;
  originSnapshot: AllocationLineSource | null;
}

export interface LoadedBulkCostRunResponse {
  runId: number;
  revisionGroupId: number;
  revisionNo: number;
  revisionSourceRunId: number | null;
  status: AllocationRunStatus;
  vendorCode: string;
  vendorName: string;
  referenceNo: string;
  inputSnapshot: { costs?: BulkCostInput; [key: string]: unknown };
  previewSnapshot: AllocationPreview | null;
  lines: LoadedBulkCostRunLine[];
}

export interface SaveBulkCostRunRequest {
  sourceRunId?: number;
  supplierCode: string;
  supplierName: string;
  status: Extract<AllocationRunStatus, 'DRAFT'>;
  costs: BulkCostInput;
  originLines: AllocationLineSource[];
  latestLines: AllocationLineSource[];
  preview: AllocationPreview;
  lines: SaveBulkCostRunLine[];
}

export interface SaveBulkCostRunLine {
  lineKey: string;
  origin: AllocationLineSource | null;
  latest: AllocationLineSource;
  result: AllocationLineResult;
  axon: {
    uniqueLineId?: string;
    matchMethod?: string;
    matchConfidence?: number | null;
  };
}

export interface SaveBulkCostRunResponse {
  runId: number;
  revisionGroupId: number;
  revisionNo: number;
  revisionSourceRunId: number | null;
  status: AllocationRunStatus;
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

interface BuildBulkCostRunDraftPayloadArgs {
  sourceRunId?: number | null;
  supplierCode: string;
  supplierName: string;
  costs: BulkCostInput;
  originLines: AllocationLineSource[];
  latestLines: AllocationLineSource[];
  preview: AllocationPreview;
  getFinalResultForLine: (line: AllocationLineResult) => FinalResultColumns;
}

type LineWithFutureAxonHints = AllocationLineSource & {
  uniqueLineId?: string;
  matchMethod?: string;
  matchConfidence?: number | null;
};

function withEditedFinalResult(
  line: AllocationLineResult,
  finalResult: FinalResultColumns,
): AllocationLineResult {
  return {
    ...line,
    finalResult,
  };
}

function getAxonHints(line: AllocationLineSource): SaveBulkCostRunLine['axon'] {
  const future = line as LineWithFutureAxonHints;
  const uniqueLineId = line.axonUniqueLineId || future.uniqueLineId || line.lineKey;
  const matchMethod = line.axonMatchMethod || future.matchMethod || (line.itemCode ? 'ITEM_CODE_HINT' : 'NEW_ITEM_CANDIDATE');
  const matchConfidence = line.axonMatchConfidence ?? future.matchConfidence ?? null;

  return {
    uniqueLineId,
    matchMethod,
    matchConfidence,
  };
}

export function buildBulkCostRunDraftPayload({
  sourceRunId,
  supplierCode,
  supplierName,
  costs,
  originLines,
  latestLines,
  preview,
  getFinalResultForLine,
}: BuildBulkCostRunDraftPayloadArgs): SaveBulkCostRunRequest {
  const originByKey = new Map(originLines.map((line) => [line.lineKey, line]));
  const latestByKey = new Map(latestLines.map((line) => [line.lineKey, line]));

  const lines = preview.lines.map((line) => {
    const latest = latestByKey.get(line.lineKey);
    if (!latest) {
      throw new Error(`Cannot save Bulk Cost draft: latest line ${line.lineKey} was not found`);
    }

    const result = withEditedFinalResult(line, getFinalResultForLine(line));

    return {
      lineKey: line.lineKey,
      origin: originByKey.get(line.lineKey) ?? null,
      latest,
      result,
      axon: getAxonHints(latest),
    };
  });

  return {
    ...(sourceRunId ? { sourceRunId } : {}),
    supplierCode,
    supplierName,
    status: 'DRAFT',
    costs,
    originLines,
    latestLines,
    preview: {
      ...preview,
      lines: lines.map((line) => line.result),
    },
    lines,
  };
}

export async function calculateBulkCostPreview(payload: {
  costs: BulkCostInput;
  lines: AllocationLineSource[];
}): Promise<AllocationPreview> {
  const response = await requestJson<AllocationPreview>('/api/bulk-cost/calculate', {
    method: 'POST',
    body: payload,
  });
  return response.data;
}

export async function saveBulkCostRunDraft(payload: SaveBulkCostRunRequest): Promise<SaveBulkCostRunResponse> {
  const response = await requestJson<SaveBulkCostRunResponse>('/api/bulk-cost/runs', {
    method: 'POST',
    body: payload,
  });
  return response.data;
}

export interface BulkCostRunsPage {
  runs: BulkCostRunSummary[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export async function listBulkCostRuns(params: {
  status?: AllocationRunStatus;
  search?: string;
  saleIncharge?: string;
  page?: number;
  pageSize?: number;
}): Promise<BulkCostRunsPage> {
  const query = new URLSearchParams();
  if (params.status) query.set('status', params.status);
  if (params.search) query.set('search', params.search);
  if (params.saleIncharge) query.set('saleIncharge', params.saleIncharge);
  if (params.page) query.set('page', String(params.page));
  if (params.pageSize) query.set('pageSize', String(params.pageSize));
  const qs = query.toString();
  const response = await requestJson<BulkCostRunSummary[]>(`/api/bulk-cost/runs${qs ? `?${qs}` : ''}`);
  const meta = response.meta as { total?: number; page?: number; pageSize?: number; totalPages?: number } | undefined;
  const runs = response.data ?? [];
  const total = meta?.total ?? runs.length;
  const page = meta?.page ?? params.page ?? 1;
  const pageSize = meta?.pageSize ?? params.pageSize ?? 400;
  const totalPages = meta?.totalPages ?? Math.max(1, Math.ceil(total / pageSize));
  return { runs, total, page, pageSize, totalPages };
}

export async function loadBulkCostRun(runId: number): Promise<LoadedBulkCostRunResponse> {
  const response = await requestJson<LoadedBulkCostRunResponse>(`/api/bulk-cost/runs/${runId}`);
  return response.data;
}

export async function updateBulkCostRunStatus(
  runId: number,
  status: 'AWARDED' | 'LOST',
): Promise<void> {
  await requestJson(`/api/bulk-cost/runs/${runId}/status`, {
    method: 'PATCH',
    body: { status },
  });
}

// ─── Sandbox Finalize ────────────────────────────────────────────────────────

export interface SandboxFinalizeWritten {
  lineKey: string;
  sandboxItemId: number;
  sandboxTermId: number;
  reused?: boolean;
}

export interface SandboxFinalizeResult {
  success: boolean;
  written: SandboxFinalizeWritten[];
  errors: Array<{ lineKey: string; message: string; field?: string }>;
  sandboxDb: string;
}

/**
 * POST /api/bulk-cost/runs/:runId/sandbox-finalize
 * Writes Item/Term to PART_CATALOG_AIX mirror — Sandbox Finalize / Dry-run only.
 * NOT a production PartCatalog/SAP master write.
 */
export async function sandboxFinalizeLines(
  runId: number,
  user: string,
): Promise<SandboxFinalizeResult> {
  const response = await requestJson<SandboxFinalizeResult>(
    `/api/bulk-cost/runs/${runId}/sandbox-finalize`,
    { method: 'POST', body: { user } },
  );
  return response.data;
}
