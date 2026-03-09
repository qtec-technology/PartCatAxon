import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { addMonths, format, isValid, parseISO } from 'date-fns';
import { attachmentApi } from '../../../../services/attachment.api';
import { itemApi } from '../../../../services/item.api';
import { lookupApi } from '../../../../services/lookup.api';
import { termApi } from '../../../../services/term.api';
import { clientLogger } from '../../../../utils/logger';
import type {
    CreateTermAttachmentInput,
    TermCalcResults,
    TermFormData,
    TermPageDataState,
    UpdateTermFormData,
} from '../../../../types/term_form.types';
import { defaultTermCalcResults, defaultTermFormData } from '../../../../types/term_form.types';
import {
    mapContactsToOptions,
    mapSalesPersonsToOptions,
    mapTermAttachments,
    mapTermRecordToFormData,
    mapVendorsToSuppliers,
    uniqueStrings,
} from '../mappers/term-page.mapper';
import { mapStoredTermRecordToUiCalcResults } from '../mappers/term-calculation.mapper';

interface UseTermPageDataParams {
    id?: string;
    sourceItemId?: string;
    mode: 'new' | 'view' | 'edit';
    readOnlyMode: boolean;
}

interface UseTermPageDataResult extends TermPageDataState {
    isInitialLoading: boolean;
    storedCalcResults: TermCalcResults;
    updateFormData: UpdateTermFormData;
    refreshCWeightBySuppOrderCode: () => Promise<void>;
    handleSupplierChange: (supplierCode: string) => void;
    createTermAttachment: (input: CreateTermAttachmentInput) => Promise<void>;
    deleteTermAttachment: (attachmentId: string) => Promise<void>;
}

const parsePositiveInt = (value: unknown): number | null => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const ensureContactIncluded = (
    list: TermPageDataState['contacts'],
    code: string,
    name: string,
): TermPageDataState['contacts'] => {
    const normalizedCode = String(code || '').trim();
    const normalizedName = String(name || '').trim();
    if (!normalizedCode) return list;
    return list.some((row) => row.code === normalizedCode)
        ? list
        : [{ code: normalizedCode, name: normalizedName || normalizedCode, active: 'Y' }, ...list];
};

const isAbortError = (error: unknown): boolean =>
    error instanceof DOMException && error.name === 'AbortError';

export function useTermPageData({
    id,
    sourceItemId,
    mode,
    readOnlyMode,
}: UseTermPageDataParams): UseTermPageDataResult {
    const [itemCode, setItemCode] = useState('');
    const [itemDesc, setItemDesc] = useState('');
    const [formData, setFormData] = useState<TermFormData>(defaultTermFormData);
    const [storedCalcResults, setStoredCalcResults] = useState<TermCalcResults>(defaultTermCalcResults);
    const [isLookupLoading, setIsLookupLoading] = useState(true);
    const [isRecordLoading, setIsRecordLoading] = useState(true);
    const [attachments, setAttachments] = useState<TermPageDataState['attachments']>([]);

    const [suppliers, setSuppliers] = useState<TermPageDataState['suppliers']>([]);
    const [contacts, setContacts] = useState<TermPageDataState['contacts']>([]);
    const [orderTerms, setOrderTerms] = useState<TermPageDataState['orderTerms']>([]);
    const [locations, setLocations] = useState<TermPageDataState['locations']>([]);
    const [purchaseSubLocations, setPurchaseSubLocations] = useState<TermPageDataState['purchaseSubLocations']>([]);
    const [salesSubLocations, setSalesSubLocations] = useState<TermPageDataState['salesSubLocations']>([]);
    const [currencies, setCurrencies] = useState<TermPageDataState['currencies']>([]);
    const [freightTypes, setFreightTypes] = useState<TermPageDataState['freightTypes']>([]);
    const [salesPersons, setSalesPersons] = useState<TermPageDataState['salesPersons']>([]);
    const [uomOptions, setUomOptions] = useState<TermPageDataState['uomOptions']>([]);

    const parsedTermId = useMemo(() => parsePositiveInt(id), [id]);
    const parsedSourceItemId = useMemo(() => parsePositiveInt(sourceItemId), [sourceItemId]);
    const isNewMode = mode === 'new';

    const contactsBySupplierRef = useRef<Map<string, TermPageDataState['contacts']>>(new Map());
    const cWeightAbortRef = useRef<AbortController | null>(null);

    const supplierByCode = useMemo(() => {
        const map = new Map<string, { code: string; name: string }>();
        for (const supplier of suppliers) {
            map.set(supplier.code, supplier);
        }
        return map;
    }, [suppliers]);

    const refreshAttachments = useCallback(async () => {
        if (!parsedTermId) {
            setAttachments((prev) => (prev.length === 0 ? prev : []));
            return;
        }

        const rows = await lookupApi.getTermAttachments(parsedTermId);
        setAttachments(mapTermAttachments(rows));
    }, [parsedTermId]);

    useEffect(() => {
        return () => {
            cWeightAbortRef.current?.abort();
        };
    }, []);

    useEffect(() => {
        let cancelled = false;
        const controller = new AbortController();

        const fetchLookups = async () => {
            setIsLookupLoading(true);
            try {
                const [data, critical, purchaseSubLocationRows, salesSubLocationRows] = await Promise.all([
                    lookupApi.getTermFormLookups({
                        signal: controller.signal,
                    }),
                    lookupApi.getTermCriticalLookups({
                        signal: controller.signal,
                    }),
                    lookupApi.getSubLocations('AP', undefined, {
                        signal: controller.signal,
                    }),
                    lookupApi.getSubLocations('AR', undefined, {
                        signal: controller.signal,
                    }),
                ]);
                if (cancelled) return;

                contactsBySupplierRef.current.clear();

                setSuppliers(mapVendorsToSuppliers(data.vendors));
                setOrderTerms(data.orderTerms);
                setLocations(critical.locations);
                setPurchaseSubLocations(uniqueStrings(purchaseSubLocationRows.map((row) => String(row.name || '').trim())));
                setSalesSubLocations(uniqueStrings(salesSubLocationRows.map((row) => String(row.name || '').trim())));
                setCurrencies(critical.currencies);
                setFreightTypes(critical.freightTypes);
                setSalesPersons(mapSalesPersonsToOptions(data.salesPersons));
                setUomOptions(data.uoms);
            } catch (error) {
                if (isAbortError(error)) return;
                clientLogger.error('Failed to load term form lookups', error);
                if (cancelled) return;
                setSuppliers([]);
                setOrderTerms([]);
                setLocations([]);
                setPurchaseSubLocations([]);
                setSalesSubLocations([]);
                setCurrencies([]);
                setFreightTypes([]);
                setSalesPersons([]);
                setUomOptions([]);
            } finally {
                if (!cancelled) {
                    setIsLookupLoading(false);
                }
            }
        };

        void fetchLookups();

        return () => {
            cancelled = true;
            controller.abort();
        };
    }, []);

    useEffect(() => {
        let cancelled = false;

        const refreshCriticalLookups = async () => {
            try {
                const critical = await lookupApi.getTermCriticalLookups();
                if (cancelled) return;

                setLocations(critical.locations);
                setCurrencies(critical.currencies);
                setFreightTypes(critical.freightTypes);
            } catch (error) {
                if (!cancelled) {
                    clientLogger.warn('Failed to refresh term critical lookups', {
                        error: error instanceof Error ? error.message : String(error),
                    });
                }
            }
        };

        const intervalId = window.setInterval(() => {
            void refreshCriticalLookups();
        }, 60_000);

        return () => {
            cancelled = true;
            window.clearInterval(intervalId);
        };
    }, []);

    useEffect(() => {
        if (mode === 'view') return;

        setFormData((prev) => {
            let next = prev;

            const currencyCode = String(prev.currency || '').trim();
            if (currencyCode) {
                const matchedCurrency = currencies.find(
                    (row) => String(row.code || '').trim().toUpperCase() === currencyCode.toUpperCase()
                );
                if (matchedCurrency) {
                    const nextExRate = Number(matchedCurrency.exRate || 0);
                    if (Number(prev.exRate) !== nextExRate) {
                        next = next === prev
                            ? { ...prev, exRate: nextExRate }
                            : { ...next, exRate: nextExRate };
                    }
                }
            }

            const locationCode = String(prev.purchaseTermLocation || '').trim();
            if (locationCode) {
                const matchedLocation = locations.find(
                    (row) => String(row.code || '').trim().toLowerCase() === locationCode.toLowerCase()
                );
                if (matchedLocation) {
                    const nextZoneRate = Number(matchedLocation.zoneRate || 0);
                    if (Number(prev.zoneRate) !== nextZoneRate) {
                        next = next === prev
                            ? { ...prev, zoneRate: nextZoneRate }
                            : { ...next, zoneRate: nextZoneRate };
                    }
                    const nextLocationName = String(matchedLocation.name || '').trim();
                    if (nextLocationName && prev.purchaseTermLocationName !== nextLocationName) {
                        next = next === prev
                            ? { ...prev, purchaseTermLocationName: nextLocationName }
                            : { ...next, purchaseTermLocationName: nextLocationName };
                    }
                }
            }

            const freightTypeCode = String(prev.freightType || '').trim();
            if (freightTypeCode) {
                const matchedFreightType = freightTypes.find(
                    (row) => String(row.code || '').trim().toUpperCase() === freightTypeCode.toUpperCase()
                );
                if (matchedFreightType) {
                    const nextFreightRate = Number(matchedFreightType.rate || 0);
                    if (Number(prev.freightRate) !== nextFreightRate) {
                        next = next === prev
                            ? { ...prev, freightRate: nextFreightRate }
                            : { ...next, freightRate: nextFreightRate };
                    }
                }
            }

            return next;
        });
    }, [currencies, freightTypes, locations, mode]);

    useEffect(() => {
        let cancelled = false;
        const controller = new AbortController();
        const supplierCode = String(formData.supplier || '').trim();
        const currentContactCode = String(formData.contactPerson || '').trim();
        const currentContactName = String(formData.contactPersonName || '').trim();

        const setFallbackContacts = () => {
            if (!cancelled) {
                setContacts(ensureContactIncluded([], currentContactCode, currentContactName));
            }
        };

        const loadContacts = async () => {
            if (readOnlyMode || mode === 'view' || !supplierCode) {
                setFallbackContacts();
                return;
            }

            const cached = contactsBySupplierRef.current.get(supplierCode);
            if (cached) {
                if (!cancelled) {
                    setContacts(ensureContactIncluded(cached, currentContactCode, currentContactName));
                }
                return;
            }

            try {
                const contactRows = await lookupApi.getContacts(supplierCode, {
                    signal: controller.signal,
                });
                if (cancelled) return;

                const contactOptions = mapContactsToOptions(contactRows);
                contactsBySupplierRef.current.set(supplierCode, contactOptions);
                setContacts(ensureContactIncluded(contactOptions, currentContactCode, currentContactName));
            } catch (error) {
                if (isAbortError(error)) return;
                clientLogger.error('Failed to load contacts', error);
                setFallbackContacts();
            }
        };

        void loadContacts();

        return () => {
            cancelled = true;
            controller.abort();
        };
    }, [formData.contactPerson, formData.contactPersonName, formData.supplier, mode, readOnlyMode]);

    useEffect(() => {
        let cancelled = false;

        const loadPrimaryData = async () => {
            setIsRecordLoading(true);
            try {
                if (isNewMode) {
                    if (!parsedSourceItemId) {
                        if (!cancelled) {
                            setItemCode('');
                            setItemDesc('');
                            setAttachments([]);
                            setFormData(defaultTermFormData);
                            setStoredCalcResults(defaultTermCalcResults);
                        }
                        return;
                    }

                    const [itemResult, uomResult] = await Promise.allSettled([
                        itemApi.getItemById(parsedSourceItemId),
                        itemApi.getItemUOM(parsedSourceItemId),
                    ]);

                    if (cancelled) return;

                    const resolvedUom = uomResult.status === 'fulfilled'
                        ? (uomResult.value || defaultTermFormData.stockUOM)
                        : defaultTermFormData.stockUOM;

                    if (itemResult.status === 'fulfilled') {
                        setItemCode(itemResult.value.catalogNo || '');
                        setItemDesc(itemResult.value.itemDescription || '');
                        setAttachments([]);
                        setFormData((prev) => ({
                            ...defaultTermFormData,
                            mfgPartNo: itemResult.value.mfrCatalogNo || prev.mfgPartNo,
                            stockUOM: resolvedUom,
                        }));
                        setStoredCalcResults(defaultTermCalcResults);
                    } else {
                        setItemCode('');
                        setItemDesc('');
                        setAttachments([]);
                        setFormData((prev) => ({ ...defaultTermFormData, stockUOM: resolvedUom || prev.stockUOM }));
                        setStoredCalcResults(defaultTermCalcResults);
                        clientLogger.error('Failed to fetch item for new term', itemResult.reason);
                    }

                    return;
                }

                if (!parsedTermId) {
                    if (!cancelled) {
                        setItemCode('');
                        setItemDesc('');
                        setAttachments([]);
                        setFormData(defaultTermFormData);
                        setStoredCalcResults(defaultTermCalcResults);
                    }
                    return;
                }

                const [termResult, attachmentResult] = await Promise.allSettled([
                    termApi.getTermById(parsedTermId),
                    refreshAttachments(),
                ]);

                if (cancelled) return;

                if (termResult.status === 'fulfilled' && termResult.value) {
                    const raw = termResult.value as Record<string, unknown>;
                    setFormData((prev) => mapTermRecordToFormData(raw, prev));
                    setStoredCalcResults(mapStoredTermRecordToUiCalcResults(raw));

                    setItemCode(String(raw.ItemCode || ''));
                    setItemDesc(String(raw.ItemDescription || ''));

                    const itemId = parsePositiveInt(raw.ItemID);
                    if (itemId) {
                        const shouldLoadFallbackItem = String(raw.ItemCode || '').trim().length === 0;
                        const [uomResult, itemResult] = await Promise.allSettled([
                            itemApi.getItemUOM(itemId),
                            shouldLoadFallbackItem ? itemApi.getItemById(itemId) : Promise.resolve(null),
                        ]);

                        if (!cancelled && uomResult.status === 'fulfilled') {
                            const uom = String(uomResult.value || '').trim();
                            if (uom) {
                                setFormData((prev) => (prev.stockUOM === uom ? prev : { ...prev, stockUOM: uom }));
                            }
                        }

                        if (shouldLoadFallbackItem) {
                            if (itemResult.status === 'fulfilled' && itemResult.value) {
                                if (!cancelled) {
                                    setItemCode(String(itemResult.value.catalogNo || ''));
                                    setItemDesc(String(itemResult.value.itemDescription || ''));
                                }
                            } else if (itemResult.status === 'rejected') {
                                clientLogger.error('Failed to fetch item for term', itemResult.reason);
                            }
                        }
                    }
                } else if (termResult.status === 'rejected') {
                    clientLogger.error('Failed to fetch term', termResult.reason);
                }

                if (attachmentResult.status === 'rejected') {
                    setAttachments([]);
                }
            } catch (error) {
                clientLogger.error('Failed to load term primary data', error);
            } finally {
                if (!cancelled) {
                    setIsRecordLoading(false);
                }
            }
        };

        void loadPrimaryData();

        return () => {
            cancelled = true;
        };
    }, [isNewMode, parsedSourceItemId, parsedTermId, refreshAttachments]);

    const updateFormData = useCallback<UpdateTermFormData>((field, value) => {
        setFormData((prev) => {
            const fieldUnchanged = Object.is(prev[field], value);
            let next = fieldUnchanged ? prev : ({ ...prev, [field]: value } as TermFormData);

            if (mode === 'new' && field === 'validFrom') {
                const validFrom = String(value || '').trim();
                const parsedValidFrom = validFrom ? parseISO(validFrom) : null;
                const nextValidTo = parsedValidFrom && isValid(parsedValidFrom)
                    ? format(addMonths(parsedValidFrom, 1), 'yyyy-MM-dd')
                    : '';

                if (next.validTo !== nextValidTo) {
                    next = next === prev
                        ? { ...prev, validTo: nextValidTo }
                        : { ...next, validTo: nextValidTo };
                }
            }

            return next;
        });
    }, [mode]);

    const refreshCWeightBySuppOrderCode = useCallback(async () => {
        if (readOnlyMode || mode === 'view') return;

        const vendorStockItemNo = String(formData.suppOrderCode || '').trim();
        cWeightAbortRef.current?.abort();

        if (!vendorStockItemNo) {
            setFormData((prev) => (prev.cWeight === 0 ? prev : { ...prev, cWeight: 0 }));
            return;
        }

        const controller = new AbortController();
        cWeightAbortRef.current = controller;

        try {
            const cWeight = await termApi.getCWeightByVendorStockItemNo(vendorStockItemNo, {
                signal: controller.signal,
            });

            setFormData((prev) => {
                const latestVendorStockItemNo = String(prev.suppOrderCode || '').trim();
                if (latestVendorStockItemNo !== vendorStockItemNo || prev.cWeight === cWeight) return prev;
                return { ...prev, cWeight };
            });
        } catch (error) {
            if (controller.signal.aborted) return;
            clientLogger.error('Failed to fetch chargeable weight by Vendor Stock Item No', error);
        } finally {
            if (cWeightAbortRef.current === controller) {
                cWeightAbortRef.current = null;
            }
        }
    }, [formData.suppOrderCode, mode, readOnlyMode]);

    const handleSupplierChange = useCallback((supplierCode: string) => {
        const selectedSupplierName = supplierByCode.get(supplierCode)?.name || '';
        setFormData((prev) => {
            if (prev.supplierName === selectedSupplierName && prev.contactPerson === '') return prev;
            return {
                ...prev,
                supplierName: selectedSupplierName,
                contactPerson: '',
                contactPersonName: '',
            };
        });
    }, [supplierByCode]);

    const createTermAttachment = useCallback(async (input: CreateTermAttachmentInput) => {
        if (!parsedTermId) {
            throw new Error('Cannot add attachment before term is saved');
        }

        await attachmentApi.createAttachment({
            relatedId: parsedTermId,
            relatedType: 'TERM',
            fileName: input.fileName,
            filePath: input.filePath || '',
            fileType: input.category,
            file: input.file,
        });

        await refreshAttachments();
    }, [parsedTermId, refreshAttachments]);

    const deleteTermAttachment = useCallback(async (attachmentId: string) => {
        const parsedAttachmentId = parsePositiveInt(attachmentId);
        if (!parsedAttachmentId) {
            throw new Error('Invalid AttachmentID');
        }
        if (!parsedTermId) {
            throw new Error('Invalid TermID');
        }

        await attachmentApi.deleteAttachment(parsedAttachmentId, {
            relatedType: 'TERM',
            relatedId: parsedTermId,
        });
        await refreshAttachments();
    }, [parsedTermId, refreshAttachments]);

    return {
        isInitialLoading: isLookupLoading || isRecordLoading,
        itemCode,
        itemDesc,
        formData,
        storedCalcResults,
        attachments,
        suppliers,
        contacts,
        orderTerms,
        locations,
        purchaseSubLocations,
        salesSubLocations,
        currencies,
        freightTypes,
        salesPersons,
        uomOptions,
        updateFormData,
        refreshCWeightBySuppOrderCode,
        handleSupplierChange,
        createTermAttachment,
        deleteTermAttachment,
    };
}
