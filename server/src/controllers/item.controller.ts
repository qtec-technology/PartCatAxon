import { Request, Response, NextFunction } from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import * as itemRepo from '#src/repositories/item.repository.js';
import {
    toItemDeleteBodyDTO,
    toItemDuplicateCheckQueryDTO,
    toItemImageUploadBodyDTO,
    toItemIdParamDTO,
    toItemListQueryDTO,
} from '#src/dtos/item/item.request.dto.js';
import type {
    ItemCreateResponseDTO,
    ItemDuplicateCheckResponseDTO,
    ItemListResponseDTO,
    ItemTermCountResponseDTO,
    ItemUOMResponseDTO,
} from '#src/dtos/item/item.response.dto.js';
import { splitLongDescription } from '#src/utils/text-split.js';
import { success, error } from '#src/utils/response.js';
import { resolveUpdatedByFirstName } from '#src/utils/auth.js';
import { writeAuditLog, AuditAction, AuditEntity } from '#src/services/audit.service.js';
import { env } from '#src/config/env.js';
import { logger } from '#src/utils/logger.js';

const ITEM_IMAGE_EXTENSIONS = ['.jpg', '.png', '.gif', '.jpeg', '.webp'] as const;
const ITEM_IMAGE_MIME_TO_EXT: Record<string, (typeof ITEM_IMAGE_EXTENSIONS)[number]> = {
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
};

function resolveItemImageDir(): string {
    return path.resolve(env.ITEM_IMAGE_DIR);
}

function getItemImageBaseName(itemId: number): string {
    return `IIMG${itemId}`;
}

/**
 * Build the full image path and validate it stays within ITEM_IMAGE_DIR.
 * Prevents path traversal attacks (defense-in-depth).
 */
function buildSafeImagePath(itemId: number, ext: string): string {
    const imageDir = resolveItemImageDir();
    const baseName = getItemImageBaseName(itemId);
    const fullPath = path.resolve(imageDir, `${baseName}${ext}`);
    if (!fullPath.startsWith(imageDir)) {
        throw new Error('Invalid image path: path traversal detected');
    }
    return fullPath;
}

function normalizeItemImageExt(fileName: string, mimeType: string): string {
    const extFromName = path.extname(String(fileName || '').trim()).toLowerCase();
    if (ITEM_IMAGE_EXTENSIONS.includes(extFromName as (typeof ITEM_IMAGE_EXTENSIONS)[number])) {
        return extFromName;
    }

    const extFromMime = ITEM_IMAGE_MIME_TO_EXT[String(mimeType || '').trim().toLowerCase()];
    if (extFromMime) {
        return extFromMime;
    }

    throw new Error('Unsupported image type. Allowed: jpg, jpeg, png, gif, webp');
}

async function deleteItemImageCandidates(itemId: number): Promise<void> {
    const baseName = getItemImageBaseName(itemId);
    const imageDir = resolveItemImageDir();
    const candidates = new Set<string>();

    for (const ext of ITEM_IMAGE_EXTENSIONS) {
        candidates.add(path.join(imageDir, `${baseName}${ext}`));
        candidates.add(path.join(imageDir, `${baseName}${ext.toUpperCase()}`));
    }

    await Promise.all(
        [...candidates].map(async (filePath) => {
            try {
                await fs.unlink(filePath);
            } catch (unlinkErr) {
                const code = (unlinkErr as NodeJS.ErrnoException).code;
                if (code !== 'ENOENT') {
                    throw unlinkErr;
                }
            }
        })
    );
}

async function resolveItemImagePath(itemId: number): Promise<string | null> {
    const baseName = getItemImageBaseName(itemId);
    const imageDir = resolveItemImageDir();
    const candidates: string[] = [];

    for (const ext of ITEM_IMAGE_EXTENSIONS) {
        candidates.push(path.join(imageDir, `${baseName}${ext}`));
        candidates.push(path.join(imageDir, `${baseName}${ext.toUpperCase()}`));
    }

    for (const filePath of candidates) {
        try {
            await fs.access(filePath);
            return filePath;
        } catch {
            // try next extension
        }
    }

    return null;
}

async function saveItemImageToFolder(itemId: number, fileName: string, mimeType: string, contentBuffer: Buffer): Promise<{
    fileName: string;
    filePath: string;
}> {
    const extension = normalizeItemImageExt(fileName, mimeType);
    const imageDir = resolveItemImageDir();
    const targetName = `${getItemImageBaseName(itemId)}${extension}`;
    const targetPath = path.join(imageDir, targetName);

    await fs.mkdir(imageDir, { recursive: true });
    await deleteItemImageCandidates(itemId);
    await fs.writeFile(targetPath, contentBuffer);

    return {
        fileName: targetName,
        filePath: targetPath,
    };
}

/** GET /api/items - Paginated item list */
export async function getItems(req: Request, res: Response, next: NextFunction) {
    try {
        const { page, pageSize, brand, myItems } = toItemListQueryDTO(req.query);
        const updatedBy = myItems ? (req.authUser?.username || '') : undefined;
        const { items, total } = await itemRepo.getItems(page, pageSize, brand, myItems, updatedBy);
        const typedItems: ItemListResponseDTO = items;
        const totalPages = Math.ceil(total / pageSize);
        res.json(success(typedItems, undefined, { page, pageSize, total, totalPages }));
    } catch (err) {
        next(err);
    }
}

/** GET /api/items/:id - Get single item */
export async function getItemById(req: Request, res: Response, next: NextFunction) {
    try {
        const { itemId } = toItemIdParamDTO(req.params);
        if (itemId === null) {
            res.status(400).json(error('Invalid ItemID'));
            return;
        }

        const item = await itemRepo.getFullItemById(itemId);
        if (!item) {
            res.status(404).json(error('Item not found'));
            return;
        }

        // Include hasImage flag so frontend never 404s on image
        const hasImage = !!(await resolveItemImagePath(itemId));
        res.json(success({ ...item, hasImage }));
    } catch (err) {
        next(err);
    }
}

/** GET /api/items/:id/image - Get item image by legacy naming IIMG{ItemID}.{ext} */
export async function getItemImage(req: Request, res: Response, next: NextFunction) {
    try {
        const { itemId } = toItemIdParamDTO(req.params);
        if (itemId === null) {
            res.status(400).json(error('Invalid ItemID'));
            return;
        }

        const filePath = await resolveItemImagePath(itemId);
        if (!filePath) {
            res.status(404).end();
            return;
        }

        res.setHeader('Cache-Control', 'private, max-age=300');
        res.sendFile(filePath, (sendErr) => {
            if (sendErr) {
                next(sendErr);
            }
        });
    } catch (err) {
        next(err);
    }
}

/** POST /api/items/:id/image - Upload item image to configured ITEM_IMAGE_DIR */
export async function uploadItemImage(req: Request, res: Response, next: NextFunction) {
    try {
        const { itemId } = toItemIdParamDTO(req.params);
        if (itemId === null) {
            res.status(400).json(error('Invalid ItemID'));
            return;
        }

        const { fileName, mimeType, contentBase64 } = toItemImageUploadBodyDTO(req.body);
        if (!fileName || !contentBase64) {
            res.status(400).json(error('fileName and contentBase64 are required'));
            return;
        }

        const strippedBase64 = contentBase64.replace(/^data:[^;]+;base64,/i, '').trim();
        const contentBuffer = Buffer.from(strippedBase64, 'base64');
        if (contentBuffer.length === 0) {
            res.status(400).json(error('Invalid image content'));
            return;
        }

        const saved = await saveItemImageToFolder(itemId, fileName, mimeType, contentBuffer);

        res.json(success(saved, 'Item image uploaded successfully'));
    } catch (err) {
        next(err);
    }
}

/** POST /api/items - Create new item */
export async function createItem(req: Request, res: Response, next: NextFunction) {
    try {
        const updatedBy = resolveUpdatedByFirstName(req);

        if (req.body.fullDescription) {
            const parts = splitLongDescription(req.body.fullDescription);
            req.body.LongDesc1 = parts[0];
            req.body.LongDesc2 = parts[1];
            req.body.LongDesc3 = parts[2];
            req.body.LongDesc4 = parts[3];
        }

        const itemId = await itemRepo.createItem(req.body, updatedBy);
        const itemCode = String(await itemRepo.generateCatalogNo(itemId) || '').trim();
        if (!itemCode) {
            throw new Error('Failed to generate ItemCode');
        }

        const payload: ItemCreateResponseDTO = { ItemID: itemId, ItemCode: itemCode };
        writeAuditLog({ action: AuditAction.CREATE, entity: AuditEntity.ITEM, entityId: itemId, username: updatedBy, detail: `CatalogNo: ${itemCode}` });
        res.status(201).json(success(payload));
    } catch (err) {
        next(err);
    }
}

/** PUT /api/items/:id - Update item */
export async function updateItem(req: Request, res: Response, next: NextFunction) {
    try {
        const { itemId } = toItemIdParamDTO(req.params);
        if (itemId === null) {
            res.status(400).json(error('Invalid ItemID'));
            return;
        }

        const updatedBy = resolveUpdatedByFirstName(req);

        if (req.body.fullDescription) {
            const parts = splitLongDescription(req.body.fullDescription);
            req.body.LongDesc1 = parts[0];
            req.body.LongDesc2 = parts[1];
            req.body.LongDesc3 = parts[2];
            req.body.LongDesc4 = parts[3];
        }

        await itemRepo.updateItem(itemId, req.body, updatedBy);
        writeAuditLog({ action: AuditAction.UPDATE, entity: AuditEntity.ITEM, entityId: itemId, username: updatedBy });
        res.json(success(null, 'Item updated successfully'));
    } catch (err) {
        next(err);
    }
}

/** DELETE /api/items/:id - Delete item (with strict confirmation checks) */
export async function deleteItem(req: Request, res: Response, next: NextFunction) {
    try {
        const { itemId } = toItemIdParamDTO(req.params);
        if (itemId === null) {
            res.status(400).json(error('Invalid ItemID'));
            return;
        }

        const { confirmText, confirmItemId } = toItemDeleteBodyDTO(req.body);
        if (String(confirmText || '').trim().toUpperCase() !== 'DELETE') {
            res.status(400).json(error('Invalid confirmText'));
            return;
        }
        if (confirmItemId === null || confirmItemId !== itemId) {
            res.status(400).json(error('confirmItemId must match route ItemID'));
            return;
        }

        await itemRepo.deleteItem(itemId);

        // Best effort cleanup for image files; DB delete has already succeeded.
        try {
            await deleteItemImageCandidates(itemId);
        } catch (imageCleanupErr) {
            logger.warn('Failed to cleanup image files after item deletion', {
                itemId,
                error: imageCleanupErr instanceof Error ? imageCleanupErr.message : String(imageCleanupErr),
            });
        }

        writeAuditLog({ action: AuditAction.DELETE, entity: AuditEntity.ITEM, entityId: itemId, username: req.authUser?.username || 'System' });
        res.json(success(null, 'Item deleted successfully'));
    } catch (err) {
        next(err);
    }
}

/** GET /api/items/:id/duplicate-check - Check duplicate CatalogNo */
export async function checkDuplicate(req: Request, res: Response, next: NextFunction) {
    try {
        const { itemId } = toItemIdParamDTO(req.params);
        const id = itemId ?? Number.NaN;
        const { catalogNo, brand } = toItemDuplicateCheckQueryDTO(req.query);

        if (!catalogNo || !brand) {
            res.status(400).json(error('catalogNo and brand are required'));
            return;
        }

        const isDuplicated = await itemRepo.checkDuplicate(catalogNo, brand, id);
        const payload: ItemDuplicateCheckResponseDTO = { isDuplicated };
        res.json(success(payload));
    } catch (err) {
        next(err);
    }
}

/** GET /api/items/:id/uom - Get item's inventory UOM */
export async function getItemUOM(req: Request, res: Response, next: NextFunction) {
    try {
        const { itemId } = toItemIdParamDTO(req.params);
        if (itemId === null) {
            res.status(400).json(error('Invalid ItemID'));
            return;
        }

        const uom = await itemRepo.getInvntryUom(itemId);
        const payload: ItemUOMResponseDTO = { uom };
        res.json(success(payload));
    } catch (err) {
        next(err);
    }
}

/** GET /api/items/:id/term-count - Get number of terms for an item */
export async function getTermCount(req: Request, res: Response, next: NextFunction) {
    try {
        const { itemId } = toItemIdParamDTO(req.params);
        if (itemId === null) {
            res.status(400).json(error('Invalid ItemID'));
            return;
        }

        const count = await itemRepo.getNoOfTermsByItemId(itemId);
        const payload: ItemTermCountResponseDTO = { count };
        res.json(success(payload));
    } catch (err) {
        next(err);
    }
}
