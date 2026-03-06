import { Request, Response, NextFunction } from 'express';
import { env } from '#src/config/env.js';
import { logger } from '#src/utils/logger.js';

/**
 * Global error handler — catches all unhandled errors.
 * Returns standardized JSON API response.
 */
export function errorMiddleware(
    err: Error,
    _req: Request,
    res: Response,
    _next: NextFunction
): void {
    logger.error('Unhandled server error', err);

    const statusCode = (err as any).statusCode || 500;
    const message = env.isDev
        ? err.message || 'Internal Server Error'
        : 'Internal Server Error';

    res.status(statusCode).json({
        success: false,
        error: message,
        ...(env.isDev && { stack: err.stack }),
    });
}

/**
 * 404 handler — catch-all for unmatched routes.
 */
export function notFoundMiddleware(req: Request, res: Response): void {
    res.status(404).json({
        success: false,
        error: `Route not found: ${req.method} ${req.originalUrl}`,
    });
}
