import { Request, Response, NextFunction } from 'express';
import os from 'node:os';
import { env } from '#src/config/env.js';
import type { AuthUser } from '#src/types/common.types.js';
import { logger } from '#src/utils/logger.js';

// Role lists parsed once at startup from env for non-production role simulation.
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
const ROLE_USERS = new Set(
    (process.env.ROLE_USERS || '')
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
);

function checkRole(username: string, roleSet: Set<string>): boolean {
    if (roleSet.size === 0) return false;
    return roleSet.has(username.toLowerCase());
}

function normalizeRoleName(value: unknown): string {
    return String(value || '')
        .trim()
        .replace(/^cn=/i, '')
        .split(',')[0]
        .trim()
        .toLowerCase();
}

function collectStringValues(value: unknown, output: string[]): void {
    if (!value) return;
    if (Array.isArray(value)) {
        value.forEach((item) => collectStringValues(item, output));
        return;
    }
    if (typeof value === 'object') {
        Object.entries(value as Record<string, unknown>).forEach(([key, item]) => {
            if (item === true || String(item).toLowerCase() === 'true') {
                output.push(key);
                return;
            }
            collectStringValues(item, output);
        });
        return;
    }
    String(value)
        .split(/[;,]/)
        .map((item) => item.trim())
        .filter(Boolean)
        .forEach((item) => output.push(item));
}

function collectAuthGroups(parsed: Record<string, unknown>): string[] {
    const values: string[] = [];
    collectStringValues(parsed.groups, values);
    collectStringValues(parsed.memberOf, values);
    collectStringValues(parsed.member_of, values);
    collectStringValues(parsed.roles, values);
    collectStringValues(parsed.adGroups, values);
    collectStringValues(parsed.ad_groups, values);

    const permissions = parsed.permissions;
    if (permissions && typeof permissions === 'object') {
        collectStringValues((permissions as Record<string, unknown>).groups, values);
        collectStringValues((permissions as Record<string, unknown>).roles, values);
    }

    return [...new Set(values.map(normalizeRoleName).filter(Boolean))];
}

function groupMatches(userGroups: string[], configuredGroups: readonly string[]): boolean {
    if (userGroups.length === 0 || configuredGroups.length === 0) return false;
    const configured = new Set(configuredGroups.map(normalizeRoleName).filter(Boolean));
    return userGroups.some((group) => configured.has(group));
}

function booleanPermission(permissions: Record<string, unknown> | undefined, keys: string[]): boolean {
    if (!permissions) return false;
    return keys.some((key) => permissions[key] === true || String(permissions[key]).toLowerCase() === 'true');
}

// Dev-mode: cache local user info (no need to look up every request)
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
 *   - Uses Node.js os.userInfo() (cached; no child process spawning)
 *
 * Role check:
 *   - Production: uses Windows Auth permissions only
 *   - Non-production: uses ROLE_MANAGERS / ROLE_SUPERVISORS env vars
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
    try {
        let username = 'Guest';
        let firstname = '';
        let lastname = '';
        let displayName = 'Guest';
        let email = '';
        let domain = '';
        let isUser = false;
        let isManager = false;
        let isSupervisor = false;

        if (env.isProd) {
            // ── Production: Read from Windows Authentication headers ──
            const authHeaderJson = req.headers['x-iisnode-auth-user'] as string || '';

            if (authHeaderJson) {
                try {
                    const parsed = JSON.parse(authHeaderJson) as Record<string, unknown>;
                    username = String(parsed.username || '').trim() || 'Guest';
                    firstname = String(parsed.firstname || '').trim();
                    lastname = String(parsed.lastname || '').trim();
                    displayName = String(parsed.displayName || '').trim() || username;
                    email = String(parsed.email || '').trim();
                    const fullUser = String(parsed.full_user || '').trim();
                    domain = fullUser.includes('\\') ? fullUser.split('\\')[0] : '';

                    const permissions = parsed.permissions && typeof parsed.permissions === 'object'
                        ? parsed.permissions as Record<string, unknown>
                        : undefined;
                    const groups = collectAuthGroups(parsed);

                    isManager =
                        booleanPermission(permissions, ['is_manager', 'manager', 'pcat_manager']) ||
                        groupMatches(groups, env.AUTH_MANAGER_GROUPS);
                    isSupervisor =
                        booleanPermission(permissions, ['is_supervisor', 'supervisor', 'pcat_supervisor']) ||
                        groupMatches(groups, env.AUTH_SUPERVISOR_GROUPS);
                    isUser =
                        booleanPermission(permissions, ['is_user', 'part_catalog_user', 'pcat_user']) ||
                        groupMatches(groups, env.AUTH_USER_GROUPS);
                } catch {
                    // JSON parse failed; fall through to x-remote-user.
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

            if (username !== 'Guest' && env.AUTH_ALLOW_DOMAIN_USERS) {
                isUser = true;
            }
        } else {
            // Non-production: Use cached local user + optional DEV_ env vars
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
            isUser = ROLE_USERS.size > 0 ? checkRole(username, ROLE_USERS) : true;
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
            isUser,
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
            isUser: false,
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

const CATALOG_ACCESS_BYPASS_ROUTES = new Set([
    'GET /auth/whoami',
]);

function isCatalogAccessBypass(req: Request): boolean {
    return CATALOG_ACCESS_BYPASS_ROUTES.has(`${req.method.toUpperCase()} ${req.path}`);
}

/**
 * Require Part Catalog access.
 */
export function requireCatalogAccess(req: Request, res: Response, next: NextFunction): void {
    if (isCatalogAccessBypass(req)) {
        next();
        return;
    }

    const user = req.authUser;
    const hasAccess = !!(
        user &&
        user.username !== 'Guest' &&
        (user.isUser || user.isManager || user.isSupervisor)
    );

    if (!hasAccess) {
        res.status(403).json({ success: false, error: 'Part Catalog access required' });
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

