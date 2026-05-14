import type { Request, Response, NextFunction } from 'express';
import { success } from '#src/utils/response.js';
import { resolveUpdatedByFirstName } from '#src/utils/auth.js';
import * as bulkCostRepo from '#src/repositories/bulk-cost.repository.js';
import { resolveBulkCostCWeightPrefill } from '#src/services/bulk-cost-cweight.service.js';
import type {
    BulkCostCWeightPrefillBodyDTO,
    ListBulkCostRunsQueryDTO,
    SaveBulkCostRunBodyDTO,
    UpdateBulkCostRunStatusBodyDTO,
} from '#src/dtos/bulk-cost/bulk-cost.request.schema.js';

/** GET /api/bulk-cost/queue */
export async function getQueueItems(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const items = await bulkCostRepo.listAxonQueueItems();
        res.json(success(items, 'OK'));
    } catch (err) {
        next(err);
    }
}

/** POST /api/bulk-cost/runs */
export async function createBulkCostRun(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const body = req.body as SaveBulkCostRunBodyDTO;
        const actorName = resolveUpdatedByFirstName(req);
        const saved = await bulkCostRepo.createBulkCostRun(body, actorName);
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
        const { runs, total } = await bulkCostRepo.listBulkCostRuns({
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
        const run = await bulkCostRepo.loadBulkCostRun(runId);
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
        const actorName = resolveUpdatedByFirstName(req);
        await bulkCostRepo.updateBulkCostRunStatus(runId, body.status, actorName);
        res.json(success(null, `Run #${runId} marked as ${body.status}`));
    } catch (err) {
        next(err);
    }
}
