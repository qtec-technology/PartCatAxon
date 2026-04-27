import { Request, Response } from 'express';
import path from 'node:path';
import fs from 'node:fs/promises';
import type { WhoAmIResponseDTO } from '#src/dtos/auth/auth.response.dto.js';
import { success } from '#src/utils/response.js';
import { env } from '#src/config/env.js';
import { logger } from '#src/utils/logger.js';

const USER_PICTURE_BASE = env.USER_PICTURE_DIR;

/** GET /api/auth/whoami - return current authenticated user and role flags. */
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
        hasAccess: !!(user?.isUser || user?.isManager || user?.isSupervisor),
        isUser: user?.isUser || false,
        isManager: user?.isManager || false,
        isSupervisor: user?.isSupervisor || false,
    };
    res.json(success(payload));
}

/** GET /api/auth/user-picture - serve current user's profile picture. */
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

        const safeUsername = username.replace(/[\\/:*?"<>|.]/g, '');
        if (!safeUsername) {
            res.status(400).json({ success: false, error: 'Invalid username' });
            return;
        }

        const filePath = path.join(USER_PICTURE_BASE, `${safeUsername}.JPG`);
        const resolvedBase = path.resolve(USER_PICTURE_BASE);
        const resolvedFile = path.resolve(filePath);
        if (!resolvedFile.startsWith(resolvedBase)) {
            res.status(403).json({ success: false, error: 'Path traversal blocked' });
            return;
        }

        try {
            await fs.access(filePath);
        } catch {
            res.status(404).json({ success: false, error: 'Picture not found' });
            return;
        }

        const imageBuffer = await fs.readFile(filePath);
        res.set({
            'Content-Type': 'image/jpeg',
            'Content-Length': String(imageBuffer.length),
            'Cache-Control': 'private, max-age=86400',
        });
        res.send(imageBuffer);
    } catch (err) {
        logger.error('Failed to read user picture', err instanceof Error ? err : undefined);
        res.status(500).json({ success: false, error: 'Failed to read picture' });
    }
}
