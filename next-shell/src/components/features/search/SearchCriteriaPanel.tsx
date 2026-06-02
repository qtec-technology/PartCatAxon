import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Search, RotateCcw, Plus, ShoppingCart, Filter, Loader2 } from 'lucide-react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../ui/select';
import { Checkbox } from '../../ui/checkbox';
import { Label } from '../../ui/label';
import { SearchType } from '../../../types/partcatalog_types';
import { itemApi, type FtsAutocompleteOption } from '../../../services/item.api';
import { clientLogger } from '../../../utils/logger';

interface SearchCriteriaPanelProps {
  criteria?: {
    searchType: SearchType;
    keyword: string;
    brand: string;
    exactMatch: boolean;
    myItems: boolean;
  };
  onSearch: (criteria: {
    searchType: SearchType;
    keyword: string;
    brand: string;
    exactMatch: boolean;
    myItems: boolean;
  }) => void;
  onReset: () => void;
  onAddItem: () => void;
  onAddTerm: () => void;
  onQuickFilterChange?: (value: string) => void;
  selectedItemCode?: string;
  disableMutations?: boolean;
  disableAddItem?: boolean;
  disableAddTerm?: boolean;
  isSearching?: boolean;
}

export function SearchCriteriaPanel({
  criteria,
  onSearch,
  onReset,
  onAddItem,
  onAddTerm,
  onQuickFilterChange,
  selectedItemCode,
  disableMutations = false,
  disableAddItem,
  disableAddTerm,
  isSearching = false,
}: SearchCriteriaPanelProps) {
  const idBase = useId();
  const ids = useMemo(() => ({
    keyword: `${idBase}-keyword`,
    searchType: `${idBase}-searchType`,
    brand: `${idBase}-brand`,
    criteria: `${idBase}-criteria`,
  }), [idBase]);

  const SEARCH_TYPE_LABEL: Record<SearchType, string> = {
    FTS: 'Full-Text Search',
    CATNO: 'Mfr Catalog No',
    CUST: 'Customer Stock Code',
    ITEM: 'Item Code',
    SAP: 'SAP B1 Item No',
  };
  const DEFAULT_CRITERIA_TEXT = 'Criteria: Default (Latest 400 items)';
  const initialSearchType = criteria?.searchType ?? 'FTS';
  const initialKeyword = criteria?.keyword ?? '';
  const initialBrand = criteria?.brand ?? '';
  const initialExactMatch = initialSearchType === 'FTS' ? false : (criteria?.exactMatch ?? false);
  const initialMyItems = criteria?.myItems ?? false;

  const [searchType, setSearchType] = useState<SearchType>(initialSearchType);
  const [keyword, setKeyword] = useState(initialKeyword);
  const [showKeywordDropdown, setShowKeywordDropdown] = useState(false);
  const [ftsSuggestions, setFtsSuggestions] = useState<FtsAutocompleteOption[]>([]);
  const [ftsSuggestionsLoading, setFtsSuggestionsLoading] = useState(false);
  const [brand, setBrand] = useState(initialBrand);
  const [brandInput, setBrandInput] = useState(initialBrand);
  const [brands, setBrands] = useState<string[]>([]); // State for brand names
  const [showBrandDropdown, setShowBrandDropdown] = useState(false);
  const keywordRef = useRef<HTMLDivElement>(null);
  const brandRef = useRef<HTMLDivElement>(null);
  const ftsAbortRef = useRef<AbortController | null>(null);
  const ftsRequestSeqRef = useRef(0);
  const [exactMatch, setExactMatch] = useState(initialExactMatch);
  const [myItems, setMyItems] = useState(initialMyItems);
  const [criteriaText, setCriteriaText] = useState(DEFAULT_CRITERIA_TEXT);
  const [showUserPicture, setShowUserPicture] = useState(false);
  const isFTSMode = searchType === 'FTS';
  const waitState = isSearching;
  const addItemDisabled = disableAddItem ?? disableMutations;
  const addTermDisabled = disableAddTerm ?? disableMutations;

  useEffect(() => {
    let active = true;
    const fetchBrands = async () => {
      try {
        const data = await itemApi.getBrands();
        if (!active) return;

        const rawBrandNames = data
          .map((b) => b.U_Brand || b.Code || b.Name)
          .filter((n): n is string => Boolean(n));

        const uniqueBrandNames = Array.from(new Set(rawBrandNames));

        setBrands(uniqueBrandNames);
      } catch (error) {
        clientLogger.error('Failed to load brands', error);
      }
    };
    void fetchBrands();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const image = new window.Image();
    image.onload = () => {
      if (active) setShowUserPicture(true);
    };
    image.onerror = () => {
      if (active) setShowUserPicture(false);
    };
    image.src = '/api/auth/user-picture';

    return () => {
      active = false;
    };
  }, []);

  const filteredBrands = useMemo(() => {
    const source = brands;

    if (!brandInput) return source;
    const q = brandInput.toUpperCase();
    return source.filter((b: string) => b.toUpperCase().startsWith(q));
  }, [brandInput, brands]);

  useEffect(() => {
    const handleClickOutside = (e: PointerEvent) => {
      if (keywordRef.current && !keywordRef.current.contains(e.target as Node)) {
        setShowKeywordDropdown(false);
      }
      if (brandRef.current && !brandRef.current.contains(e.target as Node)) {
        setShowBrandDropdown(false);
      }
    };
    document.addEventListener('pointerdown', handleClickOutside);
    return () => document.removeEventListener('pointerdown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isFTSMode) {
      setFtsSuggestions([]);
      setShowKeywordDropdown(false);
      ftsAbortRef.current?.abort();
      return;
    }

    const q = keyword.trim();
    if (q.length < 2) {
      setFtsSuggestions([]);
      return;
    }

    const currentSeq = ++ftsRequestSeqRef.current;
    const controller = new AbortController();
    ftsAbortRef.current?.abort();
    ftsAbortRef.current = controller;

    const timer = window.setTimeout(async () => {
      try {
        setFtsSuggestionsLoading(true);
        const rows = await itemApi.getFTSAutocomplete(q);
        if (controller.signal.aborted || currentSeq !== ftsRequestSeqRef.current) return;
        const dedupedRows = Array.from(
          new Map(
            rows
              .filter((r) => Boolean(r.U_Calalogno || r.ItemCode || r.ItemDescription))
              .map((r) => {
                const key = `${r.ItemCode || ''}|${r.U_Brand || ''}|${r.U_Calalogno || ''}|${r.ItemDescription || ''}`;
                return [key, r];
              })
          ).values()
        ).slice(0, 100);
        setFtsSuggestions(dedupedRows);
      } catch (error) {
        if (controller.signal.aborted) return;
        clientLogger.error('Failed to load FTS autocomplete', error);
        setFtsSuggestions([]);
      } finally {
        if (currentSeq === ftsRequestSeqRef.current) {
          setFtsSuggestionsLoading(false);
        }
      }
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [keyword, isFTSMode]);



  const handleSearch = () => {
    runSearch({ searchType, keyword, brand, exactMatch, myItems });
  };

  const sanitizeFTSKeyword = (value: string) => value.replace(/[^A-Za-z0-9\u0E00-\u0E7F ]/g, '');

  const buildCriteriaText = (criteria: {
    searchType: SearchType;
    keyword: string;
    brand: string;
    exactMatch: boolean;
    myItems: boolean;
  }) => {
    const parts: string[] = [];
    const kw = criteria.keyword.trim();
    const brandValue = criteria.brand.trim();

    if (kw) {
      parts.push(`${SEARCH_TYPE_LABEL[criteria.searchType]}: "${kw}"`);
      if (criteria.searchType !== 'FTS') {
        parts.push(criteria.exactMatch ? 'Exact Match' : 'Contains');
      }
    }
    if (brandValue) parts.push(`Brand: ${brandValue}`);
    if (criteria.myItems) parts.push('My Items');

    if (parts.length === 0) return DEFAULT_CRITERIA_TEXT;
    return `Criteria: ${parts.join(' | ')}`;
  };

  useEffect(() => {
    if (!criteria) return;

    const nextSearchType = criteria.searchType ?? 'FTS';
    const nextKeyword = criteria.keyword ?? '';
    const nextBrand = criteria.brand ?? '';
    const nextExactMatch = nextSearchType === 'FTS' ? false : Boolean(criteria.exactMatch);
    const nextMyItems = Boolean(criteria.myItems);

    setSearchType(nextSearchType);
    setKeyword(nextKeyword);
    setBrand(nextBrand);
    setBrandInput(nextBrand);
    setExactMatch(nextExactMatch);
    setMyItems(nextMyItems);
    setCriteriaText(
      buildCriteriaText({
        searchType: nextSearchType,
        keyword: nextKeyword,
        brand: nextBrand,
        exactMatch: nextExactMatch,
        myItems: nextMyItems,
      })
    );
  }, [criteria?.searchType, criteria?.keyword, criteria?.brand, criteria?.exactMatch, criteria?.myItems]);

  const runSearch = (criteria: {
    searchType: SearchType;
    keyword: string;
    brand: string;
    exactMatch: boolean;
    myItems: boolean;
  }) => {
    const nextCriteriaText = buildCriteriaText(criteria);
    setCriteriaText(nextCriteriaText);
    if (onQuickFilterChange) onQuickFilterChange(nextCriteriaText);
    onSearch(criteria);
  };

  const handleSearchTypeChange = (nextType: SearchType) => {
    const nextExactMatch = nextType === 'FTS' ? false : exactMatch;
    const nextKeyword = nextType === 'FTS' ? sanitizeFTSKeyword(keyword) : keyword;
    setSearchType(nextType);
    setKeyword(nextKeyword);
    setShowKeywordDropdown(false);
    if (nextType === 'FTS') {
      setExactMatch(false);
    }
    // Avoid unnecessary reload when no typed keyword.
    if (nextKeyword.trim().length > 0) {
      runSearch({
        searchType: nextType,
        keyword: nextKeyword,
        brand,
        exactMatch: nextExactMatch,
        myItems,
      });
    }
  };

  const handleReset = () => {
    setSearchType('FTS');
    setKeyword('');
    setShowKeywordDropdown(false);
    setFtsSuggestions([]);
    setBrand('');
    setBrandInput('');
    setExactMatch(false);
    setMyItems(false);
    setCriteriaText(DEFAULT_CRITERIA_TEXT);
    if (onQuickFilterChange) onQuickFilterChange(DEFAULT_CRITERIA_TEXT);
    onReset();
  };

  const handleKeywordSuggestionSelect = (row: FtsAutocompleteOption) => {
    const itemCode = (row.ItemCode || '').trim();
    if (!itemCode) return;
    setSearchType('ITEM');
    setExactMatch(false);
    setKeyword(itemCode);
    setShowKeywordDropdown(false);
    runSearch({
      searchType: 'ITEM',
      keyword: itemCode,
      brand,
      exactMatch: false,
      myItems,
    });
  };

  const handleSelectBrand = (value: string) => {
    // "Please select" from DB acts as "All" (empty filter)
    const isAll = value === 'Please select' || value === 'all';
    const finalBrand = isAll ? '' : value;

    setBrand(finalBrand);
    setBrandInput(isAll ? '' : finalBrand);
    setShowBrandDropdown(false);

    // Trigger auto-search
    runSearch({
      searchType,
      keyword,
      brand: finalBrand,
      exactMatch,
      myItems
    });
  };

  return (
    <div className="bg-[#D4E7F7] border-b border-[#A0C0E0] p-2 flex flex-col md:flex-row gap-2">
      {/* Left Column: User Picture (fixed 67×85px, portrait) */}
      <div className="flex-shrink-0 hidden md:flex items-center">
        <div
          className="bg-white border border-[#A0C0E0] rounded shadow-sm flex items-center justify-center overflow-hidden"
          style={{ width: 67, height: 85 }}
        >
          {showUserPicture ? (
            <img
              src="/api/auth/user-picture"
              alt="User"
              style={{ width: 67, height: 85, objectFit: 'cover' }}
              onError={() => setShowUserPicture(false)}
            />
          ) : (
            <span className="text-center text-[11px] font-bold leading-tight text-[#2264A0]">
              USER
              <br />
              PICTURE
            </span>
          )}
        </div>
      </div>

      {/* Right Column: Search Inputs & Actions */}
      <div className="flex-1 flex flex-col gap-2 min-w-0">
        {/* Row 1: Search Inputs & Primary Actions */}
        <div className="flex flex-col md:flex-row items-start md:items-center gap-2 flex-wrap md:flex-nowrap">
          {/* Main Search Input */}
          <div className="w-full md:flex-[1.5] min-w-[150px]" ref={keywordRef}>
            {isFTSMode ? (
              <div className="relative">
                <Input
                  id={ids.keyword}
                  name="keyword"
                  aria-label="Keyword search"
                  type="text"
                  value={keyword}
                  onChange={(e) => {
                    const cleanValue = sanitizeFTSKeyword(e.target.value);
                    setKeyword(cleanValue);
                    setShowKeywordDropdown(true);
                  }}
                  onFocus={() => setShowKeywordDropdown(true)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSearch();
                  }}
                  className="w-full h-8 bg-white border-[#A0C0E0] focus-visible:ring-1 focus-visible:ring-[#2264A0]"
                />
                {showKeywordDropdown && (
                  <div className="absolute z-50 mt-1 w-full md:w-[900px] max-w-[95vw] bg-white border border-[#A0C0E0] rounded-md shadow-lg overflow-hidden">
                    {ftsSuggestionsLoading && (
                      <div className="px-2 py-2 text-xs text-gray-500 text-center">Loading...</div>
                    )}
                    {!ftsSuggestionsLoading && ftsSuggestions.length > 0 && (
                      <div className="max-h-[260px] overflow-auto">
                        <table className="w-full text-xs border-collapse">
                          <thead className="sticky top-0 z-10 bg-[#E8F0F8]">
                            <tr>
                              <th className="text-left px-2 py-1 border-b border-[#A0C0E0] w-[110px]">Item Code</th>
                              <th className="text-left px-2 py-1 border-b border-[#A0C0E0] w-[120px]">MFG/Brand</th>
                              <th className="text-left px-2 py-1 border-b border-[#A0C0E0] w-[150px]">Mfr Catalog No</th>
                              <th className="text-left px-2 py-1 border-b border-[#A0C0E0]">Long Description</th>
                            </tr>
                          </thead>
                          <tbody>
                            {ftsSuggestions.map((row, idx) => {
                              const rowKey = `${row.ItemCode || ''}-${row.U_Brand || ''}-${row.U_Calalogno || ''}-${idx}`;
                              return (
                                <tr
                                  key={rowKey}
                                  className="cursor-pointer hover:bg-[#E8F0F8] border-b border-[#F0F0F0]"
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={() => handleKeywordSuggestionSelect(row)}
                                >
                                  <td className="px-2 py-1 align-top">{row.ItemCode || '-'}</td>
                                  <td className="px-2 py-1 align-top">{row.U_Brand || '-'}</td>
                                  <td className="px-2 py-1 align-top">{row.U_Calalogno || '-'}</td>
                                  <td className="px-2 py-1 align-top">{row.ItemDescription || '-'}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                    {!ftsSuggestionsLoading && ftsSuggestions.length === 0 && keyword.trim().length >= 2 && (
                      <div className="px-2 py-2 text-xs text-gray-400 text-center">No suggestion</div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <Input
                id={ids.keyword}
                name="keyword"
                aria-label="Keyword search"
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSearch();
                }}
                className="w-full h-8 bg-white border-[#A0C0E0] focus-visible:ring-1 focus-visible:ring-[#2264A0]"
              />
            )}
          </div>

          <div className="flex items-center gap-1 w-full md:w-auto md:flex-1 md:min-w-[120px] whitespace-nowrap">
            <span className="text-xs font-bold text-[#555555]">SEARCH BY:</span>
            <Select value={searchType} onValueChange={(v) => handleSearchTypeChange(v as SearchType)}>
              <SelectTrigger id={ids.searchType} name="searchType" aria-label="Search type" className="h-8 flex-1 bg-white border-[#A0C0E0] text-xs min-w-0">
                <SelectValue placeholder="Full-Text Search" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="FTS">Full-Text Search</SelectItem>
                <SelectItem value="CATNO">Mfr Catalog No</SelectItem>
                <SelectItem value="CUST">Customer Stock Code</SelectItem>
                <SelectItem value="ITEM">Item Code</SelectItem>
                <SelectItem value="SAP">SAP B1 Item No</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Brand / MFG — Autocomplete */}
          <div className="flex items-center gap-1 w-full md:w-auto md:flex-1 md:min-w-[140px] whitespace-nowrap" ref={brandRef}>
            <span className="text-xs font-bold text-[#555555]">BRAND/MFG:</span>
            <div className="relative flex-1 min-w-0">
              <input
                id={ids.brand}
                name="brand"
                aria-label="Brand or manufacturer"
                type="text"
                value={brandInput}
                placeholder={brand ? brand : 'Please select'}
                onChange={(e) => {
                  setBrandInput(e.target.value);
                  setShowBrandDropdown(true);
                  if (!e.target.value) setBrand('');
                }}
                onFocus={() => setShowBrandDropdown(true)}
                className="w-full h-8 px-2 bg-white border border-[#A0C0E0] rounded-md text-xs outline-none focus:border-[#2264A0] focus:ring-1 focus:ring-[#2264A0]"
              />
              {showBrandDropdown && (
                <div className="absolute z-50 mt-1 w-full max-h-[240px] overflow-y-auto bg-white border border-[#A0C0E0] rounded-md shadow-lg">
                  <div
                    key="_all"
                    className={`px-2 py-1.5 text-xs cursor-pointer hover:bg-[#E8F0F8] ${brand === '' ? 'bg-[#D4E7F7] font-semibold' : ''
                      }`}
                    onClick={() => handleSelectBrand('all')}
                  >
                    All
                  </div>
                  {filteredBrands.map((b) => (
                    <div
                      key={b}
                      className={`px-2 py-1.5 text-xs cursor-pointer hover:bg-[#E8F0F8] ${brand === b ? 'bg-[#D4E7F7] font-semibold' : ''
                        }`}
                      onClick={() => handleSelectBrand(b)}
                    >
                      {b}
                    </div>
                  ))}
                  {filteredBrands.length === 0 && (
                    <div className="px-2 py-2 text-xs text-gray-400 text-center">No brand found</div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Buttons Row (grouped for mobile) */}
          <div className="flex items-center gap-2 w-full md:w-auto mt-2 md:mt-0 flex-shrink-0">
            {/* Search Button */}
            <Button
              onClick={handleSearch}
              disabled={waitState}
              size="sm"
              className="h-8 flex-1 md:flex-none md:w-[102px] justify-center bg-[#DAE9F5] hover:bg-[#C8DEF0] text-[#2264A0] border border-[#A0C0E0] shadow-sm px-3"
            >
              <span className="mr-1 inline-block min-w-[42px] text-center text-xs font-bold">{waitState ? 'WAIT...' : 'SEARCH'}</span>
              <div className={`${waitState ? 'bg-[#888888]' : 'bg-[#78B74A]'} text-white rounded p-0.5`}>
                {waitState ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
              </div>
            </Button>

            {/* Reset Button */}
            <Button
              onClick={handleReset}
              size="sm"
              className="h-8 flex-1 md:flex-none bg-[#DAE9F5] hover:bg-[#C8DEF0] text-[#666666] border border-[#A0C0E0] shadow-sm px-3"
            >
              <span className="mr-1 text-xs">RESET...</span>
              <div className="bg-[#888888] text-white rounded-full p-0.5">
                <RotateCcw className="w-3 h-3" />
              </div>
            </Button>
          </div>
        </div>

        {/* Row 2: Actions & Filters */}
        <div className="flex flex-col md:flex-row items-center gap-2 flex-wrap">
          <div className="flex w-full md:w-auto gap-2 overflow-x-auto pb-1 md:pb-0">
            {/* My Item Checkbox */}
            <div className="flex items-center space-x-1 bg-[#DAE9F5] px-2 py-1 border border-[#A0C0E0] rounded-sm h-8 min-w-[100px] flex-shrink-0">
              <Checkbox
                id="myItems"
                checked={myItems}
                onCheckedChange={(checked) => {
                  const nextMyItems = checked === true;
                  setMyItems(nextMyItems);
                  runSearch({
                    searchType,
                    keyword,
                    brand,
                    exactMatch,
                    myItems: nextMyItems,
                  });
                }}
                className="w-4 h-4 bg-white border-gray-400"
              />
              <Label htmlFor="myItems" className="cursor-pointer text-xs text-[#2264A0] font-medium whitespace-nowrap">
                My Item
              </Label>
            </div>

            {/* New Item Button */}
            <Button
              onClick={onAddItem}
              disabled={addItemDisabled}
              size="sm"
              className="h-8 bg-[#DAE9F5] hover:bg-[#C8DEF0] text-[#2264A0] border border-[#A0C0E0] px-4 min-w-[80px] flex-shrink-0"
            >
              <div className="bg-[#78B74A] text-white rounded-sm p-0 mr-1">
                <Plus className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold">New</span>
            </Button>

            {/* Term Button (Cart) */}
            <Button
              onClick={onAddTerm}
              disabled={addTermDisabled}
              size="sm"
              className="h-8 bg-[#DAE9F5] hover:bg-[#C8DEF0] text-[#333333] border border-[#A0C0E0] px-2 w-[180px] justify-start flex-shrink-0"
              title={addTermDisabled ? 'Read-only phase' : 'Add Term / Cart'}
            >
              <ShoppingCart className="w-4 h-4 mr-1 text-[#78B74A] flex-shrink-0" />
              <span className="text-xs truncate">{selectedItemCode ? `${selectedItemCode} +TERM` : '+TERM'}</span>
            </Button>
          </div>

          {/* Quick Filter Input */}
          <div className="relative w-full md:flex-1">
            <Filter className="absolute left-2 top-2 w-4 h-4 text-black pointer-events-none" />
            <Input
              id={ids.criteria}
              name="criteriaSummary"
              aria-label="Current search criteria"
              type="text"
              value={criteriaText}
              readOnly
              onChange={() => {
                // Read-only
              }}
              className="w-full h-8 pl-8 bg-[#F5F5F5] border-[#A0C0E0] text-xs cursor-default focus-visible:ring-0"
            />
          </div>

          {/* Exact Match Checkbox */}
          <div className="flex items-center space-x-1 w-full md:w-auto justify-end">
            <Checkbox
              id="exactMatch"
              checked={exactMatch}
              disabled={isFTSMode}
              onCheckedChange={(checked) => {
                const nextExactMatch = checked === true;
                setExactMatch(nextExactMatch);
                if (!isFTSMode && keyword.trim().length > 0) {
                  runSearch({
                    searchType,
                    keyword,
                    brand,
                    exactMatch: nextExactMatch,
                    myItems,
                  });
                }
              }}
              className="w-4 h-4 bg-white border-gray-400"
            />
            <Label htmlFor="exactMatch" className={`cursor-pointer text-xs font-medium whitespace-nowrap ${isFTSMode ? 'text-gray-400' : 'text-black'}`}>
              Exact Match
            </Label>
          </div>
        </div>
      </div>
    </div>
  );
}
