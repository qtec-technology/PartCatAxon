'use client';

// ── Phase 2: Native Item Create Page in Next.js ─────────────────────────────
// Route: /item/new

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ItemForm, ItemFormSaveOptions } from '@/components/features/item/ItemForm';
import { ItemData, FormMode } from '@/types/item_types';
import { itemApi } from '@/services/item.api';
import { attachmentApi } from '@/services/attachment.api';
import { lookupApi, ItemFormLookups } from '@/services/lookup.api';
import { featureFlags } from '@/config/feature-flags';
import { clientLogger } from '@/utils/logger';
import { toast } from 'sonner';

export default function ItemNewPage() {
    const router = useRouter();
    const readOnlyMode = featureFlags.readOnlyMode;
    const [mode] = useState<FormMode>('NEW');

    const navigate = useCallback((path: string) => {
        router.push(path);
    }, [router]);

    const syncItemArtifacts = async (itemId: number, options: ItemFormSaveOptions) => {
        const pendingAttachments = options?.pendingAttachments || [];
        const imageFile = options?.imageFile || null;

        let attachmentSyncFailed = false;
        let imageUploadFailed = false;

        if (pendingAttachments.length > 0) {
            const results = await Promise.allSettled(
                pendingAttachments.map((item) => attachmentApi.createAttachment({
                    relatedId: itemId,
                    relatedType: 'ITEM',
                    fileName: item.fileName,
                    filePath: '',
                    fileType: item.category,
                    file: item.file,
                }))
            );

            if (results.some((result) => result.status === 'rejected')) {
                attachmentSyncFailed = true;
            }
        }

        if (imageFile) {
            try {
                await itemApi.uploadItemImage(itemId, imageFile);
            } catch (imageErr) {
                imageUploadFailed = true;
                clientLogger.error('Image upload failed', imageErr);
            }
        }

        return { attachmentSyncFailed, imageUploadFailed };
    };

    const handleSave = async (formData: ItemData, options: ItemFormSaveOptions) => {
        try {
            if (readOnlyMode) {
                toast.info('Read-only phase: save is disabled');
                return;
            }

            const newItemId = await itemApi.createItem(formData);
            const { attachmentSyncFailed, imageUploadFailed } = await syncItemArtifacts(newItemId, options);

            if (attachmentSyncFailed || imageUploadFailed) {
                const warnings: string[] = [];
                if (attachmentSyncFailed) warnings.push('attachments');
                if (imageUploadFailed) warnings.push('image');
                toast.warning(`Item created, but failed to sync ${warnings.join(' and ')}`);
            } else {
                toast.success('Item created successfully');
            }

            navigate(`/item/${newItemId}`);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            clientLogger.error('Save failed', err);
            toast.error('Failed to create item: ' + message);
        }
    };

    return (
        <div>
            <ItemForm
                mode={mode}
                onSave={handleSave}
                onCancel={() => navigate('/partcatalog')}
                onExit={() => navigate('/partcatalog')}
                onChangeMode={() => { /* no mode change for NEW */ }}
                readOnlyMode={readOnlyMode}
            />
        </div>
    );
}
