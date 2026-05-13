import { useEffect, useMemo, useState } from 'react';
import { lookupApi, type ItemFormLookups, type LookupOption } from '../../../../services/lookup.api';
import { clientLogger } from '../../../../utils/logger';

// ─── Helpers ────────────────────────────────────────────────────────────────

const NULL_LOOKUP_VALUE = '_Null';
const NULL_LOOKUP_LABEL = 'Please Select';

export const ensureNullLookupOption = (options: LookupOption[]): LookupOption[] => {
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

export const normalizeLookupOption = (option: unknown): LookupOption | null => {
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

export const normalizeSelectValue = (currentValue: string, options: LookupOption[]): string => {
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

// ─── Hook ───────────────────────────────────────────────────────────────────

interface UseItemLookupsOptions {
  prefetchedLookups?: ItemFormLookups;
}

export function useItemLookups({ prefetchedLookups }: UseItemLookupsOptions) {
  const [brands, setBrands] = useState<LookupOption[]>(prefetchedLookups?.brands || []);
  const [itemGroups, setItemGroups] = useState<LookupOption[]>(prefetchedLookups?.itemGroups || []);
  const [uoms, setUoms] = useState<LookupOption[]>(prefetchedLookups?.uoms || []);
  const [countries, setCountries] = useState<LookupOption[]>(
    ensureNullLookupOption(prefetchedLookups?.countries || [])
  );
  const [permitTypes, setPermitTypes] = useState<LookupOption[]>(prefetchedLookups?.permitTypes || []);
  const [itemCategories, setItemCategories] = useState<LookupOption[]>(
    ensureNullLookupOption(prefetchedLookups?.itemCategories || [])
  );

  // Sync when prefetched data arrives
  useEffect(() => {
    if (!prefetchedLookups) return;
    setBrands(prefetchedLookups.brands);
    setItemGroups(prefetchedLookups.itemGroups);
    setUoms(prefetchedLookups.uoms);
    setCountries(ensureNullLookupOption(prefetchedLookups.countries));
    setPermitTypes(prefetchedLookups.permitTypes);
    setItemCategories(ensureNullLookupOption(prefetchedLookups.itemCategories));
  }, [prefetchedLookups]);

  // Fetch if no prefetched data
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

  // Normalize brand options for filtering
  const normalizedBrands = useMemo(() => {
    return (brands as unknown[])
      .map(normalizeLookupOption)
      .filter((b): b is LookupOption => b !== null);
  }, [brands]);

  return {
    brands,
    normalizedBrands,
    itemGroups,
    uoms,
    countries,
    permitTypes,
    itemCategories,
  };
}

export { NULL_LOOKUP_VALUE, NULL_LOOKUP_LABEL };
