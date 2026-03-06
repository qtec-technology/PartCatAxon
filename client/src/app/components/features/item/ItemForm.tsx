import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import {
  ArrowLeft, Printer, Trash2, Plus, Edit, Save, X, LogOut,
  Upload, Paperclip, ExternalLink
} from 'lucide-react';
import { format } from 'date-fns';
import {
  Button, Input, Select, TextArea,
  SectionHeader, Badge, cn
} from '../common/atoms';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../ui/table';
import {
  ItemData, FormMode
} from '../../../types/item_types';
import { itemApi } from '../../../services/item.api';
import { lookupApi, LookupOption, ItemFormLookups } from '../../../services/lookup.api';
import { useAuth } from '../../../auth/AuthContext';
import { clientLogger } from '../../../utils/logger';
import { toast } from 'sonner';

export interface ItemSaveAttachmentInput {
  category: string;
  fileName: string;
}

export interface ItemFormSaveOptions {
  pendingAttachments: ItemSaveAttachmentInput[];
  imageFile: File | null;
}

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
  readOnlyMode?: boolean;
}

interface AttachmentItem {
  id: string;
  category: string;
  fileName: string;
  updatedBy: string;
  updatedDate: string;
  isPending?: boolean;
}

const LONG_DESC_CHUNK_SIZE = 254;
const LONG_DESC_MAX_LENGTH = LONG_DESC_CHUNK_SIZE * 4;
const GENERATED_LONG_DESC_SUFFIX_REGEX = /(?:\r?\n)?P\/N:\s*[^\r\n]*\r?\nMFG:\s*[^\r\n]*\s*$/i;
const DEFAULT_ITEM_PREVIEW_IMAGE = `${import.meta.env.BASE_URL}items/qtec_image_500.jpg`;
const NULL_LOOKUP_VALUE = '_Null';
const NULL_LOOKUP_LABEL = 'Please Select';

const splitLongDescToChunks = (text: string): [string, string, string, string] => {
  const clipped = text.slice(0, LONG_DESC_MAX_LENGTH);
  return [
    clipped.slice(0, LONG_DESC_CHUNK_SIZE),
    clipped.slice(LONG_DESC_CHUNK_SIZE, LONG_DESC_CHUNK_SIZE * 2),
    clipped.slice(LONG_DESC_CHUNK_SIZE * 2, LONG_DESC_CHUNK_SIZE * 3),
    clipped.slice(LONG_DESC_CHUNK_SIZE * 3, LONG_DESC_CHUNK_SIZE * 4),
  ];
};

const buildLongDescFooter = (mfrCatalogNo: string, mfrBrand: string): string => {
  const pn = String(mfrCatalogNo || '').trim();
  const mfg = String(mfrBrand || '').trim();
  return `P/N: ${pn}\r\nMFG: ${mfg}`;
};

const stripGeneratedLongDescSuffix = (text: string): string =>
  String(text || '')
    .replace(GENERATED_LONG_DESC_SUFFIX_REGEX, '');

const composeLongDescWithSuffix = (
  baseText: string,
  mfrCatalogNo: string,
  mfrBrand: string
): string => {
  const body = stripGeneratedLongDescSuffix(baseText);
  const footer = buildLongDescFooter(mfrCatalogNo, mfrBrand);
  const merged = body.length > 0 ? `${body}\r\n${footer}` : footer;
  return merged.slice(0, LONG_DESC_MAX_LENGTH);
};

const buildLongDescWithSuffix = (data: ItemData): [string, string, string, string] => {
  const baseLongDesc = [
    String(data.longDesc1 || ''),
    String(data.longDesc2 || ''),
    String(data.longDesc3 || ''),
    String(data.longDesc4 || ''),
  ].join('');

  const merged = composeLongDescWithSuffix(baseLongDesc, data.mfrCatalogNo, data.mfrBrand);
  return splitLongDescToChunks(merged);
};

const normalizeLookupOption = (option: unknown): LookupOption | null => {
  if (typeof option === 'string') {
    const text = option.trim();
    if (!text) return null;
    return { value: text, label: text };
  }
  if (!option || typeof option !== 'object') return null;

  const raw = option as Record<string, unknown>;
  const value = String(raw.value ?? raw.Code ?? raw.code ?? '').trim();
  const label = String(raw.label ?? raw.U_Brand ?? raw.Name ?? raw.name ?? value).trim();
  const normalizedValue = value || label;
  const normalizedLabel = label || value;

  if (!normalizedValue || !normalizedLabel) return null;
  return { value: normalizedValue, label: normalizedLabel };
};

const ensureNullLookupOption = (options: LookupOption[]): LookupOption[] => {
  const normalized = options
    .map((option) => ({
      value: String(option.value ?? '').trim(),
      label: String(option.label ?? '').trim(),
    }))
    .filter((option) => option.value && option.label);

  const hasNullOption = normalized.some((option) => option.value === NULL_LOOKUP_VALUE);
  if (hasNullOption) return normalized;

  return [{ value: NULL_LOOKUP_VALUE, label: NULL_LOOKUP_LABEL }, ...normalized];
};

const normalizeSelectValue = (currentValue: string, options: LookupOption[]): string => {
  const current = currentValue.trim();
  if (!current || options.length === 0) return current;

  const exactValue = options.find((opt) => String(opt.value ?? '').trim() === current);
  if (exactValue) return exactValue.value;

  const valueMatch = options.find((opt) => String(opt.value ?? '').trim().toLowerCase() === current.toLowerCase());
  if (valueMatch) return valueMatch.value;

  const labelMatch = options.find((opt) => String(opt.label ?? '').trim().toLowerCase() === current.toLowerCase());
  if (labelMatch) return labelMatch.value;

  return current;
};

const formatDateTimeDisplay = (rawValue: string): string => {
  const value = String(rawValue || '').trim();
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return format(parsed, 'dd-MMM-yyyy HH:mm:ss');
};



export function ItemForm({
  mode,
  initialData,
  attachments: initialAttachments = [],
  termCount = null,
  prefetchedLookups,
  onSave,
  onDeleteAttachment,
  onDeleteItem,
  onCancel,
  onExit,
  onChangeMode,
  readOnlyMode = false
}: ItemFormProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isNew = mode === 'NEW';
  const isView = mode === 'VIEW';
  const isEdit = mode === 'EDIT';
  const isReadOnly = readOnlyMode || isView;
  const canManageItemImage = isEdit && !isReadOnly;
  const canManageAttachments = isEdit && !isReadOnly;
  const currentDisplayName = String(user?.displayName || user?.username || '').trim();
  const currentFirstName = String(
    user?.firstname || currentDisplayName.split(/\s+/)[0] || user?.username || ''
  ).trim();

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

  const [previewImage, setPreviewImage] = useState<string>(DEFAULT_ITEM_PREVIEW_IMAGE);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [isDeletingItem, setIsDeletingItem] = useState(false);

  // Attachment state
  const [attachments, setAttachments] = useState<AttachmentItem[]>(initialAttachments);
  const [deletingAttachmentIds, setDeletingAttachmentIds] = useState<Record<string, boolean>>({});
  const [showAddFileDialog, setShowAddFileDialog] = useState(false);
  const [attachCategory, setAttachCategory] = useState('');
  const [attachFile, setAttachFile] = useState<File | null>(null);
  const attachFileInputRef = React.useRef<HTMLInputElement>(null);

  const [brands, setBrands] = useState<LookupOption[]>(prefetchedLookups?.brands || []);
  const [brandInput, setBrandInput] = useState('');
  const [showBrandDropdown, setShowBrandDropdown] = useState(false);
  const brandRef = React.useRef<HTMLDivElement>(null); // To detect click outside if we wrapped the component
  const [itemGroups, setItemGroups] = useState<LookupOption[]>(prefetchedLookups?.itemGroups || []);
  const [uoms, setUoms] = useState<LookupOption[]>(prefetchedLookups?.uoms || []);
  const [countries, setCountries] = useState<LookupOption[]>(
    ensureNullLookupOption(prefetchedLookups?.countries || [])
  );
  const [permitTypes, setPermitTypes] = useState<LookupOption[]>(prefetchedLookups?.permitTypes || []);
  const [itemCategories, setItemCategories] = useState<LookupOption[]>(
    ensureNullLookupOption(prefetchedLookups?.itemCategories || [])
  );
  const [isPrinting, setIsPrinting] = useState(false);

  // Filter brands
  const normalizedBrands = React.useMemo(() => {
    return (brands as unknown[])
      .map(normalizeLookupOption)
      .filter((b): b is LookupOption => b !== null);
  }, [brands]);

  const filteredBrands = React.useMemo(() => {
    if (!brandInput) return normalizedBrands;
    const q = String(brandInput ?? '').toUpperCase();
    return normalizedBrands.filter((b) => String(b.label ?? '').toUpperCase().includes(q));
  }, [brandInput, normalizedBrands]);

  // Click outside to close dropdown (We'll relying on onBlur or a wrapper ref approach)
  // Since we put the dropdown inside the Controller, we might want a simple onBlur handler or a global click listener.
  // The simple onMouseDown on items works for selection. For closing when clicking away without selecting:
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      // We'll need a ref on the container
      if (brandRef.current && !brandRef.current.contains(e.target as Node)) {
        setShowBrandDropdown(false);
        // Optional: If input doesn't match a valid brand, revert? Or allow free text?
        // "Mfr Brand" usually strict? For now allow what's typed or revert to form value?
        // Safer to just close. User sees what they typed.
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!prefetchedLookups) return;
    setBrands(prefetchedLookups.brands);
    setItemGroups(prefetchedLookups.itemGroups);
    setUoms(prefetchedLookups.uoms);
    setCountries(ensureNullLookupOption(prefetchedLookups.countries));
    setPermitTypes(prefetchedLookups.permitTypes);
    setItemCategories(ensureNullLookupOption(prefetchedLookups.itemCategories));
  }, [prefetchedLookups]);

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
    if (prefetchedLookups) return;

    let cancelled = false;
    const loadLookups = async () => {
      try {
        const lookups = await lookupApi.getItemFormLookups();
        if (cancelled) return;
        setBrands(lookups.brands);
        setItemGroups(lookups.itemGroups);
        setUoms(lookups.uoms);
        setCountries(ensureNullLookupOption(lookups.countries));
        setPermitTypes(lookups.permitTypes);
        setItemCategories(ensureNullLookupOption(lookups.itemCategories));
      } catch (error) {
        clientLogger.error('Failed to load item lookups', error);
      }
    };

    loadLookups();
    return () => {
      cancelled = true;
    };
  }, [prefetchedLookups]);

  // Sync brandInput with form value when loaded
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

  // Also watch for form reset/updates
  const currentBrand = watch('mfrBrand');
  useEffect(() => {
    if (currentBrand && currentBrand !== brandInput) {
      // Only update if significantly different to avoid fighting with user typing
      // Usually needed if external reset happens
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
      updatedBy: currentFirstName || currentDisplayName || String(getValues('updatedBy') || '').trim(),
      updatedDate: format(now, 'dd-MMM-yyyy HH:mm:ss'),
      isPending: true,
    };
    setAttachments(prev => [...prev, newItem]);
    setAttachCategory('');
    setAttachFile(null);
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

    // Pending rows exist only on UI; no DB record yet.
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

  // Watch for description parts to combine for preview
  const currentMfrCatalogNo = String(watch('mfrCatalogNo') || '').trim();
  const currentMfrBrand = String(currentBrand || '').trim();
  const descParts = watch(['longDesc1', 'longDesc2', 'longDesc3', 'longDesc4']);
  const rawLongDescription = descParts.join('');
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
    const [chunk1, chunk2, chunk3, chunk4] = fullDescriptionChunks;
    const [current1, current2, current3, current4] = descParts;

    if (current1 === chunk1 && current2 === chunk2 && current3 === chunk3 && current4 === chunk4) {
      return;
    }

    setValue('longDesc1', chunk1);
    setValue('longDesc2', chunk2);
    setValue('longDesc3', chunk3);
    setValue('longDesc4', chunk4);
  }, [descParts, fullDescriptionChunks, setValue]);

  // Update form when initialData changes or mode switches
  useEffect(() => {
    if (initialData) {
      const formattedData = {
        ...initialData,
        updatedDate: formatDateTimeDisplay(initialData.updatedDate || ''),
      };
      reset(formattedData);
    }
  }, [initialData, reset]);

  useEffect(() => {
    setAttachments(initialAttachments.map((row) => ({
      ...row,
      isPending: false,
    })));
  }, [initialAttachments]);

  useEffect(() => {
    const itemId = initialData?.id;
    setSelectedImageFile(null);

    if (!itemId) {
      setPreviewImage(DEFAULT_ITEM_PREVIEW_IMAGE);
      return;
    }

    // Use hasImage flag from server — no HEAD request needed
    if (!initialData?.hasImage) {
      setPreviewImage(DEFAULT_ITEM_PREVIEW_IMAGE);
      return;
    }

    const cacheKey = initialData?.updatedDate ? String(initialData.updatedDate) : '';
    const imageUrl = itemApi.getItemImageUrl(itemId, cacheKey);
    if (!imageUrl) {
      setPreviewImage(DEFAULT_ITEM_PREVIEW_IMAGE);
      return;
    }

    setPreviewImage(imageUrl);
  }, [initialData?.id, initialData?.updatedDate, initialData?.hasImage]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!canManageItemImage) {
      toast.info('Image upload is available in Edit mode only');
      return;
    }
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const onSubmit = async (data: ItemData) => {
    if (readOnlyMode) {
      toast.info('Read-only phase: save is disabled');
      return;
    }
    const [longDesc1, longDesc2, longDesc3, longDesc4] = buildLongDescWithSuffix(data);
    const pendingAttachments = canManageAttachments
      ? attachments
        .filter((item) => item.isPending === true)
        .map((item) => ({
          category: String(item.category || '').trim(),
          fileName: String(item.fileName || '').trim(),
        }))
        .filter((item) => item.category && item.fileName)
      : [];

    await onSave({
      ...data,
      longDesc1,
      longDesc2,
      longDesc3,
      longDesc4,
      // Keep blank in NEW until save; set audit fields at submit time.
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

  const normalizeReferenceUrl = (rawUrl: string): string => {
    const trimmed = rawUrl.trim();
    if (!trimmed) return '';
    if (/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmed)) {
      return trimmed;
    }
    return `https://${trimmed}`;
  };

  const referenceUrlRaw = String(watch('referenceUrl') ?? '').trim();
  const hasReferenceUrl = referenceUrlRaw.length > 0;
  const permitRequired = Boolean(watch('permitRequired'));
  const updatedByValue = String(watch('updatedBy') || '');
  const updatedDateValue = String(watch('updatedDate') || '');

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



  // Checkbox Row Component for consistency
  const CheckboxRow = ({ label, name, isRed = false, isGray = false }: { label: string, name: keyof ItemData, isRed?: boolean, isGray?: boolean }) => (
    <div className="flex justify-end items-center gap-2 h-7">
      <span className={cn(
        "text-xs text-right",
        isRed ? "text-[#C12B2B] font-bold uppercase" : "",
        isGray ? "text-gray-400 uppercase" : "text-gray-700"
      )}>{label}</span>
      <Controller
        name={name}
        control={control}
        render={({ field: { value, ...fieldProps } }) => (
          <input
            type="checkbox"
            {...fieldProps}
            checked={!!value}
            disabled={isReadOnly}
            className={cn(
              "h-4 w-4 rounded border-gray-400",
              "accent-[#2264A0]"
            )}
          />
        )}
      />
    </div>
  );

  const currentCatalogNo = watch('catalogNo') || initialData?.catalogNo || '';
  const disableSave = isReadOnly || isSubmitting;

  return (
    <div className="bg-white shadow-sm border border-gray-200 min-h-full pb-10 relative">
      {/* HEADER SECTION */}
      <div className="px-3 sm:px-5 py-3 sm:py-4 border-b border-gray-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={onExit}
              className="shrink-0 whitespace-nowrap text-gray-600 hover:text-gray-900 print:hidden"
            >
              <ArrowLeft className="w-5 h-5 mr-1" /> Back to Search
            </Button>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-bold leading-tight text-gray-800 whitespace-nowrap">
                  {isNew ? 'ADD NEW ITEM' : `ITEM - ${currentCatalogNo || '-'}`}
                </h1>
                {!isNew && (
                  <>
                    <Badge>{currentCatalogNo || '-'}</Badge>
                    {termCount !== null && <Badge className="bg-[#5AA02A]">{`Terms: ${termCount}`}</Badge>}
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex w-full flex-wrap items-center gap-2 xl:w-auto xl:justify-end print:hidden">
            {isView && (
              <>
                <Button
                  type="button"
                  variant="primary"
                  className="whitespace-nowrap"
                  onClick={handlePrint}
                  title="Print Item (Ctrl/Cmd + P)"
                  aria-label="Print Item"
                  disabled={isPrinting}
                >
                  <Printer className="w-4 h-4" /> {isPrinting ? 'PRINTING...' : 'PRINT ITEM'}
                </Button>
                <Button
                  variant="danger"
                  className="whitespace-nowrap"
                  onClick={() => { void handleDeleteItem(); }}
                  disabled={readOnlyMode || isDeletingItem}
                  title={readOnlyMode ? 'Read-only phase' : 'Delete item'}
                >
                  <Trash2 className="w-4 h-4" /> {isDeletingItem ? 'DELETING...' : 'DELETE'}
                </Button>
                <Button
                  variant="primary"
                  className="whitespace-nowrap"
                  onClick={() => navigate(`/term/new?itemId=${initialData?.id || ''}`)}
                  disabled={readOnlyMode}
                  title={readOnlyMode ? 'Read-only phase' : 'Add term'}
                >
                  <Plus className="w-4 h-4" /> ADD TERM
                </Button>
                {!readOnlyMode && (
                  <Button
                    variant="warning"
                    className="whitespace-nowrap"
                    onClick={() => onChangeMode('EDIT')}
                  >
                    <Edit className="w-4 h-4" /> EDIT
                  </Button>
                )}
              </>
            )}

            {(isNew || isEdit) && (
              <Button
                variant="success"
                className="whitespace-nowrap"
                onClick={handleSubmit(onSubmit, onInvalidSubmit)}
                disabled={disableSave}
              >
                <Save className="w-4 h-4" /> SAVE
              </Button>
            )}

            {isEdit && (
              <Button variant="neutral" className="whitespace-nowrap" onClick={onCancel}>
                <X className="w-4 h-4" /> CANCEL
              </Button>
            )}

            <Button variant="neutral" className="whitespace-nowrap" onClick={onExit}>
              <LogOut className="w-4 h-4" /> EXIT
            </Button>
          </div>
        </div>
      </div>

      <form className="w-full px-5 py-6 mx-auto">
        {/* MAIN 3-COLUMN LAYOUT */}
        <div className="grid grid-cols-12 gap-6 items-stretch">

          {/* LEFT COLUMN (25%) - Form Fields */}
          <div className="col-span-12 lg:col-span-3 flex flex-col">
            <SectionHeader title="Item Information" />
            <div className="flex-1 p-4 border border-gray-200 border-t-0 rounded-b-md bg-white">

              {/* Row 1: Item Group + Catalog No */}
              <div className="grid gap-2" style={{ gridTemplateColumns: '1fr 2fr' }}>
                <Select
                  label="Item Group"
                  required
                  options={itemGroups}
                  placeholder="Please select"
                  disabled={isReadOnly}
                  {...register('itemGroup', { required: 'Item Group is required' })}
                />
                <Input
                  label="Catalog No"
                  fullWidth
                  disabled
                  value={isNew ? '(Auto-generated)' : (initialData?.catalogNo || 'PFG000001')}
                  className="bg-gray-100 text-gray-500 italic"
                />
              </div>

              {/* Row 2: B1 Item No (auto-generated) */}
              <Input
                label="B1 Item No"
                fullWidth
                disabled
                value={isNew ? '(Auto-generated)' : (initialData?.b1ItemNo || '')}
                className="bg-gray-100 text-gray-500 italic"
              />

              {/* Row 3: Mfr Brand (Autocomplete) */}
              <div className="mb-3 w-full">
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Mfr Brand
                  <span className="text-[#C12B2B] ml-1">*</span>
                </label>
                <Controller
                  name="mfrBrand"
                  control={control}
                  rules={{ required: 'Mfr Brand is required' }}
                  render={({ field, fieldState: { error } }) => (
                    <div className="relative" ref={brandRef}>
                      <input
                        type="text"
                        className={cn(
                          "w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:border-[#2264A0] focus:ring-1 focus:ring-[#2264A0]",
                          isReadOnly && "bg-[#F5F5F5] text-gray-500",
                          error && "border-[#C12B2B]"
                        )}
                        placeholder="Select or type brand..."
                        value={brandInput} // Use local input state for typing
                        disabled={isReadOnly}
                        onChange={(e) => {
                          setBrandInput(e.target.value);
                          setShowBrandDropdown(true);
                          // Optional: Clear field value if user clears input, or keep it?
                          // Let's clear it if input is empty to force selection/valid typing
                          if (!e.target.value) field.onChange('');
                        }}
                        onFocus={() => {
                          if (!isReadOnly) setShowBrandDropdown(true);
                        }}
                      // On blur, we might want to hide, but we need to handle click on dropdown item first.
                      // Usually solved by click-outside listener (already implemented in SearchCriteriaPanel, need here too?)
                      />
                      {/* Hidden input to hold the actual form value if needed, but Controller handles 'field' */}

                      {showBrandDropdown && !isReadOnly && (
                        <div className="absolute z-50 mt-1 w-full max-h-[200px] overflow-y-auto bg-white border border-[#A0C0E0] rounded-md shadow-lg">
                          {filteredBrands.map((b) => (
                            <div
                              key={b.value}
                              className={cn(
                                "px-2 py-1.5 text-xs cursor-pointer hover:bg-[#E8F0F8]",
                                field.value === b.value && "bg-[#D4E7F7] font-semibold"
                              )}
                              onMouseDown={(e) => {
                                // Use onMouseDown to prevent blur before click registers
                                e.preventDefault();
                                field.onChange(b.value);
                                setBrandInput(b.label);
                                setShowBrandDropdown(false);
                              }}
                            >
                              {b.label}
                            </div>
                          ))}
                          {filteredBrands.length === 0 && (
                            <div className="px-2 py-2 text-xs text-gray-400 text-center">No brand found</div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                />
              </div>

              {/* Row 4: Mfr Catalog No */}
              <Input
                label="Mfr Catalog No"
                required
                fullWidth
                maxLength={150}
                disabled={isReadOnly}
                {...register('mfrCatalogNo', { required: 'Catalog No is required', maxLength: { value: 150, message: 'Max 150 characters' } })}
              />

              {/* Row 5: Item Description */}
              <TextArea
                label="Item Description"
                required
                rows={3}
                maxLength={100}
                disabled={isReadOnly}
                {...register('itemDescription', { required: 'Description is required', maxLength: { value: 100, message: 'Max 100 characters' } })}
              />

              {/* Row 6: Item Category */}
              <Select
                label="Item Category"
                options={itemCategories}
                placeholder="Please select"
                showPlaceholderOption={false}
                disabled={isReadOnly}
                {...register('itemCategory')}
              />

              {/* Row 7: Cust Stock Code */}
              <Input
                label="Cust Stock Code"
                fullWidth
                maxLength={100}
                disabled={isReadOnly}
                {...register('customerStockCode')}
              />

              {/* Row 8: Stock UOM */}
              <Select
                label="Stock UOM"
                required
                options={uoms}
                placeholder="Please select"
                disabled={isReadOnly}
                {...register('stockUOM', { required: 'UOM is required' })}
              />

              {/* Row 9: Country of Origin */}
              <Select
                label="Country of Origin"
                options={countries}
                placeholder="Please Select"
                showPlaceholderOption={false}
                disabled={isReadOnly}
                {...register('countryOfOrigin')}
              />

              {/* Row 10-12: ECCN, UNSPSC, e-Procurement Code */}
              <Input label="ECCN" fullWidth maxLength={50} disabled={isReadOnly} {...register('eccn')} />
              <Input label="UNSPSC" fullWidth maxLength={10} disabled={isReadOnly} {...register('unspsc')} />
              <Input label="e-Procurement Code" fullWidth maxLength={10} disabled={isReadOnly} {...register('eProcurementCode')} />

              {/* Row 13: Special Requirement */}
              <TextArea label="Special Requirement" rows={3} maxLength={254} disabled={isReadOnly} {...register('specialRequirement')} />

              {/* Row 14: Remark */}
              <TextArea label="REMARK" rows={6} maxLength={254} disabled={isReadOnly} {...register('remark')} />
            </div>
          </div>

          {/* CENTER COLUMN (50%) - Image + Description */}
          <div className="col-span-12 lg:col-span-6 flex flex-col gap-4">

            {/* Image Preview Section */}
            <div className="bg-gray-50 p-4 border border-gray-200 rounded">
              <div className="bg-white border border-gray-300 w-64 aspect-square mx-auto flex items-center justify-center mb-2 overflow-hidden relative">
                <a
                  href={previewImage}
                  target="_blank"
                  rel="noreferrer"
                  className="h-full w-full block"
                  title="Open image"
                >
                  <img
                    src={previewImage}
                    alt="Preview"
                    className="h-full w-full object-contain"
                    onError={() => {
                      setPreviewImage((prev) =>
                        prev === DEFAULT_ITEM_PREVIEW_IMAGE ? prev : DEFAULT_ITEM_PREVIEW_IMAGE
                      );
                    }}
                  />
                </a>
              </div>
              {canManageItemImage && (
                <div className="flex justify-center">
                  <label className="cursor-pointer bg-[#2264A0] text-white px-3 py-1 text-sm rounded hover:bg-blue-800 flex items-center gap-2">
                    <Upload className="w-3 h-3" /> Upload Img
                    <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                  </label>
                </div>
              )}
              {isNew && (
                <p className="mt-2 text-center text-xs text-gray-500">
                  Image upload is available after creating item (Edit mode).
                </p>
              )}
            </div>

            {/* Tabs: Long Desc / Attachment */}
            <div className="border border-gray-200 rounded overflow-hidden bg-white">
              <div className="flex border-b border-gray-200 bg-gray-100">
                <button
                  type="button"
                  className={cn("px-4 py-2 text-sm font-bold", activeTab === 'desc' ? "bg-white border-t-2 border-t-[#2264A0] text-[#2264A0]" : "text-gray-500 hover:text-gray-700")}
                  onClick={() => setActiveTab('desc')}
                >
                  Long Description
                </button>
                <button
                  type="button"
                  className={cn("px-4 py-2 text-sm font-bold", activeTab === 'attach' ? "bg-white border-t-2 border-t-[#2264A0] text-[#2264A0]" : "text-gray-500 hover:text-gray-700")}
                  onClick={() => setActiveTab('attach')}
                >
                  Attachments
                </button>
              </div>

              <div className="p-4">
                {activeTab === 'desc' && (
                  <div className="space-y-3">
                    {/* Input Area */}
                    <div>
                      <label className="text-xs font-bold text-gray-700 mb-2 block">
                        ✏️ Long Description Input
                      </label>
                      <div className="relative">
                        <textarea
                          className={cn(
                            "w-full border rounded px-2 py-1.5 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-[#2264A0]/30 resize-none",
                            isReadOnly
                              ? "border-gray-300 bg-[#F5F5F5] text-gray-500"
                              : "border-[#2264A0] bg-white"
                          )}
                          rows={15}
                          maxLength={editableLongDescMaxLength}
                          placeholder="Type the full long description here..."
                          value={editableLongDescription}
                          disabled={isReadOnly}
                          onChange={(e) => {
                            const body = e.target.value.slice(0, editableLongDescMaxLength);
                            const merged = composeLongDescWithSuffix(body, currentMfrCatalogNo, currentMfrBrand);
                            const [chunk1, chunk2, chunk3, chunk4] = splitLongDescToChunks(merged);
                            setValue('longDesc1', chunk1);
                            setValue('longDesc2', chunk2);
                            setValue('longDesc3', chunk3);
                            setValue('longDesc4', chunk4);
                          }}
                        />
                        {editableLongDescription.length > 0 && !isReadOnly && (
                          <button
                            type="button"
                            onClick={() => {
                              const [chunk1, chunk2, chunk3, chunk4] = splitLongDescToChunks(
                                composeLongDescWithSuffix('', currentMfrCatalogNo, currentMfrBrand)
                              );
                              setValue('longDesc1', chunk1);
                              setValue('longDesc2', chunk2);
                              setValue('longDesc3', chunk3);
                              setValue('longDesc4', chunk4);
                            }}
                            className="absolute top-1.5 right-1.5 w-5 h-5 flex items-center justify-center rounded-full bg-gray-300 hover:bg-red-400 hover:text-white text-gray-600 text-xs transition-colors"
                            title="Clear all"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                      <div className="mt-2 rounded border border-dashed border-gray-300 bg-gray-50 p-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Auto-appended (Locked)</p>
                        <pre className="mt-1 whitespace-pre-wrap text-xs text-gray-700 font-mono">{lockedLongDescSuffix}</pre>
                      </div>
                    </div>

                    {/* Result: 4 Read-Only Boxes */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-gray-50 p-2 border rounded">
                        <label className="text-[10px] text-gray-500 block mb-1">LongDesc1 (Max 254) — <span className="font-semibold">{fullDescriptionChunks[0].length}</span>/254</label>
                        <textarea
                          disabled
                          className="w-full text-xs border p-1 bg-[#F5F5F5] text-gray-600 resize-none" rows={8}
                          value={fullDescriptionChunks[0]}
                          readOnly
                        />
                      </div>
                      <div className="bg-gray-50 p-2 border rounded">
                        <label className="text-[10px] text-gray-500 block mb-1">LongDesc2 (Max 254) — <span className="font-semibold">{fullDescriptionChunks[1].length}</span>/254</label>
                        <textarea
                          disabled
                          className="w-full text-xs border p-1 bg-[#F5F5F5] text-gray-600 resize-none" rows={8}
                          value={fullDescriptionChunks[1]}
                          readOnly
                        />
                      </div>
                      <div className="bg-gray-50 p-2 border rounded">
                        <label className="text-[10px] text-gray-500 block mb-1">LongDesc3 (Max 254) — <span className="font-semibold">{fullDescriptionChunks[2].length}</span>/254</label>
                        <textarea
                          disabled
                          className="w-full text-xs border p-1 bg-[#F5F5F5] text-gray-600 resize-none" rows={8}
                          value={fullDescriptionChunks[2]}
                          readOnly
                        />
                      </div>
                      <div className="bg-gray-50 p-2 border rounded">
                        <label className="text-[10px] text-gray-500 block mb-1">LongDesc4 (Max 254) — <span className="font-semibold">{fullDescriptionChunks[3].length}</span>/254</label>
                        <textarea
                          disabled
                          className="w-full text-xs border p-1 bg-[#F5F5F5] text-gray-600 resize-none" rows={8}
                          value={fullDescriptionChunks[3]}
                          readOnly
                        />
                      </div>
                    </div>

                    <div className="text-right text-xs text-gray-500">
                      {fullDescription.length} / 1016 characters (includes locked suffix)
                    </div>
                  </div>
                )}

                {activeTab === 'attach' && (
                  <div>
                    {isNew && (
                      <p className="mb-3 text-xs text-gray-500">
                        Attachments are available after creating item (Edit mode).
                      </p>
                    )}
                    {/* Add File button */}
                    {canManageAttachments && (
                      <div className="mb-3 flex w-full justify-end">
                        <Button
                          type="button"
                          size="md"
                          variant="primary"
                          className="min-h-5 px-4 text-sm font-semibold"
                          onClick={() => setShowAddFileDialog(true)}
                        >
                          <Plus className="w-5 h-5" /> Add File
                        </Button>
                      </div>
                    )}

                    {/* Attachments Table */}
                    <div className="border border-gray-200 rounded overflow-x-auto">
                      <Table className="w-full min-w-[980px] text-sm">
                        <TableHeader className="bg-[#2264A0] shadow-sm sticky top-0 z-20">
                          <TableRow className="hover:bg-[#2264A0] border-b-0">
                            <TableHead className="text-white h-10 px-3 text-sm font-semibold">Category</TableHead>
                            <TableHead className="text-white h-10 px-3 text-sm font-semibold">Attachment</TableHead>
                            <TableHead className="text-white h-10 px-3 text-sm font-semibold">Updated By</TableHead>
                            <TableHead className="text-white h-10 px-3 text-sm font-semibold">Updated Date</TableHead>
                            <TableHead className="text-white h-10 px-3 text-sm font-semibold">Attachment ID</TableHead>
                            {canManageAttachments && <TableHead className="text-white h-10 px-3 w-10"></TableHead>}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {attachments.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={canManageAttachments ? 6 : 5} className="text-center py-8 text-gray-400 text-sm">
                                <Paperclip className="w-5 h-5 mx-auto mb-1 text-gray-300" />
                                No attachments found.
                              </TableCell>
                            </TableRow>
                          ) : (
                            attachments.map((att) => (
                              <TableRow key={att.id} className="hover:bg-[#E8F0F8] text-gray-700 h-10">
                                <TableCell className="px-3 py-2 border-r border-[#DDDDDD] last:border-r-0">{att.category}</TableCell>
                                <TableCell className="px-3 py-2 border-r border-[#DDDDDD] last:border-r-0 text-[#2264A0] cursor-pointer hover:underline">{att.fileName}</TableCell>
                                <TableCell className="px-3 py-2 border-r border-[#DDDDDD] last:border-r-0">{att.updatedBy}</TableCell>
                                <TableCell className="px-3 py-2 border-r border-[#DDDDDD] last:border-r-0">{formatDateTimeDisplay(att.updatedDate)}</TableCell>
                                <TableCell className="px-3 py-2 border-r border-[#DDDDDD] last:border-r-0 font-mono">{att.id}</TableCell>
                                {canManageAttachments && (
                                  <TableCell className="px-3 py-2 border-r border-[#DDDDDD] last:border-r-0">
                                    <button
                                      type="button"
                                      onClick={() => { void handleDeleteAttachment(att); }}
                                      disabled={deletingAttachmentIds[String(att.id)] === true}
                                      className={cn(
                                        "text-red-400 hover:text-red-600",
                                        deletingAttachmentIds[String(att.id)] === true && "cursor-not-allowed opacity-50"
                                      )}
                                      title="Remove"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </TableCell>
                                )}
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Add File Dialog (Modal) */}
                    {showAddFileDialog && canManageAttachments && (
                      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
                        <div className="bg-[#F0F0F0] border border-gray-400 rounded shadow-lg w-[420px]">
                          {/* Title bar */}
                          <div className="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-[#E8E8E8] to-[#D0D0D0] border-b border-gray-300">
                            <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                              <Paperclip className="w-4 h-4" />
                              Attachments of ITEM
                            </div>
                            <button type="button" onClick={() => { setShowAddFileDialog(false); setAttachCategory(''); setAttachFile(null); }} className="text-gray-500 hover:text-red-500">
                              <X className="w-4 h-4" />
                            </button>
                          </div>

                          {/* Body */}
                          <div className="p-5 space-y-4">
                            {/* Category Row */}
                            <div className="flex items-center gap-3">
                              <label className="text-sm text-gray-700 w-16 text-right">Category</label>
                              <select
                                className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm bg-white"
                                value={attachCategory}
                                onChange={(e) => setAttachCategory(e.target.value)}
                              >
                                <option value="">- Select -</option>
                                <option value="Item-Certificate">Item-Certificate</option>
                                <option value="MSDS">MSDS</option>
                                <option value="Picture">Picture</option>
                                <option value="Spec.Sheet">Spec.Sheet</option>
                                <option value="Other">Other</option>
                              </select>
                            </div>

                            {/* Upload Row */}
                            <div className="flex items-center gap-3">
                              <label className="text-sm text-gray-700 w-16 text-right">Upload</label>
                              <input
                                type="text"
                                readOnly
                                value={attachFile?.name || ''}
                                className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm bg-white"
                                placeholder=""
                              />
                              <input
                                ref={attachFileInputRef}
                                type="file"
                                className="hidden"
                                onChange={(e) => setAttachFile(e.target.files?.[0] || null)}
                              />
                              <Button
                                type="button"
                                size="sm"
                                variant="neutral"
                                onClick={() => attachFileInputRef.current?.click()}
                              >
                                Browse
                              </Button>
                            </div>
                          </div>

                          {/* Footer */}
                          <div className="flex justify-center gap-3 px-5 pb-4">
                            <Button type="button" size="sm" variant="primary" onClick={handleAddAttachment} className="min-w-[70px]">
                              Ok
                            </Button>
                            <Button type="button" size="sm" variant="neutral" onClick={() => { setShowAddFileDialog(false); setAttachCategory(''); setAttachFile(null); }} className="min-w-[70px]">
                              Cancel
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* RIGHT COLUMN (30%) - Checkboxes */}
          <div className="col-span-12 lg:col-span-3 space-y-4">
            <SectionHeader title="Status & Flags" />
            <div className="p-4 border border-gray-200 border-t-0 rounded-b-md bg-[#F5F5F5]">
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-x-2 gap-y-1">
                {/* Row 1 */}
                <CheckboxRow label="ACTIVE" name="active" isRed />
                <CheckboxRow label="MASTER FG" name="masterFG" isGray />

                {/* Row 2 */}
                <CheckboxRow label="Shelf Life Required?" name="shelfLifeRequired" />
                <CheckboxRow label="SDS Required?" name="sdsRequired" />

                {/* Row 3 */}
                <CheckboxRow label="Is Supplier Agreement?" name="vmi" />
                <CheckboxRow label="Certificate Required?" name="certificateRequired" />

                {/* Row 4 */}
                <CheckboxRow label="Is Cusomter BPA?" name="customerBPA" />
                <CheckboxRow label="Is e-Commerce Item?" name="eCommerce" />

                {/* Row 5 */}
                <CheckboxRow label="Is QTEC Stock?" name="isQTECStock" />
                <CheckboxRow label="Is B1 Item Master?" name="b1Item" />

                {/* Row 6 */}
                <CheckboxRow label="Serial Required?" name="serialRequired" />
                <CheckboxRow label="Is DG Item?" name="dgRequired" />

                {/* Row 7 */}
                <div></div>
                <CheckboxRow label="Permit Required?" name="permitRequired" />
              </div>

              {/* Bottom Inputs */}
              <div className="mt-4 space-y-3">
                <div className="flex flex-col xl:flex-row xl:items-center justify-end gap-1 xl:gap-2">
                  <label className="text-xs text-gray-500 text-left xl:text-right w-full xl:w-1/3">Permit Type</label>
                  <div className="w-full xl:w-2/3">
                    <select
                      className={cn("w-full border border-gray-300 rounded px-2 py-1 text-sm h-8", !(isReadOnly || !permitRequired) && "bg-white")}
                      disabled={isReadOnly || !permitRequired}
                      {...register('permitType')}
                    >
                      <option value="">Please select</option>
                      {permitTypes.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex flex-col xl:flex-row xl:items-center justify-end gap-1 xl:gap-2">
                  <label className="text-xs text-gray-500 text-left xl:text-right w-full xl:w-1/3">Harmonized Code</label>
                  <div className="w-full xl:w-2/3">
                    <input
                      className={cn("w-full border border-gray-300 rounded px-2 py-1 text-sm h-8", !isReadOnly && "bg-white")}
                      maxLength={10}
                      disabled={isReadOnly}
                      {...register('hsCode')}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* General Spec */}
            <div className="mt-4">
              <label className="block text-xs font-bold text-gray-700 mb-1">General Spec.</label>
              <textarea
                className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:border-[#2264A0] focus:ring-1 focus:ring-[#2264A0] disabled:bg-[#F5F5F5] disabled:text-gray-500 resize-none h-[150px]"
                maxLength={4000}
                disabled={isReadOnly}
                {...register('generalSpec')}
              />
            </div>

            {/* Reference URL */}
            <div className="mt-3">
              <label className="block text-xs font-bold text-gray-700 mb-1">Reference URL</label>
              <div className="flex gap-2 items-center">
                <input
                  className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:border-[#2264A0] focus:ring-1 focus:ring-[#2264A0] disabled:bg-[#F5F5F5] disabled:text-gray-500"
                  maxLength={2000}
                  disabled={isReadOnly}
                  {...register('referenceUrl')}
                />
                <Button
                  type="button"
                  variant="neutral"
                  size="sm"
                  onClick={handleOpenReferenceUrl}
                  disabled={!hasReferenceUrl}
                >
                  <ExternalLink className="w-4 h-4" /> Open
                </Button>
              </div>
            </div>

            {/* Being updated by */}
            <div className="mt-4 pt-3 border-t border-gray-200">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-500 whitespace-nowrap">
                  {mode === 'NEW' ? 'Being updated by:' : 'Last updated by:'}
                </label>
                <div className="flex flex-col gap-2 w-full min-w-0">
                  <input
                    type="text"
                    readOnly
                    value={updatedByValue}
                    title={updatedByValue}
                    className="border border-gray-300 rounded px-2 py-1 text-sm bg-[#F5F5F5] text-gray-600 w-full min-w-0"
                  />
                  <input
                    type="text"
                    readOnly
                    value={formatDateTimeDisplay(updatedDateValue)}
                    className="border border-gray-300 rounded px-2 py-1 text-xs sm:text-sm bg-[#F5F5F5] text-gray-600 w-full min-w-0 tabular-nums"
                  />
                </div>
              </div>
            </div>
          </div>

        </div>
      </form >
    </div >
  );
}
