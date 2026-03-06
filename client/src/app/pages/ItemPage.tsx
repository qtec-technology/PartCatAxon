import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ItemForm, ItemFormSaveOptions } from '../components/features/item/ItemForm';
import { ItemData, FormMode } from '../types/item_types';
import { itemApi } from '../services/item.api';
import { attachmentApi } from '../services/attachment.api';
import { lookupApi, ItemFormLookups } from '../services/lookup.api';
import { featureFlags } from '../config/feature-flags';
import { clientLogger } from '../utils/logger';
import { toast } from 'sonner';

interface ItemFormPageProps {
    mode: FormMode;
}

interface ItemAttachmentView {
    id: string;
    category: string;
    fileName: string;
    updatedBy: string;
    updatedDate: string;
}

export default function ItemPage({ mode: initialMode }: ItemFormPageProps) {
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();
    const readOnlyMode = featureFlags.readOnlyMode;
    const [mode, setMode] = useState<FormMode>(initialMode);
    const [data, setData] = useState<ItemData | undefined>(undefined);
    const [termCount, setTermCount] = useState<number | null>(null);
    const [attachments, setAttachments] = useState<ItemAttachmentView[]>([]);
    const [prefetchedLookups, setPrefetchedLookups] = useState<ItemFormLookups | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        let cancelled = false;

        if (readOnlyMode && initialMode !== 'VIEW') {
            toast.info('Read-only phase: edit/create is disabled');
            if (initialMode === 'EDIT' && id) {
                navigate(`/item/${id}`);
            } else {
                navigate('/');
            }
            return;
        }

        if (initialMode === 'NEW') {
            const loadLookupsForNew = async () => {
                setLoading(true);
                try {
                    const lookups = await lookupApi.getItemFormLookups();
                    if (!cancelled) {
                        setPrefetchedLookups(lookups);
                        setData(undefined);
                        setTermCount(null);
                        setAttachments([]);
                    }
                } catch (err) {
                    clientLogger.error('Failed to preload lookups', err);
                    if (!cancelled) {
                        setPrefetchedLookups(null);
                        setData(undefined);
                        setTermCount(null);
                        setAttachments([]);
                    }
                } finally {
                    if (!cancelled) {
                        setLoading(false);
                    }
                }
            };

            loadLookupsForNew();
            return;
        }

        if (!id) {
            toast.error('Invalid item id');
            navigate('/');
            return;
        }

        const itemId = Number(id);
        if (Number.isNaN(itemId)) {
            toast.error('Invalid item id');
            navigate('/');
            return;
        }

        const loadItemView = async () => {
            setLoading(true);
            try {
                const [itemResult, termCountResult, attachmentResult, lookupResult] = await Promise.allSettled([
                    itemApi.getItemById(itemId),
                    itemApi.getTermCount(itemId),
                    lookupApi.getItemAttachments(itemId),
                    lookupApi.getItemFormLookups(),
                ]);

                if (itemResult.status === 'rejected') {
                    throw itemResult.reason;
                }

                if (!cancelled) {
                    setData(itemResult.value);
                }

                if (!cancelled) {
                    if (termCountResult.status === 'fulfilled') {
                        setTermCount(termCountResult.value);
                    } else {
                        setTermCount(null);
                    }
                }

                if (!cancelled) {
                    if (attachmentResult.status === 'fulfilled') {
                        const mapped = attachmentResult.value.map((row) => ({
                            id: String(row.AttachmentID ?? row.id ?? ''),
                            category: String(row.Category ?? ''),
                            fileName: String(row.Attachement ?? row.fileName ?? ''),
                            updatedBy: String(row.Updatedby ?? row.updatedBy ?? ''),
                            updatedDate: String(row.UpdatedDate ?? row.updatedDate ?? ''),
                        }));
                        setAttachments(mapped.filter((row) => row.id || row.fileName));
                    } else {
                        setAttachments([]);
                    }
                }

                if (!cancelled) {
                    if (lookupResult.status === 'fulfilled') {
                        setPrefetchedLookups(lookupResult.value);
                    } else {
                        setPrefetchedLookups(null);
                    }
                }
            } catch (err) {
                clientLogger.error('Failed to fetch item', err);
                if (!cancelled) {
                    toast.error('Failed to load item data');
                    navigate('/');
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        loadItemView();

        return () => {
            cancelled = true;
        };
    }, [id, initialMode, navigate, readOnlyMode]);

    const handleSave = async (formData: ItemData, options: ItemFormSaveOptions) => {
        try {
            if (readOnlyMode) {
                toast.info('Read-only phase: save is disabled');
                return;
            }
            if (mode === 'NEW') {
                const newItemId = await itemApi.createItem(formData);
                toast.success('Item created successfully');
                navigate(`/item/${newItemId}`);
            } else {
                if (!id) return;
                await itemApi.updateItem(id, formData);
                const itemId = Number(id);
                const pendingAttachments = options?.pendingAttachments || [];
                const imageFile = options?.imageFile || null;

                let attachmentSyncFailed = false;
                let imageUploadFailed = false;

                if (pendingAttachments.length > 0) {
                    try {
                        await Promise.all(
                            pendingAttachments.map((item) => attachmentApi.createAttachment({
                                relatedId: itemId,
                                relatedType: 'ITEM',
                                fileName: item.fileName,
                                filePath: '',
                                fileType: item.category,
                            }))
                        );
                    } catch (attachmentErr) {
                        attachmentSyncFailed = true;
                        clientLogger.error('Attachment save failed', attachmentErr);
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

                if (attachmentSyncFailed || imageUploadFailed) {
                    const warnings: string[] = [];
                    if (attachmentSyncFailed) warnings.push('attachments');
                    if (imageUploadFailed) warnings.push('image');
                    toast.warning(`Item updated, but failed to sync ${warnings.join(' and ')}`);
                } else {
                    toast.success('Item updated successfully');
                }
                setMode('VIEW');
            }
        } catch (err: any) {
            clientLogger.error('Save failed', err);
            toast.error('Failed to save item: ' + (err.message || 'Unknown error'));
        }
    };

    const handleDeleteAttachment = async (attachmentId: string) => {
        if (!id) {
            throw new Error('Invalid item id');
        }

        const itemId = Number(id);
        if (Number.isNaN(itemId) || itemId <= 0) {
            throw new Error('Invalid item id');
        }

        const parsedAttachmentId = Number(attachmentId);
        if (Number.isNaN(parsedAttachmentId) || parsedAttachmentId <= 0) {
            throw new Error('Invalid AttachmentID');
        }

        await attachmentApi.deleteAttachment(parsedAttachmentId, {
            relatedType: 'ITEM',
            relatedId: itemId,
        });

        setAttachments((prev) => prev.filter((row) => Number(row.id) !== parsedAttachmentId));
    };

    const handleDeleteItem = async (itemId: number, confirmText: string) => {
        if (readOnlyMode) {
            throw new Error('Read-only phase: delete is disabled');
        }

        await itemApi.deleteItem(itemId, confirmText);
        navigate('/');
    };

    if (loading) {
        return <div className="p-10 text-center">Loading...</div>;
    }

    return (
        <div className="h-full overflow-y-auto">
            <ItemForm
                mode={mode}
                initialData={data}
                onSave={handleSave}
                onDeleteAttachment={handleDeleteAttachment}
                onDeleteItem={handleDeleteItem}
                onCancel={() => setMode('VIEW')}
                onExit={() => navigate('/')}
                onChangeMode={setMode}
                readOnlyMode={readOnlyMode}
                termCount={termCount}
                attachments={attachments}
                prefetchedLookups={prefetchedLookups || undefined}
            />
        </div>
    );
}
