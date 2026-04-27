import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { corsOptions } from '#src/config/cors.js';
import { authMiddleware, requireCatalogAccess } from '#src/middleware/auth.middleware.js';
import { errorMiddleware, notFoundMiddleware } from '#src/middleware/error.middleware.js';
import { apiLimiter, writeLimiter } from '#src/middleware/rate-limit.middleware.js';
import { csrfProtection } from '#src/middleware/csrf.middleware.js';
import { readOnlyProtection } from '#src/middleware/read-only.middleware.js';
import routes from '#src/routes/index.js';
import { env } from '#src/config/env.js';

const app = express();

// Security middleware
app.use(helmet());
app.use(cors(corsOptions));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
if (env.isDev) {
    app.use(morgan('dev'));
} else {
    app.use(morgan('combined'));
}

// Health check remains outside authentication for load balancers/service monitors.
app.get('/api/health', (_req, res) => {
    res.json({
        success: true,
        data: {
            status: 'ok',
            timestamp: new Date().toISOString(),
            env: env.NODE_ENV,
        },
    });
});

// Rate limiting applies to all API routes.
app.use('/api', apiLimiter);
app.use('/api', (req, res, next) => {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
        writeLimiter(req, res, next);
        return;
    }
    next();
});

// CSRF protection requires X-Requested-With on mutation requests.
app.use('/api', csrfProtection(
    env.CORS_ALLOWED_ORIGINS
));

// Authentication and authorization
app.use('/api', authMiddleware);
app.use('/api', requireCatalogAccess);
app.use('/api', readOnlyProtection);

// API routes
app.use('/api', routes);

// Error handling
app.use(notFoundMiddleware);
app.use(errorMiddleware);

export default app;
