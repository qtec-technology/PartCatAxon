import { requestJson } from './http';
import { readFileAsDataUrl } from '../utils/file';

export interface CreateAttachmentRequest {
    relatedId: number;
    relatedType: 'ITEM' | 'TERM';
    fileName: string;
    filePath?: string;
    fileType?: string;
    file?: File;
    contentBase64?: string;
}

interface CreateAttachmentResponse {
    AttachmentID: number;
}

interface DeleteAttachmentOwner {
    relatedType: 'ITEM' | 'TERM';
    relatedId: number;
}

const buildQuery = (params: Record<string, string | number | undefined>): string => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
        if (value === undefined || value === null || value === '') return;
        query.set(key, String(value));
    });
    return query.toString();
};

export const attachmentApi = {
    createAttachment: async (data: CreateAttachmentRequest): Promise<number> => {
        const { file, contentBase64: inputContentBase64, ...rest } = data;
        const fileName = file?.name || data.fileName;
        const contentBase64 = file
            ? await readFileAsDataUrl(file)
            : inputContentBase64;

        const payload = await requestJson<CreateAttachmentResponse>('/api/attachments', {
            method: 'POST',
            body: {
                ...rest,
                fileName,
                contentBase64,
            },
        });
        return Number(payload.data?.AttachmentID || 0);
    },

    deleteAttachment: async (attachmentId: number, owner: DeleteAttachmentOwner): Promise<void> => {
        const query = buildQuery({
            relatedType: owner.relatedType,
            relatedId: owner.relatedId,
        });
        await requestJson<null>(`/api/attachments/${attachmentId}?${query}`, {
            method: 'DELETE',
        });
    },
};
