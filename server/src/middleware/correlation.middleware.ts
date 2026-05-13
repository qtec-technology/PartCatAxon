import { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';

/**
 * Attach a correlation ID to every request for end-to-end tracing.
 *
 * - Reuses incoming X-Correlation-Id if present (for cross-service tracing).
 * - Otherwise generates a new random UUID.
 * - Echoes the ID back in the response header.
 * - Stores the ID on req.correlationId for use in downstream logging.
 */
export function correlationMiddleware(req: Request, _res: Response, next: NextFunction): void {
    const existing = req.headers['x-correlation-id'];
    const correlationId = (typeof existing === 'string' && existing.trim())
        ? existing.trim()
        : crypto.randomUUID();

    req.correlationId = correlationId;
    next();
}

/**
 * Set the X-Correlation-Id response header.
 * Registered separately so it runs after routing (ensures the header
 * appears even on error responses handled by errorMiddleware).
 */
export function correlationResponseHeader(req: Request, res: Response, next: NextFunction): void {
    if (req.correlationId) {
        res.setHeader('X-Correlation-Id', req.correlationId);
    }
    next();
}
