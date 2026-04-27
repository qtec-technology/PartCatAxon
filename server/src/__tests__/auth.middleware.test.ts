import { describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import { requireCatalogAccess } from '#src/middleware/auth.middleware.js';

function makeResponse() {
    const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
    };
    return res as unknown as Response & {
        status: ReturnType<typeof vi.fn>;
        json: ReturnType<typeof vi.fn>;
    };
}

describe('requireCatalogAccess', () => {
    it('allows whoami so UAT can diagnose role mapping failures', () => {
        const req = {
            method: 'GET',
            path: '/auth/whoami',
            authUser: {
                username: 'Guest',
                firstname: 'Guest',
                lastname: '',
                displayName: 'Guest',
                email: '',
                domain: '',
                isUser: false,
                isManager: false,
                isSupervisor: false,
            },
        } as unknown as Request;
        const res = makeResponse();
        const next = vi.fn() as NextFunction;

        requireCatalogAccess(req, res, next);

        expect(next).toHaveBeenCalledOnce();
        expect(res.status).not.toHaveBeenCalled();
    });

    it('blocks other API routes when the authenticated user has no catalog role', () => {
        const req = {
            method: 'GET',
            path: '/items',
            authUser: {
                username: 'some.user',
                firstname: 'Some',
                lastname: 'User',
                displayName: 'Some User',
                email: '',
                domain: 'QTEC',
                isUser: false,
                isManager: false,
                isSupervisor: false,
            },
        } as unknown as Request;
        const res = makeResponse();
        const next = vi.fn() as NextFunction;

        requireCatalogAccess(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            error: 'Part Catalog access required',
        });
    });
});
