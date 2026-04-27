import type { NextFunction, Request, Response } from 'express';
import { env } from '#src/config/env.js';

const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const READ_ONLY_POST_ALLOWLIST = new Set([
    '/terms/calculate',
]);

function isAllowedReadOnlyRequest(req: Request): boolean {
    if (!MUTATION_METHODS.has(req.method)) return true;
    if (req.method === 'POST' && READ_ONLY_POST_ALLOWLIST.has(req.path)) return true;
    return false;
}

export function readOnlyProtection(req: Request, res: Response, next: NextFunction): void {
    if (!env.SERVER_READ_ONLY || isAllowedReadOnlyRequest(req)) {
        next();
        return;
    }

    res.status(423).json({
        success: false,
        error: 'Part Catalog is in read-only mode',
    });
}
