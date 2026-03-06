import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { SearchCriteriaPanel } from '../components/features/search/SearchCriteriaPanel';
import { PartItemsGrid } from '../components/features/search/PartItemsGrid';

import { BrandVendorView } from '../components/features/search/views/BrandVendorView';
import { CategoryBrandView } from '../components/features/search/views/CategoryBrandView';
import { VendorBrandView } from '../components/features/search/views/VendorBrandView';
import { featureFlags } from '../config/feature-flags';
import { itemApi, ItemSearchCriteria } from '../services/item.api';
import { termApi } from '../services/term.api';
import { clientLogger } from '../utils/logger';

import { toast } from 'sonner';
import { PartItem, SearchType, TermItem, ViewMode } from '../types/partcatalog_types';

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
    const fallback: PersistedSearchState = {
        searchCriteria: { ...DEFAULT_SEARCH_CRITERIA },
        currentPage: 1,
    };

    try {
        const raw = localStorage.getItem(SEARCH_STATE_KEY);
        if (!raw) return fallback;

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
        return fallback;
    }
}

export default function PartcatalogPage() {
    const navigate = useNavigate();
    const readOnlyMode = featureFlags.readOnlyMode;
    const initialSearchStateRef = useRef<PersistedSearchState | null>(null);

    if (!initialSearchStateRef.current) {
        initialSearchStateRef.current = loadPersistedSearchState();
    }

    // Read initial tab from localStorage
    const getInitialTab = (): ViewMode => {
        const saved = localStorage.getItem(TAB_KEY);
        return validTabs.includes(saved as ViewMode) ? (saved as ViewMode) : 'itemList';
    };

    const [activeTab, setActiveTab] = useState<ViewMode>(getInitialTab);
    const [allItems, setAllItems] = useState<PartItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedItem, setSelectedItem] = useState<PartItem | null>(null);
    const [currentPage, setCurrentPage] = useState(initialSearchStateRef.current.currentPage);
    const [pageSize] = useState(50);
    const [totalItemsCount, setTotalItemsCount] = useState(0);
    const [searchCriteria, setSearchCriteria] = useState<ItemSearchCriteria>(initialSearchStateRef.current.searchCriteria);
    const [termsByItemId, setTermsByItemId] = useState<Record<number, TermItem[]>>({});
    const [loadingTermItemIds, setLoadingTermItemIds] = useState<Set<number>>(new Set());

    useEffect(() => {
        try {
            localStorage.setItem(SEARCH_STATE_KEY, JSON.stringify({
                searchCriteria: normalizeSearchCriteria(searchCriteria),
                currentPage,
            }));
        } catch {
            // Ignore persistence errors (private mode/quota/etc.)
        }
    }, [searchCriteria, currentPage]);

    const loadTermsForItem = async (itemId: number) => {
        if (termsByItemId[itemId]) return;
        if (loadingTermItemIds.has(itemId)) return;

        setLoadingTermItemIds(prev => {
            const next = new Set(prev);
            next.add(itemId);
            return next;
        });

        try {
            const terms = await termApi.getTermsByItemId(itemId);
            setTermsByItemId(prev => ({ ...prev, [itemId]: terms }));
        } catch (err) {
            clientLogger.error('Failed to load terms for selected item', err);
            toast.error(`Failed to load terms for item ${itemId}`);
        } finally {
            setLoadingTermItemIds(prev => {
                const next = new Set(prev);
                next.delete(itemId);
                return next;
            });
        }
    };

    useEffect(() => {
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
    }, [currentPage, pageSize, searchCriteria]);

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
        setSearchCriteria({
            ...DEFAULT_SEARCH_CRITERIA,
        });
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
        navigate('/item/new');
    };

    const handleAddTerm = () => {
        if (readOnlyMode) {
            toast.info('Read-only phase: Add Term is disabled');
            return;
        }
        if (selectedItem) {
            navigate(`/term/new?itemId=${selectedItem.ItemID}`);
        } else {
            toast.warning('Please select an item first');
        }
    };

    const handleItemSelect = (item: PartItem) => {
        setSelectedItem(item);
    };

    const handleItemDoubleClick = (item: PartItem) => {
        navigate(`/item/${item.ItemID}`);
    };

    const handleTermDoubleClick = (termId: number) => {
        navigate(`/term/${termId}`);
    };

    const handlePageChange = (page: number) => {
        setCurrentPage(page);
    };

    /*
     * Layout Strategy:
     * - HeaderBar is position:fixed top-0, height 50px
     * - FooterStatusBar is position:fixed bottom-0, height 40px
     * - Content area uses padding-top/bottom to avoid overlap with fixed bars
     * - PartItemsGrid uses calc(100vh - Xpx) for its scroll container height
     * - This ensures the horizontal scrollbar is always at the viewport bottom
     */
    return (
        <div style={{ backgroundColor: '#F5F5F5' }}>
            {/* Content Area - padded to avoid fixed header/footer overlap */}
            <div style={{ paddingTop: '10px', paddingBottom: '40px', paddingLeft: '16px', paddingRight: '16px' }}>
                <Tabs
                    value={activeTab}
                    onValueChange={(v) => {
                        const tab = v as ViewMode;
                        setActiveTab(tab);
                        localStorage.setItem(TAB_KEY, tab);
                    }}
                >
                    <TabsList className="w-full justify-start bg-white border-b border-[#DDDDDD] rounded-none h-auto flex-wrap flex-shrink-0 p-0">
                        <TabsTrigger value="itemList" className="data-[state=active]:bg-[#2264A0] data-[state=active]:text-white px-4 py-3 h-auto">📋 Item List</TabsTrigger>
                        <TabsTrigger value="brandVendor" className="data-[state=active]:bg-[#2264A0] data-[state=active]:text-white px-4 py-3 h-auto">🏷️ Brand → Vendor</TabsTrigger>
                        <TabsTrigger value="categoryBrand" className="data-[state=active]:bg-[#2264A0] data-[state=active]:text-white px-4 py-3 h-auto">📂 Category → Brand</TabsTrigger>
                        <TabsTrigger value="vendorBrand" className="data-[state=active]:bg-[#2264A0] data-[state=active]:text-white px-4 py-3 h-auto">🏢 Vendor → Brand</TabsTrigger>
                    </TabsList>

                    {/* Item List View */}
                    <TabsContent value="itemList" style={{ marginTop: 0 }}>
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

                        {/* Grid - PartItemsGrid */}
                        {loading ? (
                            <div className="flex justify-center items-center h-64">Loading...</div>
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
                                onPageChange={handlePageChange}
                            />
                        )}
                    </TabsContent>

                    <TabsContent value="brandVendor" style={{ marginTop: 0 }}>
                        <BrandVendorView />
                    </TabsContent>
                    <TabsContent value="categoryBrand" style={{ marginTop: 0 }}>
                        <CategoryBrandView />
                    </TabsContent>
                    <TabsContent value="vendorBrand" style={{ marginTop: 0 }}>
                        <VendorBrandView />
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}
