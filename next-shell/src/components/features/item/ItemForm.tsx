import React, { useDeferredValue, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { attachmentApi } from '../../../services/attachment.api';
import type { ItemFormLookups, LookupOption } from '../../../services/lookup.api';
import type { FormMode, ItemData } from '../../../types/item_types';
import { useAuth } from '../../../auth/AuthContext';
import { clientLogger } from '../../../utils/logger';
import { canDeleteOwnedRecord } from '../../../utils/delete-permission';
import { ItemCenterColumn } from './sections/ItemCenterColumn';
import { ItemFormHeader } from './sections/ItemFormHeader';
import { ItemLeftColumn } from './sections/ItemLeftColumn';
import { ItemRightColumn } from './sections/ItemRightColumn';
import { SearchBeforeCreatePanel } from './sections/SearchBeforeCreatePanel';
import {
  NULL_LOOKUP_VALUE,
  normalizeSelectValue,
  useItemImage,
  useItemLookups,
  useSearchBeforeCreate,
} from './hooks';
import {
  EMPTY_ATTACHMENTS,
  LONG_DESC_MAX_LENGTH,
  buildLongDescFooter,
  buildLongDescWithSuffix,
  composeLongDescWithSuffix,
  formatDateTimeDisplay,
  normalizeReferenceUrl,
  splitLongDescToChunks,
  stripGeneratedLongDescSuffix,
  type AttachmentItem,
  type ItemFormElementIds,
  type ItemFormSaveOptions,
  type ItemSaveAttachmentInput,
} from './item.utils';

export type { ItemFormSaveOptions, ItemSaveAttachmentInput } from './item.utils';

interface ItemFormProps {
  mode: FormMode;
  initialData?: ItemData;
  attachments?: AttachmentItem[];
  termCount?: number | null;
  prefetchedLookups?: ItemFormLookups;
  onSave: (data: ItemData, options: ItemFormSaveOptions) => void | Promise<void>;
  onDeleteAttachment?: (attachmentId: string) => void | Promise<void>;
  onDeleteItem?: (itemId: number, confirmText: string) => void | Promise<void>;
  onCancel: () => void;
  onExit: () => void;
  onChangeMode: (mode: FormMode) => void;
  onOpenItem?: (itemId: number) => void;
  onCreateTerm?: (itemId: number) => void;
  readOnlyMode?: boolean;
}

export function ItemForm({
  mode,
  initialData,
  attachments: initialAttachments = EMPTY_ATTACHMENTS,
  termCount = null,
  prefetchedLookups,
  onSave,
  onDeleteAttachment,
  onDeleteItem,
  onCancel,
  onExit,
  onChangeMode,
  onOpenItem,
  onCreateTerm,
  readOnlyMode = false
}: ItemFormProps) {
  const { user } = useAuth();
  const isNew = mode === 'NEW';
  const isView = mode === 'VIEW';
  const isEdit = mode === 'EDIT';
  const isReadOnly = readOnlyMode || isView;
  const canManageItemImage = !isReadOnly;
  const canManageAttachments = !isReadOnly;
  const currentDisplayName = String(user?.displayName || user?.username || '').trim();
  const currentFirstName = String(
    user?.firstname || currentDisplayName.split(/\s+/)[0] || user?.username || ''
  ).trim();
  const itemIdForAttachmentDownload = Number(initialData?.id || 0);
  const buildAttachmentDownloadUrl = (attachmentId: string): string => (
    itemIdForAttachmentDownload > 0 && attachmentId
      ? attachmentApi.getDownloadUrl(attachmentId, { relatedType: 'ITEM', relatedId: itemIdForAttachmentDownload })
      : ''
  );

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    reset,
    getValues,
    formState: { isSubmitting },
  } = useForm<ItemData>({
    mode: 'onChange',
    defaultValues: initialData || {
      active: true,
      masterFG: false,
      itemGroup: '',
      itemCategory: NULL_LOOKUP_VALUE,
      mfrBrand: '',
      stockUOM: '',
      countryOfOrigin: NULL_LOOKUP_VALUE,
      specialRequirement: '',
      remark: '',
      longDesc1: '',
      longDesc2: '',
      longDesc3: '',
      longDesc4: '',
      updatedDate: '',
      updatedBy: ''
    }
  });

  const [activeTab, setActiveTab] = useState<'desc' | 'attach'>('desc');
  const [isDeletingItem, setIsDeletingItem] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  const [attachments, setAttachments] = useState<AttachmentItem[]>(initialAttachments);
  const [deletingAttachmentIds, setDeletingAttachmentIds] = useState<Record<string, boolean>>({});
  const [showAddFileDialog, setShowAddFileDialog] = useState(false);
  const [attachCategory, setAttachCategory] = useState('');
  const [attachFile, setAttachFile] = useState<File | null>(null);
  const attachFileInputRef = React.useRef<HTMLInputElement>(null);
  const lastInitialDataResetKeyRef = React.useRef('');

  const [brandInput, setBrandInput] = useState('');
  const [showBrandDropdown, setShowBrandDropdown] = useState(false);
  const brandRef = React.useRef<HTMLDivElement>(null);

  const {
    normalizedBrands,
    itemGroups,
    uoms,
    countries,
    permitTypes,
    itemCategories,
  } = useItemLookups({ prefetchedLookups });

  const {
    previewImage,
    selectedImageFile,
    handleImageUpload,
    handleImageError,
  } = useItemImage({ initialData, canManageItemImage });

  const currentBrand = String(watch('mfrBrand') || '');
  const currentMfrCatalogNo = String(watch('mfrCatalogNo') || '').trim();
  const currentCatalogNo = watch('catalogNo') || initialData?.catalogNo || '';
  const deferredBrand = useDeferredValue(currentBrand);
  const deferredMfrCatalogNo = useDeferredValue(currentMfrCatalogNo);
  const currentMfrBrand = String(currentBrand || '').trim();
  const referenceUrlRaw = String(watch('referenceUrl') ?? '').trim();
  const hasReferenceUrl = referenceUrlRaw.length > 0;
  const permitRequired = Boolean(watch('permitRequired'));
  const updatedByValue = String(watch('updatedBy') || '');
  const canDeleteItemRecord = canDeleteOwnedRecord(updatedByValue, user);
  const updatedDateValue = String(watch('updatedDate') || '');

  const filteredBrands = React.useMemo(() => {
    const q = String(brandInput ?? '').trim().toUpperCase();
    if (!q) return normalizedBrands;
    return normalizedBrands.filter((b) => {
      const label = String(b.label ?? '').trim().toUpperCase();
      const value = String(b.value ?? '').trim().toUpperCase();
      return label.startsWith(q) || value.startsWith(q);
    });
  }, [brandInput, normalizedBrands]);

  const {
    searchBeforeCreate,
    currentIdentityKey,
    hasIdentityInput,
    hasSearchReview,
    handleAcknowledgeNewItemCandidate,
    handleRecheckExistingItems,
  } = useSearchBeforeCreate({
    isNew,
    currentBrand,
    currentMfrCatalogNo,
    deferredBrand,
    deferredMfrCatalogNo,
  });

  const handlePrint = React.useCallback(() => {
    if (typeof window === 'undefined' || isPrinting) return;

    setIsPrinting(true);
    const clearPrintingState = () => setIsPrinting(false);

    window.addEventListener('afterprint', clearPrintingState, { once: true });

    try {
      window.print();
      window.setTimeout(clearPrintingState, 1500);
    } catch (error) {
      window.removeEventListener('afterprint', clearPrintingState);
      setIsPrinting(false);
      clientLogger.error('Print failed', error);
      toast.error('Unable to print item');
    }
  }, [isPrinting]);

  useEffect(() => {
    if (!isView) return;

    const onPrintShortcut = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      if (event.key.toLowerCase() !== 'p') return;

      event.preventDefault();
      handlePrint();
    };

    window.addEventListener('keydown', onPrintShortcut);
    return () => window.removeEventListener('keydown', onPrintShortcut);
  }, [handlePrint, isView]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (brandRef.current && !brandRef.current.contains(e.target as Node)) {
        setShowBrandDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (initialData?.mfrBrand) {
      const matched = normalizedBrands.find((b) => b.value === initialData.mfrBrand);
      setBrandInput(matched ? matched.label : initialData.mfrBrand);
    }
  }, [initialData, normalizedBrands]);

  useEffect(() => {
    const fields: Array<{ field: 'itemGroup' | 'itemCategory' | 'stockUOM' | 'countryOfOrigin' | 'permitType'; options: LookupOption[] }> = [
      { field: 'itemGroup', options: itemGroups },
      { field: 'itemCategory', options: itemCategories },
      { field: 'stockUOM', options: uoms },
      { field: 'countryOfOrigin', options: countries },
      { field: 'permitType', options: permitTypes },
    ];

    for (const { field, options } of fields) {
      if (options.length === 0) continue;
      const current = String(getValues(field) ?? '').trim();
      if (!current) continue;

      const normalized = normalizeSelectValue(current, options);
      if (normalized === current) continue;
      setValue(field, normalized, { shouldDirty: false, shouldValidate: false, shouldTouch: false });
    }
  }, [itemGroups, itemCategories, uoms, countries, permitTypes, initialData, getValues, setValue]);

  useEffect(() => {
    if (currentBrand && currentBrand !== brandInput) {
      if (!showBrandDropdown) {
        const matched = normalizedBrands.find((b) => b.value === currentBrand);
        setBrandInput(matched ? matched.label : currentBrand);
      }
    }
  }, [currentBrand, showBrandDropdown, brandInput, normalizedBrands]);

  const handleAddAttachment = () => {
    if (!canManageAttachments) {
      toast.info('Attachments are available in Edit mode only');
      return;
    }
    if (!attachCategory || !attachFile) {
      toast.warning('Please select category and file');
      return;
    }
    const now = new Date();
    const newItem: AttachmentItem = {
      id: `TMP-${now.getTime()}-${attachments.length + 1}`,
      category: attachCategory,
      fileName: attachFile.name,
      file: attachFile,
      updatedBy: currentFirstName || currentDisplayName || String(getValues('updatedBy') || '').trim(),
      updatedDate: format(now, 'dd-MMM-yyyy HH:mm:ss'),
      isPending: true,
    };
    setAttachments(prev => [...prev, newItem]);
    setAttachCategory('');
    setAttachFile(null);
    if (attachFileInputRef.current) {
      attachFileInputRef.current.value = '';
    }
    setShowAddFileDialog(false);
    toast.success('File attached successfully');
  };

  const handleDeleteAttachment = async (attachment: AttachmentItem) => {
    if (!canManageAttachments) return;

    const attachmentId = String(attachment.id || '').trim();
    if (!attachmentId) return;
    const fileName = String(attachment.fileName || '').trim();

    const confirmed = window.confirm(
      fileName
        ? `Confirm delete attachment "${fileName}"?`
        : 'Confirm delete this attachment?'
    );
    if (!confirmed) return;

    if (attachment.isPending === true || attachmentId.startsWith('TMP-')) {
      setAttachments((prev) => prev.filter((row) => row.id !== attachment.id));
      return;
    }

    if (!onDeleteAttachment) {
      toast.error('Delete attachment API is not configured');
      return;
    }

    try {
      setDeletingAttachmentIds((prev) => ({ ...prev, [attachmentId]: true }));
      await onDeleteAttachment(attachmentId);
      setAttachments((prev) => prev.filter((row) => row.id !== attachment.id));
      toast.success('Attachment deleted');
    } catch (error: any) {
      const message = String(error?.message || '').trim();
      toast.error(message || 'Failed to delete attachment');
    } finally {
      setDeletingAttachmentIds((prev) => {
        const { [attachmentId]: _removed, ...rest } = prev;
        return rest;
      });
    }
  };

  const handleDeleteItem = async () => {
    if (readOnlyMode) {
      toast.info('Read-only phase: delete is disabled');
      return;
    }
    if (!onDeleteItem) {
      toast.error('Delete item API is not configured');
      return;
    }

    const itemId = Number(initialData?.id);
    if (!Number.isFinite(itemId) || itemId <= 0) {
      toast.error('Invalid ItemID');
      return;
    }

    const itemCode = String(initialData?.catalogNo || currentCatalogNo || '').trim();
    const firstConfirmed = window.confirm(
      itemCode
        ? `Delete item "${itemCode}"? This action cannot be undone.`
        : 'Delete this item? This action cannot be undone.'
    );
    if (!firstConfirmed) return;

    const secondConfirmText = String(
      window.prompt('Type DELETE to confirm permanently deleting this item.', '') || ''
    ).trim().toUpperCase();

    if (secondConfirmText !== 'DELETE') {
      toast.warning('Delete canceled: confirmation text did not match');
      return;
    }

    try {
      setIsDeletingItem(true);
      await onDeleteItem(itemId, secondConfirmText);
      toast.success('Item deleted successfully');
    } catch (error: any) {
      const message = String(error?.message || '').trim();
      toast.error(message || 'Failed to delete item');
    } finally {
      setIsDeletingItem(false);
    }
  };

  const descParts = watch(['longDesc1', 'longDesc2', 'longDesc3', 'longDesc4']);
  const [descPart1, descPart2, descPart3, descPart4] = descParts.map((part) => String(part || '')) as [
    string,
    string,
    string,
    string,
  ];
  const rawLongDescription = [descPart1, descPart2, descPart3, descPart4].join('');
  const editableLongDescription = React.useMemo(
    () => stripGeneratedLongDescSuffix(rawLongDescription),
    [rawLongDescription]
  );
  const lockedLongDescSuffix = React.useMemo(
    () => buildLongDescFooter(currentMfrCatalogNo, currentMfrBrand),
    [currentMfrCatalogNo, currentMfrBrand]
  );
  const fullDescription = React.useMemo(
    () => composeLongDescWithSuffix(editableLongDescription, currentMfrCatalogNo, currentMfrBrand),
    [editableLongDescription, currentMfrCatalogNo, currentMfrBrand]
  );
  const fullDescriptionChunks = React.useMemo(
    () => splitLongDescToChunks(fullDescription),
    [fullDescription]
  );
  const editableLongDescMaxLength = React.useMemo(
    () => Math.max(0, LONG_DESC_MAX_LENGTH - (lockedLongDescSuffix.length + 2)),
    [lockedLongDescSuffix]
  );

  useEffect(() => {
    if (isReadOnly) return;

    const [chunk1, chunk2, chunk3, chunk4] = fullDescriptionChunks;

    if (descPart1 === chunk1 && descPart2 === chunk2 && descPart3 === chunk3 && descPart4 === chunk4) {
      return;
    }

    setValue('longDesc1', chunk1, { shouldDirty: false, shouldValidate: false, shouldTouch: false });
    setValue('longDesc2', chunk2, { shouldDirty: false, shouldValidate: false, shouldTouch: false });
    setValue('longDesc3', chunk3, { shouldDirty: false, shouldValidate: false, shouldTouch: false });
    setValue('longDesc4', chunk4, { shouldDirty: false, shouldValidate: false, shouldTouch: false });
  }, [descPart1, descPart2, descPart3, descPart4, fullDescriptionChunks, isReadOnly, setValue]);

  const initialDataResetKey = React.useMemo(
    () => (initialData ? JSON.stringify(initialData) : ''),
    [initialData]
  );

  useEffect(() => {
    if (!initialData) return;
    if (lastInitialDataResetKeyRef.current === initialDataResetKey) return;

    lastInitialDataResetKeyRef.current = initialDataResetKey;
    const formattedData = {
      ...initialData,
      updatedDate: formatDateTimeDisplay(initialData.updatedDate || ''),
    }
    reset(formattedData);
  }, [initialData, initialDataResetKey, reset]);

  useEffect(() => {
    setAttachments(initialAttachments.map((row) => ({
      ...row,
      isPending: false,
    })));
  }, [initialAttachments]);

  const onSubmit = async (data: ItemData) => {
    if (readOnlyMode) {
      toast.info('Read-only phase: save is disabled');
      return;
    }

    const [longDesc1, longDesc2, longDesc3, longDesc4] = buildLongDescWithSuffix(data);
    const pendingAttachments: ItemSaveAttachmentInput[] = canManageAttachments
      ? attachments.flatMap((item) => {
        if (item.isPending !== true || !(item.file instanceof File)) {
          return [];
        }

        const category = String(item.category || '').trim();
        const fileName = String(item.fileName || '').trim();
        if (!category || !fileName) {
          return [];
        }

        return [{
          category,
          fileName,
          file: item.file,
        }];
      })
      : [];

    await onSave({
      ...data,
      longDesc1,
      longDesc2,
      longDesc3,
      longDesc4,
      updatedBy: currentFirstName || String(data.updatedBy || '').trim(),
      updatedDate: format(new Date(), 'dd-MMM-yyyy HH:mm:ss'),
    }, {
      pendingAttachments,
      imageFile: canManageItemImage ? selectedImageFile : null,
    });
  };

  const onInvalidSubmit = () => {
    toast.warning('Please fill all required fields before saving');
  };

  const handleOpenReferenceUrl = () => {
    const current = String(getValues('referenceUrl') ?? '').trim();
    if (!current) return;

    const targetUrl = normalizeReferenceUrl(current);
    try {
      const popup = window.open(targetUrl, '_blank', 'noopener,noreferrer');
      if (!popup) {
        toast.warning('Popup blocked. Please allow popups for this site.');
      }
    } catch {
      toast.error('Invalid reference URL');
    }
  };

  const handleAcknowledgeNewItemCandidateWithToast = () => {
    if (!currentIdentityKey) return;
    handleAcknowledgeNewItemCandidate();
    toast.success('New item candidate confirmed. You can continue filling the draft item.');
  };

  const handleOpenExistingItem = (itemId: number) => {
    if (!Number.isFinite(itemId) || itemId <= 0) return;
    onOpenItem?.(itemId);
  };

  const disableSave = isReadOnly
    || isSubmitting;
  const itemIds = React.useMemo<ItemFormElementIds>(() => ({
    mfrBrand: 'item-mfrBrand',
    longDescriptionInput: 'item-longDescriptionInput',
    longDesc1: 'item-longDesc1',
    longDesc2: 'item-longDesc2',
    longDesc3: 'item-longDesc3',
    longDesc4: 'item-longDesc4',
    attachmentCategory: 'item-attachmentCategory',
    attachmentFileName: 'item-attachmentFileName',
    attachmentFile: 'item-attachmentFile',
    permitType: 'item-permitType',
    hsCode: 'item-hsCode',
    generalSpec: 'item-generalSpec',
    referenceUrl: 'item-referenceUrl',
    imageUpload: 'item-imageUpload',
    updatedBy: 'item-updatedBy',
    updatedDate: 'item-updatedDate',
  }), []);

  return (
    <div className="bg-white shadow-sm border border-gray-200 min-h-full pb-10 relative">
      <ItemFormHeader
        isNew={isNew}
        isView={isView}
        isEdit={isEdit}
        readOnlyMode={readOnlyMode}
        isPrinting={isPrinting}
        isDeletingItem={isDeletingItem}
        canDeleteItemRecord={canDeleteItemRecord}
        disableSave={disableSave}
        currentCatalogNo={currentCatalogNo}
        termCount={termCount}
        itemId={initialData?.id}
        onExit={onExit}
        onCancel={onCancel}
        onChangeMode={onChangeMode}
        onCreateTerm={onCreateTerm}
        onPrint={handlePrint}
        onDeleteItem={handleDeleteItem}
        onSaveClick={handleSubmit(onSubmit, onInvalidSubmit)}
      />

      <form className="w-full px-5 py-6 mx-auto">
        {isNew && (
          <SearchBeforeCreatePanel
            currentBrand={currentBrand}
            currentMfrCatalogNo={currentMfrCatalogNo}
            searchBeforeCreate={searchBeforeCreate}
            hasIdentityInput={hasIdentityInput}
            hasSearchReview={hasSearchReview}
            onRecheckExistingItems={handleRecheckExistingItems}
            onOpenExistingItem={handleOpenExistingItem}
            onAcknowledgeNewItemCandidate={handleAcknowledgeNewItemCandidateWithToast}
          />
        )}

        <div className="grid grid-cols-12 gap-6 items-stretch">
          <ItemLeftColumn
            control={control}
            register={register}
            isNew={isNew}
            isReadOnly={isReadOnly}
            initialData={initialData}
            itemGroups={itemGroups}
            itemCategories={itemCategories}
            uoms={uoms}
            countries={countries}
            itemIds={itemIds}
            brandRef={brandRef}
            brandInput={brandInput}
            showBrandDropdown={showBrandDropdown}
            filteredBrands={filteredBrands}
            setBrandInput={setBrandInput}
            setShowBrandDropdown={setShowBrandDropdown}
          />

          <ItemCenterColumn
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            previewImage={previewImage}
            onImageError={handleImageError}
            canManageItemImage={canManageItemImage}
            canManageAttachments={canManageAttachments}
            isNew={isNew}
            isReadOnly={isReadOnly}
            itemIds={itemIds}
            handleImageUpload={handleImageUpload}
            editableLongDescMaxLength={editableLongDescMaxLength}
            editableLongDescription={editableLongDescription}
            lockedLongDescSuffix={lockedLongDescSuffix}
            currentMfrCatalogNo={currentMfrCatalogNo}
            currentMfrBrand={currentMfrBrand}
            fullDescriptionChunks={fullDescriptionChunks}
            fullDescription={fullDescription}
            setValue={setValue}
            attachments={attachments}
            buildAttachmentDownloadUrl={buildAttachmentDownloadUrl}
            deletingAttachmentIds={deletingAttachmentIds}
            handleDeleteAttachment={handleDeleteAttachment}
            showAddFileDialog={showAddFileDialog}
            setShowAddFileDialog={setShowAddFileDialog}
            attachCategory={attachCategory}
            setAttachCategory={setAttachCategory}
            attachFile={attachFile}
            setAttachFile={setAttachFile}
            attachFileInputRef={attachFileInputRef}
            handleAddAttachment={handleAddAttachment}
          />

          <ItemRightColumn
            control={control}
            register={register}
            isReadOnly={isReadOnly}
            permitRequired={permitRequired}
            permitTypes={permitTypes}
            itemIds={itemIds}
            hasReferenceUrl={hasReferenceUrl}
            handleOpenReferenceUrl={handleOpenReferenceUrl}
            mode={mode}
            updatedByValue={updatedByValue}
            updatedDateValue={updatedDateValue}
          />
        </div>
      </form>
    </div>
  );
}
