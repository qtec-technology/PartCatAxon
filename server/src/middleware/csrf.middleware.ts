import { Request, Response, NextFunction } from 'express';

/**
 * CSRF Protection Middleware.
 *
 * Since this app uses a REST API consumed by a browser SPA (same origin),
 * we protect mutation endpoints by requiring a custom header.
 *
 * How it works:
 * - Browsers automatically include Origin/Referer headers on cross-origin requests.
 * - Custom headers (like X-Requested-With) CANNOT be sent cross-origin
 *   without a CORS preflight that our server would reject.
 * - Therefore, if the X-Requested-With header is present, the request
 *   genuinely came from our own frontend JavaScript.
 *
 * This middleware:
 * 1. Only applies to state-changing methods (POST, PUT, DELETE, PATCH).
 * 2. Requires the `X-Requested-With: XMLHttpRequest` header.
 * 3. Validates the Origin header against allowed origins (if present).
 *
 * GET/HEAD/OPTIONS are always allowed (safe/idempotent methods).
 */
export function csrfProtection(allowedOrigins: string[]) {
    const normalizedOrigins = new Set(
        allowedOrigins.map((o) => o.trim().toLowerCase().replace(/\/$/, ''))
    );

    return (req: Request, res: Response, next: NextFunction): void => {
        // Safe methods — no CSRF check needed
        const safeMethod = ['GET', 'HEAD', 'OPTIONS'].includes(req.method.toUpperCase());
        if (safeMethod) {
            next();
            return;
        }

        // 1. Require X-Requested-With header (blocks simple cross-origin forms)
        const xRequestedWith = req.headers['x-requested-with'];
        if (!xRequestedWith || String(xRequestedWith).toLowerCase() !== 'xmlhttprequest') {
            res.status(403).json({
                success: false,
                error: 'CSRF check failed: missing X-Requested-With header',
            });
            return;
        }

        // 2. Validate Origin header (if present)
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
