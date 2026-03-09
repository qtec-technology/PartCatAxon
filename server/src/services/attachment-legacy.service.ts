import fs from 'node:fs/promises';
import path from 'node:path';
import { env } from '#src/config/env.js';
import type { AuthUser } from '#src/types/common.types.js';

export type LegacyAttachmentOwnerType = 'ITEM' | 'TERM';

const WINDOWS_INVALID_FILE_CHARS_REGEX = /[<>:"/\\|?*\u0000-\u001F]/g;
const ITEM_IMAGE_EXTENSIONS = ['.jpg', '.png', '.gif'] as const;
const ITEM_IMAGE_MIME_TO_EXT: Record<string, (typeof ITEM_IMAGE_EXTENSIONS)[number]> = {
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
};

function normalizeWhitespace(input: string): string {
    return String(input || '').trim().replace(/\s+/g, ' ');
}

export function sanitizeLegacyFileSegment(input: string, fallback: string): string {
    const collapsed = normalizeWhitespace(input).replace(/\s+/g, '');
    const sanitized = collapsed.replace(WINDOWS_INVALID_FILE_CHARS_REGEX, '');
    return sanitized || fallback;
}

export function normalizeItemImageExt(fileName: string, mimeType: string): '.jpg' | '.png' | '.gif' {
    const extFromName = path.extname(String(fileName || '').trim()).toLowerCase();
    if (ITEM_IMAGE_EXTENSIONS.includes(extFromName as (typeof ITEM_IMAGE_EXTENSIONS)[number])) {
        return extFromName as '.jpg' | '.png' | '.gif';
    }

    if (!extFromName) {
        const extFromMime = ITEM_IMAGE_MIME_TO_EXT[String(mimeType || '').trim().toLowerCase()];
        if (extFromMime) {
            return extFromMime;
        }
    }

    throw new Error('Unsupported image type. Allowed: JPG, PNG, GIF');
}

function normalizeAttachmentExt(fileName: string): string {
    const ext = path.extname(String(fileName || '').trim());
    if (!ext) return '';

    const sanitized = ext.replace(WINDOWS_INVALID_FILE_CHARS_REGEX, '');
    if (!sanitized) return '';

    return sanitized.startsWith('.') ? sanitized : `.${sanitized}`;
}

export function buildLegacyAttachmentBaseName(
    relatedType: LegacyAttachmentOwnerType,
    relatedId: number,
    fileCategory: string
): string {
    const prefix = relatedType === 'ITEM' ? 'I' : 'T';
    const categorySegment = sanitizeLegacyFileSegment(fileCategory, 'Attachment');
    return `${prefix}${relatedId}${categorySegment}`;
}

export function buildLegacyAttachmentFileName(
    relatedType: LegacyAttachmentOwnerType,
    relatedId: number,
    fileCategory: string,
    originalFileName: string,
    attempt: number
): string {
    const baseName = buildLegacyAttachmentBaseName(relatedType, relatedId, fileCategory);
    const suffix = attempt === 0 ? '' : `_${attempt - 1}`;
    const ext = normalizeAttachmentExt(originalFileName);
    return `${baseName}${suffix}${ext}`;
}

export async function saveLegacyAttachmentFile(options: {
    relatedType: LegacyAttachmentOwnerType;
    relatedId: number;
    fileCategory: string;
    originalFileName: string;
    contentBuffer: Buffer;
}): Promise<{ fileName: string; filePath: string }> {
    const attachmentDir = path.resolve(env.ATTACHMENT_DIR);
    await fs.mkdir(attachmentDir, { recursive: true });

    for (let attempt = 0; attempt < 10_000; attempt += 1) {
        const fileName = buildLegacyAttachmentFileName(
            options.relatedType,
            options.relatedId,
            options.fileCategory,
            options.originalFileName,
            attempt
        );
        const filePath = path.join(attachmentDir, fileName);

        try {
            await fs.writeFile(filePath, options.contentBuffer, { flag: 'wx' });
            return { fileName, filePath };
        } catch (error) {
            const code = (error as NodeJS.ErrnoException).code;
            if (code === 'EEXIST') {
                continue;
            }
            throw error;
        }
    }

    throw new Error('Unable to allocate a unique attachment file name');
}

function normalizeIdentity(value: string): string {
    return String(value || '').trim().toLowerCase();
}

export function getActorIdentityCandidates(authUser?: AuthUser): string[] {
    if (!authUser) return [];

    const candidates = new Set<string>();
    const push = (value: string) => {
        const normalized = normalizeIdentity(value);
        if (normalized) {
            candidates.add(normalized);
        }
    };

    push(authUser.username);
    push(authUser.firstname);
    push(authUser.displayName);

    const firstDisplayToken = String(authUser.displayName || '').trim().split(/\s+/)[0] || '';
    push(firstDisplayToken);

    return [...candidates];
}

export function canDeleteAttachmentByActor(updatedBy: string, authUser?: AuthUser): boolean {
    if (!authUser) return false;
    if (authUser.isSupervisor || authUser.isManager) {
        return true;
    }

    const normalizedOwner = normalizeIdentity(updatedBy);
    if (!normalizedOwner) {
        return false;
    }

    return getActorIdentityCandidates(authUser).includes(normalizedOwner);
}

export const canDeleteOwnedRecordByActor = canDeleteAttachmentByActor;
