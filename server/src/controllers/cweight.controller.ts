import type { Request, Response, NextFunction } from 'express';
import { success } from '#src/utils/response.js';
import { resolveCWeightLookup } from '#src/services/cweight-lookup.service.js';
import type { ResolveCWeightBodyDTO } from '#src/dtos/cweight/cweight.request.schema.js';

/** POST /api/cweight/resolve */
export async function resolveCWeight(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const result = await resolveCWeightLookup(req.body as ResolveCWeightBodyDTO);
        res.json(success(result, 'OK'));
    } catch (err) {
        next(err);
    }
}
