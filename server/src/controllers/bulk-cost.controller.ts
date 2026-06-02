import type { Request, Response, NextFunction } from 'express';
import { success } from '#src/utils/response.js';
import { resolveUpdatedByFirstName } from '#src/utils/auth.js';
import * as bulkCostOps from '#src/services/bulk-cost-operation.service.js';
import { calculateBulkCostPreview } from '#src/services/bulk-cost-calculation.service.js';
import { resolveBulkCostCWeightPrefill } from '#src/services/bulk-cost-cweight.service.js';
import { sandboxFinalizeRun } from '#src/services/sandbox-finalize.service.js';
import type {
    CalculateBulkCostBodyDTO,
    BulkCostCWeightPrefillBodyDTO,
    ListBulkCostRunsQueryDTO,
    SaveBulkCostRunBodyDTO,
    UpdateBulkCostRunStatusBodyDTO,
} from '#src/dtos/bulk-cost/bulk-cost.request.schema.js';

/** POST /api/bulk-cost/calculate */
export async function calculateBulkCost(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const body = req.body as CalculateBulkCostBodyDTO;
        const preview = calculateBulkCostPreview(body);
        res.json(success(preview, 'OK'));
    } catch (err) {
        next(err);
    }
}

/** POST /api/bulk-cost/runs */
export async function createBulkCostRun(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const body = req.body as SaveBulkCostRunBodyDTO;
        const actor = bulkCostOps.humanActor(resolveUpdatedByFirstName(req));
        const saved = await bulkCostOps.saveBulkCostDraft(body, actor);
        res.status(201).json(success(saved, 'Bulk Cost draft saved'));
    } catch (err) {
        next(err);
    }
}

/** POST /api/bulk-cost/cweight-prefill */
export async function resolveCWeightPrefill(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const body = req.body as BulkCostCWeightPrefillBodyDTO;
        const suggestions = await resolveBulkCostCWeightPrefill(body);
        res.json(success(suggestions, 'OK'));
    } catch (err) {
        next(err);
    }
}

/** GET /api/bulk-cost/runs */
export async function getRunsList(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const query = req.query as unknown as ListBulkCostRunsQueryDTO;
        const page = Number(query.page ?? 1);
        const pageSize = Number(query.pageSize ?? 400);
        const { runs, total } = await bulkCostOps.listBulkCostRuns({
            status: query.status,
            search: query.search,
            saleIncharge: query.saleIncharge,
            page,
            pageSize,
        });
        res.json({
            success: true,
            data: runs,
            meta: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
        });
    } catch (err) {
        next(err);
    }
}

/** GET /api/bulk-cost/runs/:id */
export async function getRunById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const runId = Number(req.params['id']);
        if (!Number.isInteger(runId) || runId <= 0) {
            res.status(400).json({ success: false, message: 'Invalid run ID' });
            return;
        }
        const run = await bulkCostOps.loadBulkCostRun(runId);
        if (!run) {
            res.status(404).json({ success: false, message: `Run #${runId} not found` });
            return;
        }
        res.json(success(run, 'OK'));
    } catch (err) {
        next(err);
    }
}

/** PATCH /api/bulk-cost/runs/:id/status */
export async function updateRunStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const runId = Number(req.params['id']);
        if (!Number.isInteger(runId) || runId <= 0) {
            res.status(400).json({ success: false, message: 'Invalid run ID' });
            return;
        }
        const body = req.body as UpdateBulkCostRunStatusBodyDTO;
        const actor = bulkCostOps.humanActor(resolveUpdatedByFirstName(req));
        await bulkCostOps.markBulkCostRunStatus(runId, body.status, actor);
        res.json(success(null, `Run #${runId} marked as ${body.status}`));
    } catch (err) {
        next(err);
    }
}

/**
 * POST /api/bulk-cost/runs/:id/sandbox-finalize
 * Sandbox Finalize — writes Item/Term to PART_CATALOG_AIX mirror
 * (dry-run, NOT PartCatalog/SAP production).
 */
export async function sandboxFinalizeRunHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const runId = Number(req.params['id']);
        if (!Number.isInteger(runId) || runId <= 0) {
            res.status(400).json({ success: false, message: 'Invalid run ID' });
            return;
        }
        const writtenBy = resolveUpdatedByFirstName(req) || (req.body as { user?: string }).user || 'unknown';
        const result = await sandboxFinalizeRun(runId, writtenBy);
        res.status(result.success ? 200 : 207).json(success(result, result.success
            ? `Sandbox Finalize: ${result.written.length} item(s) written to ${result.sandboxDb}`
            : `Sandbox Finalize completed with ${result.errors.length} error(s)`,
        ));
    } catch (err) {
        next(err);
    }
}
