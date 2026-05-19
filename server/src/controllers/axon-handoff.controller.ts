import type { Request, Response, NextFunction } from 'express';
import { success } from '#src/utils/response.js';
import { loadAxonComparison } from '#src/services/axon-handoff-operation.service.js';

/** GET /api/axon-handoff/comparisons/:chainId */
export async function getComparisonByChainId(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const chainId = String(req.params['chainId'] || '').trim();
        if (!chainId) {
            res.status(400).json({ success: false, message: 'ChainId is required' });
            return;
        }

        const comparisonRevision = typeof req.query['revision'] === 'string'
            ? req.query['revision'].trim()
            : undefined;

        const comparison = await loadAxonComparison({ chainId, comparisonRevision });
        if (!comparison) {
            res.status(404).json({ success: false, message: `AXON comparison not found for ChainId ${chainId}` });
            return;
        }

        res.json(success(comparison, 'OK'));
    } catch (err) {
        next(err);
    }
}
