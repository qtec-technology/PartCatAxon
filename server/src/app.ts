import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { corsOptions } from '#src/config/cors.js';
import { authMiddleware } from '#src/middleware/auth.middleware.js';
import { errorMiddleware, notFoundMiddleware } from '#src/middleware/error.middleware.js';
import { apiLimiter } from '#src/middleware/rate-limit.middleware.js';
import { csrfProtection } from '#src/middleware/csrf.middleware.js';
import routes from '#src/routes/index.js';
import { env } from '#src/config/env.js';

// ─── Express App Setup ──────────────────────────────────────────────────────

const app = express();

// ── Security Middleware ──
app.use(helmet());
app.use(cors(corsOptions));

// ── Body Parsing ──
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Logging ──
if (env.isDev) {
    app.use(morgan('dev'));
} else {
    app.use(morgan('combined'));
}

// ── Rate Limiting (applies to all /api routes) ──
app.use('/api', apiLimiter);

// ── CSRF Protection (requires X-Requested-With on POST/PUT/DELETE) ──
app.use('/api', csrfProtection(
    env.CORS_ALLOWED_ORIGINS
));

// ── Authentication Middleware (applies to all /api routes) ──
app.use('/api', authMiddleware);

// ── API Routes ──
app.use('/api', routes);

// ── Health Check ──
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

// ── Error Handling ──
app.use(notFoundMiddleware);
app.use(errorMiddleware);

export default app;
