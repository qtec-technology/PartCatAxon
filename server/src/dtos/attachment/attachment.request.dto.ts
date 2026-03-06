import {
    asRecord,
    parseOptionalInt,
    parseString,
} from '#src/dtos/common/request-parsers.js';

export interface CreateAttachmentBodyDTO {
    relatedId: number | null;
    relatedType: string;
    fileName: string;
    filePath: string;
    fileType: string;
}

export interface AttachmentIdParamDTO {
    attachmentId: number | null;
}

export interface AttachmentDeleteQueryDTO {
    relatedType: string;
    relatedId: number | null;
}

export function toCreateAttachmentBodyDTO(body: unknown): CreateAttachmentBodyDTO {
    const b = asRecord(body);
    return {
        relatedId: parseOptionalInt(b.relatedId),
        relatedType: parseString(b.relatedType, ''),
        fileName: parseString(b.fileName, ''),
        filePath: parseString(b.filePath, ''),
        fileType: parseString(b.fileType, ''),
    };
}

export function toAttachmentIdParamDTO(params: unknown): AttachmentIdParamDTO {
    const p = asRecord(params);
    return {
        attachmentId: parseOptionalInt(p.id),
    };
}

export function toAttachmentDeleteQueryDTO(query: unknown): AttachmentDeleteQueryDTO {
    const q = asRecord(query);
    return {
        relatedType: parseString(q.relatedType, ''),
        relatedId: parseOptionalInt(q.relatedId),
    };
}
