'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, FolderOpen, List, Tags } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SearchCriteriaPanel } from '@/components/features/search/SearchCriteriaPanel';
import { PartItemsGrid } from '@/components/features/search/PartItemsGrid';
import { BrandVendorView } from '@/components/features/search/views/BrandVendorView';
import { CategoryBrandView } from '@/components/features/search/views/CategoryBrandView';
import { VendorBrandView } from '@/components/features/search/views/VendorBrandView';
import { featureFlags } from '@/config/feature-flags';
import { itemApi, type ItemSearchCriteria } from '@/services/item.api';
import { termApi } from '@/services/term.api';
import { clientLogger } from '@/utils/logger';
import { toast } from 'sonner';
import type { PartItem, SearchType, TermItem, ViewMode } from '@/types/partcatalog_types';

const validTabs: ViewMode[] = ['itemList', 'brandVendor', 'categoryBrand', 'vendorBrand'];
const TAB_KEY = 'partcatalog_activeTab';
const SEARCH_STATE_KEY = 'partcatalog_item_search_state_v1';
const validSearchTypes: SearchType[] = ['FTS', 'CATNO', 'CUST', 'ITEM', 'SAP'];

const DEFAULT_SEARCH_CRITERIA: ItemSearchCriteria = {
  searchType: 'FTS',
  keyword: '',
  brand: '',
  exactMatch: false,
  myItems: false,
};

type PersistedSearchState = {
  searchCriteria: ItemSearchCriteria;
  currentPage: number;
};

const fallbackSearchState: PersistedSearchState = {
  searchCriteria: { ...DEFAULT_SEARCH_CRITERIA },
  currentPage: 1,
};

function toBoolean(value: unknown, fallback: boolean = false): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['1', 'true', 'yes', 'y', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'n', 'off'].includes(normalized)) return false;
  }
  return fallback;
}

function normalizeSearchCriteria(raw: unknown): Required<ItemSearchCriteria> {
  if (!raw || typeof raw !== 'object') {
    return { searchType: 'FTS', keyword: '', brand: '', exactMatch: false, myItems: false };
  }

  const source = raw as Record<string, unknown>;
  const searchTypeRaw = String(source.searchType ?? '').trim() as SearchType;
  const searchType = validSearchTypes.includes(searchTypeRaw) ? searchTypeRaw : 'FTS';
  const keyword = String(source.keyword ?? '');
  const brand = String(source.brand ?? '');
  const exactMatch = searchType === 'FTS' ? false : toBoolean(source.exactMatch, false);
  const myItems = toBoolean(source.myItems, false);

  return {
    searchType,
    keyword,
    brand,
    exactMatch,
    myItems,
  };
}

function loadPersistedSearchState(): PersistedSearchState {
  if (typeof window === 'undefined') return fallbackSearchState;

  try {
    const raw = window.localStorage.getItem(SEARCH_STATE_KEY);
    if (!raw) return fallbackSearchState;

    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const criteriaRaw = parsed.searchCriteria ?? parsed;
    const normalizedCriteria = normalizeSearchCriteria(criteriaRaw);

    const parsedPage = Number(parsed.currentPage);
    const currentPage = Number.isFinite(parsedPage) && parsedPage > 0 ? Math.floor(parsedPage) : 1;

    return {
      searchCriteria: normalizedCriteria,
      currentPage,
    };
  } catch {
    return fallbackSearchState;
  }
}

function loadInitialTab(): ViewMode {
  if (typeof window === 'undefined') return 'itemList';

  try {
    const saved = window.localStorage.getItem(TAB_KEY);
    return validTabs.includes(saved as ViewMode) ? (saved as ViewMode) : 'itemList';
  } catch {
    return 'itemList';
  }
}

export default function PartCatalogPage() {
  const router = useRouter();
  const readOnlyMode = featureFlags.readOnlyMode;
  const [activeTab, setActiveTab] = useState<ViewMode>('itemList');
  const [allItems, setAllItems] = useState<PartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<PartItem | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(50);
  const [totalItemsCount, setTotalItemsCount] = useState(0);
  const [searchCriteria, setSearchCriteria] = useState<ItemSearchCriteria>({
    ...DEFAULT_SEARCH_CRITERIA,
  });
  const [termsByItemId, setTermsByItemId] = useState<Record<number, TermItem[]>>({});
  const [loadingTermItemIds, setLoadingTermItemIds] = useState<Set<number>>(new Set());
  const [hasInitialized, setHasInitialized] = useState(false);

  useEffect(() => {
    const persistedSearchState = loadPersistedSearchState();
    setActiveTab(loadInitialTab());
    setCurrentPage(persistedSearchState.currentPage);
    setSearchCriteria(persistedSearchState.searchCriteria);
    setHasInitialized(true);
  }, []);

  useEffect(() => {
    if (!hasInitialized) return;

    try {
      window.localStorage.setItem(
        SEARCH_STATE_KEY,
        JSON.stringify({
          searchCriteria: normalizeSearchCriteria(searchCriteria),
          currentPage,
        }),
      );
    } catch {
      // Ignore persistence errors in private mode or locked-down browsers.
    }
  }, [searchCriteria, currentPage, hasInitialized]);

  useEffect(() => {
    if (!hasInitialized) return;

    const loadItems = async () => {
      setLoading(true);
      try {
        const res = await itemApi.getItems(currentPage, pageSize, searchCriteria);
        setAllItems(res.items);
        setTotalItemsCount(res.meta.total);
        setTermsByItemId({});
      } catch (err) {
        clientLogger.error('Failed to load items', err);
        toast.error('Failed to load items');
      } finally {
        setLoading(false);
      }
    };

    loadItems();
  }, [currentPage, pageSize, searchCriteria, hasInitialized]);

  const loadTermsForItem = async (itemId: number) => {
    if (termsByItemId[itemId]) return;
    if (loadingTermItemIds.has(itemId)) return;

    setLoadingTermItemIds((prev) => {
      const next = new Set(prev);
      next.add(itemId);
      return next;
    });

    try {
      const terms = await termApi.getTermsByItemId(itemId);
      setTermsByItemId((prev) => ({ ...prev, [itemId]: terms }));
    } catch (err) {
      clientLogger.error('Failed to load terms for selected item', err);
      toast.error(`Failed to load terms for item ${itemId}`);
    } finally {
      setLoadingTermItemIds((prev) => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    }
  };

  const handleSearch = async (criteria: {
    searchType: SearchType;
    keyword: string;
    brand: string;
    exactMatch: boolean;
    myItems: boolean;
  }) => {
    const normalizedSearchType = criteria.searchType;
    setSearchCriteria({
      searchType: normalizedSearchType,
      keyword: criteria.keyword,
      brand: criteria.brand === 'all' ? '' : criteria.brand,
      exactMatch: normalizedSearchType === 'FTS' ? false : criteria.exactMatch,
      myItems: criteria.myItems,
    });
    setCurrentPage(1);
    setSelectedItem(null);
  };

  const handleReset = () => {
    setSearchCriteria({ ...DEFAULT_SEARCH_CRITERIA });
    setCurrentPage(1);
    setSelectedItem(null);
    setTermsByItemId({});
    toast.success('Search criteria reset');
  };

  const handleAddItem = () => {
    if (readOnlyMode) {
      toast.info('Read-only phase: Add Item is disabled');
      return;
    }
    router.push('/item/new');
  };

  const handleAddTerm = () => {
    if (readOnlyMode) {
      toast.info('Read-only phase: Add Term is disabled');
      return;
    }

    if (selectedItem) {
      router.push(`/term/new?itemId=${selectedItem.ItemID}`);
    } else {
      toast.warning('Please select an item first');
    }
  };

  const handleItemSelect = (item: PartItem) => {
    setSelectedItem(item);
  };

  const handleItemDoubleClick = (item: PartItem) => {
    router.push(`/item/${item.ItemID}`);
  };

  const handleTermDoubleClick = (termId: number, itemId: number) => {
    router.push(`/term/${itemId}/${termId}`);
  };

  const handleTabChange = (value: string) => {
    const tab = value as ViewMode;
    if (!validTabs.includes(tab)) return;

    setActiveTab(tab);
    try {
      window.localStorage.setItem(TAB_KEY, tab);
    } catch {
      // Ignore persistence errors.
    }
  };

  return (
    <div className="partcatalog-native-page">
      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
        className="partcatalog-native-tabs"
      >
        <TabsList className="partcatalog-native-tabs-list w-full justify-start bg-white border-b border-[#DDDDDD] rounded-none h-auto flex-wrap flex-shrink-0 p-0">
          <TabsTrigger value="itemList" className="data-[state=active]:bg-[#2264A0] data-[state=active]:text-white px-4 py-3 h-auto rounded-none">
            <List size={15} aria-hidden="true" />
            <span>Item List</span>
          </TabsTrigger>
          <TabsTrigger value="brandVendor" className="data-[state=active]:bg-[#2264A0] data-[state=active]:text-white px-4 py-3 h-auto rounded-none">
            <Tags size={15} aria-hidden="true" />
            <span>Brand - Vendor</span>
          </TabsTrigger>
          <TabsTrigger value="categoryBrand" className="data-[state=active]:bg-[#2264A0] data-[state=active]:text-white px-4 py-3 h-auto rounded-none">
            <FolderOpen size={15} aria-hidden="true" />
            <span>Category - Brand</span>
          </TabsTrigger>
          <TabsTrigger value="vendorBrand" className="data-[state=active]:bg-[#2264A0] data-[state=active]:text-white px-4 py-3 h-auto rounded-none">
            <Building2 size={15} aria-hidden="true" />
            <span>Vendor - Brand</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="itemList" className="partcatalog-native-tab-content">
          <SearchCriteriaPanel
            criteria={normalizeSearchCriteria(searchCriteria)}
            onSearch={handleSearch}
            onReset={handleReset}
            onAddItem={handleAddItem}
            onAddTerm={handleAddTerm}
            selectedItemCode={selectedItem?.ItemCode}
            disableMutations={readOnlyMode}
            isSearching={loading}
          />

          {loading ? (
            <div className="partcatalog-native-loading">Loading...</div>
          ) : (
            <PartItemsGrid
              items={allItems}
              totalItems={totalItemsCount}
              termsByItemId={termsByItemId}
              loadingTermItemIds={loadingTermItemIds}
              onItemSelect={handleItemSelect}
              onItemDoubleClick={handleItemDoubleClick}
              onTermDoubleClick={handleTermDoubleClick}
              onExpandItem={loadTermsForItem}
              currentPage={currentPage}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
            />
          )}
        </TabsContent>

        <TabsContent value="brandVendor" className="partcatalog-native-tab-content">
          <BrandVendorView />
        </TabsContent>
        <TabsContent value="categoryBrand" className="partcatalog-native-tab-content">
          <CategoryBrandView />
        </TabsContent>
        <TabsContent value="vendorBrand" className="partcatalog-native-tab-content">
          <VendorBrandView />
        </TabsContent>
      </Tabs>
    </div>
  );
}
