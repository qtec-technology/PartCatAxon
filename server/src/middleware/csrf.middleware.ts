import { Request, Response, NextFunction } from 'express';

/**
 * CSRF protection for the browser SPA.
 *
 * Mutation requests must include X-Requested-With. Cross-origin forms cannot
 * send that header without a CORS preflight, which this server restricts.
 */
export function csrfProtection(allowedOrigins: string[]) {
    const normalizedOrigins = new Set(
        allowedOrigins.map((o) => o.trim().toLowerCase().replace(/\/$/, ''))
    );

    return (req: Request, res: Response, next: NextFunction): void => {
        const safeMethod = ['GET', 'HEAD', 'OPTIONS'].includes(req.method.toUpperCase());
        if (safeMethod) {
            next();
            return;
        }

        const xRequestedWith = req.headers['x-requested-with'];
        if (!xRequestedWith || String(xRequestedWith).toLowerCase() !== 'xmlhttprequest') {
            res.status(403).json({
                success: false,
                error: 'CSRF check failed: missing X-Requested-With header',
            });
            return;
        }

        const origin = req.headers['origin'];
        if (origin) {
            const normalizedOrigin = String(origin).trim().toLowerCase().replace(/\/$/, '');
            if (!normalizedOrigins.has(normalizedOrigin)) {
                res.status(403).json({
                    success: false,
                    error: 'CSRF check failed: origin not allowed',
                });
                return;
            }
        }

        next();
    };
}
