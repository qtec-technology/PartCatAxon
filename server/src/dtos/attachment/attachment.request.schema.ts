import { z } from 'zod';
import {
    zParamIdString,
} from '#src/dtos/common/zod-helpers.js';

export const createAttachmentBodySchema = z.object({
    relatedId: z.preprocess(
        (value) => {
            if (typeof value === 'string') {
                const trimmed = value.trim();
                return trimmed.length > 0 ? Number.parseInt(trimmed, 10) : value;
            }
            return value;
        },
        z.number().int().positive('relatedId must be a positive integer')
    ),
    relatedType: z.enum(['ITEM', 'TERM']),
    fileName: z.string().trim().min(1, 'fileName is required'),
    filePath: z.string().trim().optional(),
    fileType: z.string().trim().optional(),
}).passthrough();

export const attachmentIdParamSchema = z.object({
    id: zParamIdString,
}).passthrough();

export const attachmentDeleteQuerySchema = z.object({
    relatedType: z.enum(['ITEM', 'TERM']),
    relatedId: z.preprocess(
        (value) => {
            if (Array.isArray(value)) return value.length > 0 ? value[0] : undefined;
            return value;
        },
        z.string().trim().regex(/^\d+$/, 'relatedId must be a numeric value')
    ),
}).passthrough();
