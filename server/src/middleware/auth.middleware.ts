import { Request, Response, NextFunction } from 'express';
import os from 'node:os';
import { env } from '#src/config/env.js';
import type { AuthUser } from '#src/types/common.types.js';
import { logger } from '#src/utils/logger.js';

// ── Role lists parsed once at startup from env ──────────────────────────────
const ROLE_MANAGERS = new Set(
    (process.env.ROLE_MANAGERS || '')
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
);
const ROLE_SUPERVISORS = new Set(
    (process.env.ROLE_SUPERVISORS || '')
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
);

function checkRole(username: string, roleSet: Set<string>): boolean {
    if (roleSet.size === 0) return false;
    return roleSet.has(username.toLowerCase());
}

// ── Dev-mode: cache local user info (no need to look up every request) ──────
let _cachedDevUser: { username: string; domain: string } | null = null;

function getDevUser(): { username: string; domain: string } {
    if (_cachedDevUser) return _cachedDevUser;
    try {
        const username = os.userInfo().username || 'DevUser';
        const domain = process.env.USERDOMAIN || process.env.COMPUTERNAME || '';
        _cachedDevUser = { username, domain };
    } catch {
        _cachedDevUser = { username: 'DevUser', domain: '' };
    }
    return _cachedDevUser;
}

/**
 * Authentication Middleware
 *
 * Production (IIS + Windows Authentication):
 *   - IIS handles Windows Authentication via Negotiate/NTLM
 *   - Win Auth data comes as JSON in x-iisnode-auth-user header
 *     Format: { username, firstname, lastname, displayName, email, full_user, permissions, database_name }
 *   - Fallback: x-remote-user header (DOMAIN\username format)
 *
 * Development:
 *   - Uses Node.js os.userInfo() (cached — no child process spawning)
 *
 * Role check:
 *   - Production: uses permissions.is_manager / is_supervisor from Win Auth
 *   - Development: uses ROLE_MANAGERS / ROLE_SUPERVISORS env vars
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
    try {
        let username = 'Guest';
        let firstname = '';
        let lastname = '';
        let displayName = 'Guest';
        let email = '';
        let domain = '';
        let isManager = false;
        let isSupervisor = false;

        if (env.isProd) {
            // ── Production: Read from Windows Authentication headers ──
            const authHeaderJson = req.headers['x-iisnode-auth-user'] as string || '';

            if (authHeaderJson) {
                try {
                    const parsed = JSON.parse(authHeaderJson);
                    username = String(parsed.username || '').trim() || 'Guest';
                    firstname = String(parsed.firstname || '').trim();
                    lastname = String(parsed.lastname || '').trim();
                    displayName = String(parsed.displayName || '').trim() || username;
                    email = String(parsed.email || '').trim();
                    const fullUser = String(parsed.full_user || '').trim();
                    domain = fullUser.includes('\\') ? fullUser.split('\\')[0] : '';

                    // Permissions from Windows Auth
                    if (parsed.permissions) {
                        isManager = parsed.permissions.is_manager === true;
                        isSupervisor = parsed.permissions.is_supervisor === true;
                    }
                } catch {
                    // JSON parse failed — fall through to x-remote-user
                }
            }

            // Fallback: x-remote-user header (DOMAIN\username)
            if (username === 'Guest') {
                const remoteUser = req.headers['x-remote-user'] as string || '';
                if (remoteUser) {
                    const parts = remoteUser.split('\\');
                    domain = parts.length > 1 ? parts[0] : '';
                    username = parts.length > 1 ? parts[1] : parts[0];
                    displayName = username;
                    firstname = username;
                }
            }

            // Fallback role check from env vars (if permissions not in header)
            if (!isManager) isManager = checkRole(username, ROLE_MANAGERS);
            if (!isSupervisor) isSupervisor = checkRole(username, ROLE_SUPERVISORS);
        } else {
            // ── Development: Use cached local user + optional DEV_ env vars ──
            const devUser = getDevUser();
            username = devUser.username;
            domain = devUser.domain;

            // DEV_DISPLAY_NAME allows simulating full name (e.g. "Kittipat Milawan")
            const devDisplayName = (process.env.DEV_DISPLAY_NAME || '').trim();
            if (devDisplayName) {
                displayName = devDisplayName;
                const parts = devDisplayName.split(/\s+/);
                firstname = parts[0] || username;
                lastname = parts.slice(1).join(' ');
            } else {
                firstname = username.charAt(0).toUpperCase() + username.slice(1);
                lastname = '';
                displayName = firstname;
            }

            email = (process.env.DEV_EMAIL || '').trim();
            isManager = checkRole(username, ROLE_MANAGERS);
            isSupervisor = checkRole(username, ROLE_SUPERVISORS);
        }

        // Ensure firstname has a value (fallback from displayName)
        if (!firstname) {
            firstname = displayName.split(/\s+/)[0] || username;
        }

        const authUser: AuthUser = {
            username,
            firstname,
            lastname,
            displayName,
            email,
            domain,
            isManager,
            isSupervisor,
        };

        req.authUser = authUser;
        next();
    } catch (err) {
        logger.error('Auth middleware error', err instanceof Error ? err : undefined);
        req.authUser = {
            username: 'Guest',
            firstname: 'Guest',
            lastname: '',
            displayName: 'Guest',
            email: '',
            domain: '',
            isManager: false,
            isSupervisor: false,
        };
        next();
    }
}


/**
 * Require authentication (block if no user)
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
    if (!req.authUser || req.authUser.username === 'Guest') {
        res.status(401).json({ success: false, error: 'Authentication required' });
        return;
    }
    next();
}

/**
 * Require Manager role
 */
export function requireManager(req: Request, res: Response, next: NextFunction): void {
    if (!req.authUser?.isManager) {
        res.status(403).json({ success: false, error: 'Manager access required' });
        return;
    }
    next();
}
