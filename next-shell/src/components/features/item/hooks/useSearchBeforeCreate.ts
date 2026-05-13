import { startTransition, useEffect, useMemo, useState } from 'react';
import { itemApi } from '../../../../services/item.api';
import { clientLogger } from '../../../../utils/logger';
import type { PartItem } from '../../../../types/partcatalog_types';

// ─── Types ──────────────────────────────────────────────────────────────────

export type SearchBeforeCreateStatus =
  | 'idle'
  | 'searching'
  | 'exact-match'
  | 'possible-match'
  | 'no-match'
  | 'error';

export interface SearchBeforeCreateState {
  status: SearchBeforeCreateStatus;
  items: PartItem[];
  exactMatches: PartItem[];
  searchedKey: string;
  errorMessage: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const SEARCH_BEFORE_CREATE_PAGE_SIZE = 5;

const normalizeIdentityValue = (value: string): string =>
  String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();

export const buildItemIdentityKey = (mfrBrand: string, mfrCatalogNo: string): string => {
  const normalizedBrand = normalizeIdentityValue(mfrBrand);
  const normalizedCatalogNo = normalizeIdentityValue(mfrCatalogNo);
  if (!normalizedBrand || !normalizedCatalogNo) {
    return '';
  }
  return `${normalizedBrand}::${normalizedCatalogNo}`;
};

export const isExactItemIdentityMatch = (item: PartItem, mfrBrand: string, mfrCatalogNo: string): boolean =>
  normalizeIdentityValue(item.U_Brand) === normalizeIdentityValue(mfrBrand)
  && normalizeIdentityValue(item.U_Calalogno) === normalizeIdentityValue(mfrCatalogNo);

const dedupePartItems = (items: PartItem[]): PartItem[] => {
  const seen = new Set<number>();
  return items.filter((item) => {
    const itemId = Number(item.ItemID);
    if (!Number.isFinite(itemId) || seen.has(itemId)) {
      return false;
    }
    seen.add(itemId);
    return true;
  });
};

// ─── Hook ───────────────────────────────────────────────────────────────────

interface UseSearchBeforeCreateOptions {
  isNew: boolean;
  currentBrand: string;
  currentMfrCatalogNo: string;
  deferredBrand: string;
  deferredMfrCatalogNo: string;
}

export function useSearchBeforeCreate({
  isNew,
  currentBrand,
  currentMfrCatalogNo,
  deferredBrand,
  deferredMfrCatalogNo,
}: UseSearchBeforeCreateOptions) {
  const [searchBeforeCreate, setSearchBeforeCreate] = useState<SearchBeforeCreateState>({
    status: 'idle',
    items: [],
    exactMatches: [],
    searchedKey: '',
    errorMessage: '',
  });
  const [reviewedSearchKey, setReviewedSearchKey] = useState('');
  const [searchRefreshTick, setSearchRefreshTick] = useState(0);

  const currentIdentityKey = useMemo(
    () => buildItemIdentityKey(currentBrand, currentMfrCatalogNo),
    [currentBrand, currentMfrCatalogNo]
  );

  // Reset reviewed state when identity changes
  useEffect(() => {
    if (!isNew) return;
    setReviewedSearchKey('');
  }, [currentIdentityKey, isNew]);

  // Auto-search when identity changes
  useEffect(() => {
    if (!isNew) return;

    const nextIdentityKey = buildItemIdentityKey(deferredBrand, deferredMfrCatalogNo);
    if (!nextIdentityKey) {
      setSearchBeforeCreate({
        status: 'idle',
        items: [],
        exactMatches: [],
        searchedKey: '',
        errorMessage: '',
      });
      return;
    }

    let cancelled = false;
    const timeoutId = window.setTimeout(async () => {
      setSearchBeforeCreate((prev) => ({
        ...prev,
        status: 'searching',
        searchedKey: nextIdentityKey,
        errorMessage: '',
      }));

      try {
        const [exactResponse, candidateResponse] = await Promise.all([
          itemApi.getItems(1, SEARCH_BEFORE_CREATE_PAGE_SIZE, {
            keyword: deferredMfrCatalogNo,
            brand: deferredBrand,
            searchType: 'CATNO',
            exactMatch: true,
          }),
          itemApi.getItems(1, SEARCH_BEFORE_CREATE_PAGE_SIZE, {
            keyword: deferredMfrCatalogNo,
            brand: deferredBrand,
            searchType: 'CATNO',
            exactMatch: false,
          }),
        ]);

        if (cancelled) return;

        const exactMatches = exactResponse.items.filter((item) =>
          isExactItemIdentityMatch(item, deferredBrand, deferredMfrCatalogNo)
        );
        const mergedItems = dedupePartItems([...exactMatches, ...candidateResponse.items]);
        const nextStatus: SearchBeforeCreateStatus = exactMatches.length > 0
          ? 'exact-match'
          : mergedItems.length > 0
            ? 'possible-match'
            : 'no-match';

        startTransition(() => {
          setSearchBeforeCreate({
            status: nextStatus,
            items: mergedItems,
            exactMatches,
            searchedKey: nextIdentityKey,
            errorMessage: '',
          });
        });
      } catch (error) {
        if (cancelled) return;
        clientLogger.error('Failed to check existing items before create', error);
        setSearchBeforeCreate({
          status: 'error',
          items: [],
          exactMatches: [],
          searchedKey: nextIdentityKey,
          errorMessage: 'Unable to check existing items right now. Please try again.',
        });
      }
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [deferredBrand, deferredMfrCatalogNo, isNew, searchRefreshTick]);

  const hasIdentityInput = currentIdentityKey.length > 0;
  const hasSearchReview = reviewedSearchKey === currentIdentityKey && currentIdentityKey.length > 0;

  const handleAcknowledgeNewItemCandidate = () => {
    if (!currentIdentityKey) return;
    setReviewedSearchKey(currentIdentityKey);
  };

  const handleRecheckExistingItems = () => {
    if (!currentIdentityKey) return;
    setReviewedSearchKey('');
    setSearchRefreshTick((value) => value + 1);
  };

  return {
    searchBeforeCreate,
    currentIdentityKey,
    hasIdentityInput,
    hasSearchReview,
    handleAcknowledgeNewItemCandidate,
    handleRecheckExistingItems,
  };
}
