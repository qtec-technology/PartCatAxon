import { Request, Response } from 'express';
import path from 'node:path';
import fs from 'node:fs/promises';
import type { WhoAmIResponseDTO } from '#src/dtos/auth/auth.response.dto.js';
import { success } from '#src/utils/response.js';
import { env } from '#src/config/env.js';
import { logger } from '#src/utils/logger.js';

// ─── Constants ──────────────────────────────────────────────────────────────

/** Network share path for user profile pictures (from .env) */
const USER_PICTURE_BASE = env.USER_PICTURE_DIR;

// ─── Auth Controller ────────────────────────────────────────────────────────

/** GET /api/auth/whoami — Return current authenticated user */
export function whoami(req: Request, res: Response) {
    const user = req.authUser;
    const payload: WhoAmIResponseDTO = {
        username: user?.username || 'Guest',
        firstname: user?.firstname || '',
        lastname: user?.lastname || '',
        displayName: user?.displayName || 'Guest',
        email: user?.email || '',
        domain: user?.domain || '',
        isAdmin: user?.isManager || false,
        hasAccess: !!(user?.isManager || user?.isSupervisor),
        isManager: user?.isManager || false,
        isSupervisor: user?.isSupervisor || false,
    };
    res.json(success(payload));
}

/** GET /api/auth/user-picture — Serve current user's profile picture */
export async function getUserPicture(req: Request, res: Response) {
    try {
        if (!USER_PICTURE_BASE) {
            res.status(404).json({ success: false, error: 'User picture directory is not configured' });
            return;
        }

        const username = (req.authUser?.username || '').trim();
        if (!username || username === 'Guest') {
            res.status(404).json({ success: false, error: 'No user' });
            return;
        }

        // Path traversal protection: strip any path separators from username
        const safeUsername = username.replace(/[\\/:*?"<>|.]/g, '');
        if (!safeUsername) {
            res.status(400).json({ success: false, error: 'Invalid username' });
            return;
        }

        const filePath = path.join(USER_PICTURE_BASE, `${safeUsername}.JPG`);

        // Verify the resolved path is still inside the base directory
        const resolvedBase = path.resolve(USER_PICTURE_BASE);
        const resolvedFile = path.resolve(filePath);
        if (!resolvedFile.startsWith(resolvedBase)) {
            res.status(403).json({ success: false, error: 'Path traversal blocked' });
            return;
        }

        // Check file exists
        try {
            await fs.access(filePath);
        } catch {
            res.status(404).json({ success: false, error: 'Picture not found' });
            return;
        }

        // Read and send as JPEG
        const imageBuffer = await fs.readFile(filePath);
        res.set({
            'Content-Type': 'image/jpeg',
            'Content-Length': String(imageBuffer.length),
            'Cache-Control': 'private, max-age=86400', // Cache 1 day
        });
        res.send(imageBuffer);
    } catch (err) {
        logger.error('Failed to read user picture', err instanceof Error ? err : undefined);
        res.status(500).json({ success: false, error: 'Failed to read picture' });
    }
}
