import rateLimit from 'express-rate-limit';

/**
 * General API rate limiter.
 * Limits each IP to 500 requests per 15-minute window.
 */
export const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,  // 15 minutes
    max: 500,
    message: { success: false, error: 'Too many requests, please try again later' },
    standardHeaders: true,
    legacyHeaders: false,
});

/**
 * Stricter rate limiter for write operations (POST, PUT, DELETE).
 * Limits each IP to 30 write requests per 1-minute window.
 */
export const writeLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,   // 1 minute
    max: 30,
    message: { success: false, error: 'Too many write requests, please slow down' },
    standardHeaders: true,
    legacyHeaders: false,
});
