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


/** POST /api/attachments - Create attachment */
export async function createAttachment(req: Request, res: Response, next: NextFunction) {
    try {
        const { relatedId, relatedType, fileName, filePath, fileType } = toCreateAttachmentBodyDTO(req.body);
        const createdBy = resolveUpdatedByFirstName(req);

        if (!relatedId || !relatedType || !fileName) {
            res.status(400).json(error('relatedId, relatedType, and fileName are required'));
            return;
        }

        const attachmentId = await attachRepo.createAttachment(
            relatedId,
            relatedType,
            fileName,
            filePath,
            fileType,
            createdBy
        );

        const payload: CreateAttachmentResponseDTO = { AttachmentID: attachmentId };
        writeAuditLog({ action: AuditAction.CREATE, entity: AuditEntity.ATTACHMENT, entityId: attachmentId, username: createdBy, detail: `${relatedType}:${relatedId} ${fileName}` });
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

        await attachRepo.deleteAttachment(attachmentId, relatedType, relatedId);
        writeAuditLog({ action: AuditAction.DELETE, entity: AuditEntity.ATTACHMENT, entityId: attachmentId, username: req.authUser?.username || 'System' });
        res.json(success(null, 'Attachment deleted'));
    } catch (err) {
        next(err);
    }
}
