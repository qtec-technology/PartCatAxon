import fs from 'node:fs/promises';
import { Request, Response, NextFunction } from 'express';
import * as attachRepo from '#src/repositories/attachment.repository.js';
import {
    toAttachmentDeleteQueryDTO,
    toAttachmentIdParamDTO,
    toCreateAttachmentBodyDTO,
} from '#src/dtos/attachment/attachment.request.dto.js';
import type { CreateAttachmentResponseDTO } from '#src/dtos/attachment/attachment.response.dto.js';
import { success, error } from '#src/utils/response.js';
import { resolveUpdatedByFirstName } from '#src/utils/auth.js';
import { writeAuditLog, AuditAction, AuditEntity } from '#src/services/audit.service.js';
import {
    canDeleteAttachmentByActor,
    saveLegacyAttachmentFile,
} from '#src/services/attachment-legacy.service.js';

/** POST /api/attachments - Create attachment */
export async function createAttachment(req: Request, res: Response, next: NextFunction) {
    try {
        const { relatedId, relatedType, fileName, filePath, fileType, contentBase64 } = toCreateAttachmentBodyDTO(req.body);
        const createdBy = resolveUpdatedByFirstName(req);

        if (!relatedId || !relatedType || !fileName) {
            res.status(400).json(error('relatedId, relatedType, and fileName are required'));
            return;
        }

        let storedFileName = fileName;
        let storedFilePath = filePath;
        let savedFilePath = '';

        if (String(contentBase64 || '').trim()) {
            const strippedBase64 = contentBase64.replace(/^data:[^;]+;base64,/i, '').trim();
            const contentBuffer = Buffer.from(strippedBase64, 'base64');
            if (contentBuffer.length === 0) {
                res.status(400).json(error('Invalid attachment content'));
                return;
            }

            if (relatedType !== 'ITEM' && relatedType !== 'TERM') {
                res.status(400).json(error('relatedType must be ITEM or TERM'));
                return;
            }

            if (!String(fileType || '').trim()) {
                res.status(400).json(error('fileType is required when uploading attachment content'));
                return;
            }

            const saved = await saveLegacyAttachmentFile({
                relatedType,
                relatedId,
                fileCategory: fileType,
                originalFileName: fileName,
                contentBuffer,
            });

            storedFileName = saved.fileName;
            storedFilePath = saved.filePath;
            savedFilePath = saved.filePath;
        }

        let attachmentId = 0;
        try {
            attachmentId = await attachRepo.createAttachment(
                relatedId,
                relatedType,
                storedFileName,
                storedFilePath,
                fileType,
                createdBy
            );
        } catch (err) {
            if (savedFilePath) {
                try {
                    await fs.unlink(savedFilePath);
                } catch {
                    // Best effort cleanup only.
                }
            }
            throw err;
        }

        const payload: CreateAttachmentResponseDTO = { AttachmentID: attachmentId };
        writeAuditLog({
            action: AuditAction.CREATE,
            entity: AuditEntity.ATTACHMENT,
            entityId: attachmentId,
            username: createdBy,
            detail: `${relatedType}:${relatedId} ${storedFileName}`,
        });
        res.status(201).json(success(payload));
    } catch (err) {
        next(err);
    }
}

/** DELETE /api/attachments/:id - Delete attachment */
export async function deleteAttachment(req: Request, res: Response, next: NextFunction) {
    try {
        const { attachmentId } = toAttachmentIdParamDTO(req.params);
        const { relatedType, relatedId } = toAttachmentDeleteQueryDTO(req.query);
        if (attachmentId === null) {
            res.status(400).json(error('Invalid AttachmentID'));
            return;
        }
        if (!relatedType || relatedId === null) {
            res.status(400).json(error('relatedType and relatedId are required'));
            return;
        }

        const attachment = await attachRepo.getAttachmentForOwner(attachmentId, relatedType, relatedId);
        if (!attachment) {
            res.status(404).json(error('Attachment not found for the specified owner'));
            return;
        }

        if (!canDeleteAttachmentByActor(attachment.Updatedby, req.authUser)) {
            res.status(403).json(error('You are not authorized to delete this file. Only owner, supervisor, or manager can delete it.'));
            return;
        }

        const updatedBy = resolveUpdatedByFirstName(req);
        await attachRepo.deleteAttachment(attachmentId, relatedType, relatedId, updatedBy);
        writeAuditLog({
            action: AuditAction.DELETE,
            entity: AuditEntity.ATTACHMENT,
            entityId: attachmentId,
            username: req.authUser?.username || 'System',
        });
        res.json(success(null, 'Attachment deleted'));
    } catch (err) {
        next(err);
    }
}
