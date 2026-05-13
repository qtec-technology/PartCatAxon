import { useState, useMemo, useCallback, useEffect, useRef, useId } from 'react';
import { format } from 'date-fns';
import {
  useReactTable,
  getCoreRowModel,
  ColumnDef,
  flexRender,
  ColumnSizingState,
} from '@tanstack/react-table';
import { BrandVendorItem } from '../../../../types/partcatalog_types';
import { lookupApi } from '../../../../services/lookup.api';
import { itemApi } from '../../../../services/item.api';
import { Button } from '../../../ui/button';
import { clientLogger } from '../../../../utils/logger';

const BRAND_VENDOR_FILTER_KEY = 'partcatalog:filters:brand-vendor:selectedBrand';
const BRAND_OPTIONS_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const BRAND_VENDOR_RESULT_CACHE_TTL_MS = 5 * 60 * 1000;

type TimedValue<T> = { value: T; at: number };
let cachedBrandOptions: TimedValue<string[]> | null = null;
const cachedBrandVendorResults = new Map<string, TimedValue<BrandVendorItem[]>>();

const readStoredFilterValue = (key: string): string => {
  try {
    return localStorage.getItem(key) ?? '';
  } catch {
    return '';
  }
};

const isFresh = (at: number, ttl: number) => Date.now() - at <= ttl;

// Helper to measure text width for auto-fit
const measureTextWidth = (text: string, font: string) => {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) return 0;
  context.font = font;
  return context.measureText(text).width;
};

export function BrandVendorView() {
  const brandInputId = useId();
  const [selectedBrand, setSelectedBrand] = useState<string>(() => readStoredFilterValue(BRAND_VENDOR_FILTER_KEY));
  const [brandInput, setBrandInput] = useState(() => readStoredFilterValue(BRAND_VENDOR_FILTER_KEY));
  const [showBrandDropdown, setShowBrandDropdown] = useState(false);
  const [brands, setBrands] = useState<string[]>([]);
  const [items, setItems] = useState<BrandVendorItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});
  const [currentPage, setCurrentPage] = useState(1);
  const brandRef = useRef<HTMLDivElement>(null);
  const pageSize = 50;

  useEffect(() => {
    let active = true;

    if (cachedBrandOptions && isFresh(cachedBrandOptions.at, BRAND_OPTIONS_CACHE_TTL_MS)) {
      setBrands(cachedBrandOptions.value);
      return () => {
        active = false;
      };
    }

    itemApi.getBrands()
      .then(data => {
        if (!active) return;
        const uniqueBrands = Array.from(
          new Set(
            data
              .map((row) => (row.U_Brand ?? row.Name ?? row.Code ?? '').trim())
              .filter((name): name is string => name.length > 0)
          )
        ).sort((a, b) => a.localeCompare(b));
        cachedBrandOptions = { value: uniqueBrands, at: Date.now() };
        setBrands(uniqueBrands);
      })
      .catch(err => {
        clientLogger.error('Failed to load brand list', err);
        if (active) setBrands([]);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(BRAND_VENDOR_FILTER_KEY, selectedBrand);
    } catch {
      // ignore storage errors
    }
  }, [selectedBrand]);

  const filteredBrands = useMemo(() => {
    const q = brandInput.trim().toUpperCase();
    if (!q) return brands;
    return brands.filter((brand) => brand.toUpperCase().startsWith(q));
  }, [brands, brandInput]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (brandRef.current && !brandRef.current.contains(event.target as Node)) {
        setShowBrandDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!selectedBrand) {
      setItems([]);
      setLoading(false);
      return;
    }

    const cached = cachedBrandVendorResults.get(selectedBrand);
    if (cached) setItems(cached.value);
    const shouldFetch = !cached || !isFresh(cached.at, BRAND_VENDOR_RESULT_CACHE_TTL_MS);
    if (!shouldFetch) {
      setLoading(false);
      return;
    }

    let active = true;
    if (!cached) setLoading(true);

    lookupApi.getBrandVendor(selectedBrand)
      .then(data => {
        if (!active) return;
        cachedBrandVendorResults.set(selectedBrand, { value: data, at: Date.now() });
        setItems(data);
      })
      .catch(err => {
        clientLogger.error('Failed to load brand-vendor data', err);
        if (active) setItems([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [selectedBrand]);

  // Pagination
  const totalItems = items.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, currentPage]);

  // Reset page when filter changes
  const handleBrandChange = (value: string) => {
    setSelectedBrand(value);
    setBrandInput(value);
    setShowBrandDropdown(false);
    setCurrentPage(1);
  };

  const handleClearBrand = () => {
    setSelectedBrand('');
    setBrandInput('');
    setShowBrandDropdown(false);
    setItems([]);
    setCurrentPage(1);
  };

  const handleBrandInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return;
    const q = brandInput.trim();
    if (!q) {
      handleClearBrand();
      return;
    }
    const exact = brands.find((brand) => brand.toUpperCase() === q.toUpperCase());
    if (exact) {
      handleBrandChange(exact);
      return;
    }
    if (filteredBrands.length === 1) {
      handleBrandChange(filteredBrands[0]);
    }
  };

  const columns = useMemo<ColumnDef<BrandVendorItem>[]>(() => [
    { accessorKey: 'Source', header: 'Source', size: 80, cell: info => <div className="text-center">{info.getValue() as string}</div> },
    { accessorKey: 'Brand', header: 'Brand', size: 150, cell: info => <span className="font-bold text-[#2264A0]">{info.getValue() as string}</span> },
    { accessorKey: 'SupplierCode', header: 'Supplier Code', size: 120 },
    { accessorKey: 'SupplierName', header: 'Supplier Name', size: 250 },
    { accessorKey: 'ContactPerson', header: 'Contact Person', size: 150 },
    { accessorKey: 'Email', header: 'E_Mail', size: 200 },
    { accessorKey: 'Position', header: 'Position', size: 150 },
    { accessorKey: 'Tel1', header: 'Tel1', size: 130, cell: info => <div className="text-center">{info.getValue() as string}</div> },
    { accessorKey: 'Tel2', header: 'Tel2', size: 130, cell: info => <div className="text-center">{info.getValue() as string}</div> },
    { accessorKey: 'ContactID', header: 'Contact ID (SAP DEFAULT)', size: 180 },
    { accessorKey: 'PositionSAP', header: 'Position (SAP)', size: 150 },
    { accessorKey: 'EmailSAP', header: 'E_Mail (SAP DEFAULT)', size: 200 },
    { accessorKey: 'Tel1SAP', header: 'Tel1 (SAP)', size: 130, cell: info => <div className="text-center">{info.getValue() as string}</div> },
    { accessorKey: 'Tel2SAP', header: 'Tel2 (SAP)', size: 130, cell: info => <div className="text-center">{info.getValue() as string}</div> },
    { accessorKey: 'VendorBrand1', header: 'Vendor Brand 1', size: 150 },
    { accessorKey: 'VendorBrand2', header: 'Vendor Brand 2', size: 150 },
    { accessorKey: 'VendorBrand3', header: 'Vendor Brand 3', size: 150 },
    { accessorKey: 'CompanyPhone1', header: 'Company Phone 1', size: 150, cell: info => <div className="text-center">{info.getValue() as string}</div> },
    { accessorKey: 'CompanyPhone2', header: 'Company Phone 2', size: 150, cell: info => <div className="text-center">{info.getValue() as string}</div> },
    { accessorKey: 'CompanyMobile', header: 'Company Mobile', size: 150, cell: info => <div className="text-center">{info.getValue() as string}</div> },
    { accessorKey: 'CompanyEmail', header: 'Company E_Mail', size: 200 },
    {
      accessorKey: 'Website', header: 'Website', size: 200, cell: info => {
        const val = info.getValue() as string;
        return val ? <a href={val.startsWith('http') ? val : `http://${val}`} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline truncate block">{val}</a> : null;
      }
    },
    { accessorKey: 'CntctCode', header: 'CntctCode', size: 120, cell: info => <div className="text-center">{info.getValue() as string}</div> },
    {
      accessorKey: 'LastUpdate', header: 'LastUpdate (P-CAT/e-PRO)', size: 220, cell: info => {
        const val = info.getValue() as string;
        if (!val) return null;
        try {
          const date = new Date(val);
          return <div className="text-center">{isNaN(date.getTime()) ? val : format(date, 'dd-MMM-yyyy HH:mm:ss')}</div>;
        } catch { return val; }
      }
    },
  ], []);

  const table = useReactTable({
    data: paginatedItems,
    columns,
    state: { columnSizing },
    onColumnSizingChange: setColumnSizing,
    columnResizeMode: 'onChange',
    getCoreRowModel: getCoreRowModel(),
  });

  const handleDoubleClickResize = useCallback((columnId: string) => {
    const font = '12px Inter, sans-serif';
    let maxWidth = 0;
    const header = columns.find((c) => (c as any).accessorKey === columnId || c.id === columnId);
    if (header && typeof header.header === 'string') {
      maxWidth = Math.max(maxWidth, measureTextWidth(header.header, 'bold 12px Inter'));
    }
    paginatedItems.forEach(item => {
      const val = (item as any)[columnId];
      if (val) {
        const width = measureTextWidth(String(val), font);
        if (width > maxWidth) maxWidth = width;
      }
    });
    const finalWidth = Math.ceil(maxWidth + 24);
    setColumnSizing(old => ({ ...old, [columnId]: finalWidth }));
  }, [paginatedItems, columns]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Filter Section */}
      <div className="p-3 border-b border-gray-200 bg-gray-50 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <label htmlFor={brandInputId} className="text-base font-semibold text-gray-700 whitespace-nowrap">Brand Search:</label>
          <div className="relative w-full sm:w-[360px] max-w-full" ref={brandRef}>
            <input
              id={brandInputId}
              name="brandSearch"
              aria-label="Brand search"
              type="text"
              value={brandInput}
              placeholder="Please select"
              onChange={(event) => {
                const next = event.target.value;
                setBrandInput(next);
                setShowBrandDropdown(true);
                if (!next.trim()) {
                  setSelectedBrand('');
                  setItems([]);
                  setCurrentPage(1);
                }
              }}
              onFocus={() => setShowBrandDropdown(true)}
              onKeyDown={handleBrandInputKeyDown}
              className="w-full h-10 px-3 bg-white border border-gray-300 rounded-md text-base outline-none focus:border-[#2264A0] focus:ring-1 focus:ring-[#2264A0]"
            />
            {showBrandDropdown && (
              <div className="absolute z-50 mt-1 w-full max-h-[260px] overflow-y-auto bg-white border border-[#A0C0E0] rounded-md shadow-lg">
                {selectedBrand && (
                  <div
                    className="px-3 py-2 text-sm cursor-pointer hover:bg-[#E8F0F8] text-[#2264A0] border-b border-[#EEF4FA]"
                    onClick={handleClearBrand}
                  >
                    Clear selection
                  </div>
                )}
                {filteredBrands.map((brand) => (
                  <div
                    key={brand}
                    className={`px-3 py-2 text-sm cursor-pointer hover:bg-[#E8F0F8] ${selectedBrand === brand ? 'bg-[#D4E7F7] font-semibold' : ''}`}
                    onClick={() => handleBrandChange(brand)}
                  >
                    {brand}
                  </div>
                ))}
                {filteredBrands.length === 0 && (
                  <div className="px-3 py-2 text-sm text-gray-400 text-center">No brand found</div>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="text-base text-gray-500 ml-auto flex items-center gap-2 w-full sm:w-auto sm:justify-end">
          {selectedBrand && (
            <button onClick={handleClearBrand} className="text-sm text-blue-600 hover:underline">Clear Filter</button>
          )}
          <span>{selectedBrand ? `${totalItems} vendors found` : 'Please select a brand to search'}</span>
        </div>
      </div>

      {/* Data Grid — single horizontal+vertical scrollbar */}
      <div style={{ overflow: 'auto', maxHeight: 'calc(100vh - 230px)', position: 'relative' }}>
        <table
          style={{ tableLayout: 'fixed', width: table.getTotalSize(), minWidth: '100%', borderCollapse: 'collapse' }}
          className="border border-[#DDDDDD]"
        >
          <thead className="bg-[#2264A0] sticky top-0 z-20">
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id} className="bg-[#2264A0]">
                {headerGroup.headers.map(header => (
                  <th
                    key={header.id}
                    className="sticky top-0 z-20 bg-[#2264A0] text-white text-center border-r border-blue-400 p-0 relative group h-10 select-none text-xs font-semibold"
                    style={{ width: header.getSize() }}
                  >
                    <div className="flex items-center justify-center h-full px-1">
                      <span className="truncate">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                      </span>
                    </div>
                    {header.column.getCanResize() && (
                      <div
                        onMouseDown={header.getResizeHandler()}
                        onTouchStart={header.getResizeHandler()}
                        onDoubleClick={() => handleDoubleClickResize(header.column.id)}
                        className={`absolute right-0 top-0 h-full w-[4px] bg-blue-300 cursor-col-resize touch-none opacity-0 group-hover:opacity-100 ${header.column.getIsResizing() ? 'bg-yellow-400 opacity-100' : ''}`}
                      />
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="h-32 text-center text-gray-500 bg-white">
                  Loading...
                </td>
              </tr>
            ) : !selectedBrand ? (
              <tr>
                <td colSpan={columns.length} className="h-32 text-center text-gray-500 bg-white">
                  Please select a brand to search.
                </td>
              </tr>
            ) : paginatedItems.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="h-32 text-center text-gray-500 bg-white">
                  No vendors found.
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map(row => (
                <tr
                  key={row.id}
                  className="hover:bg-[#E8F0F8] h-[35px] odd:bg-white even:bg-gray-50 border-b border-[#DDDDDD]"
                >
                  {row.getVisibleCells().map(cell => (
                    <td
                      key={cell.id}
                      className="p-1 border-r border-[#DDDDDD] align-middle text-xs truncate"
                      style={{ width: cell.column.getSize() }}
                      title={String(cell.getValue() || '')}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination bar — always visible */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-[#DDDDDD] bg-white text-sm" style={{ flexShrink: 0 }}>
        <span className="text-xs text-gray-500">
          {totalItems > 0
            ? `Showing ${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, totalItems)} of ${totalItems} vendors`
            : 'No vendors'}
        </span>

        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
            className="border-[#DDDDDD] h-7 px-2 text-xs"
          >
            ← Prev
          </Button>

          {(() => {
            const pages: (number | string)[] = [];
            if (totalPages <= 7) {
              for (let i = 1; i <= totalPages; i++) pages.push(i);
            } else {
              pages.push(1);
              if (currentPage > 3) pages.push('...');
              for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
                pages.push(i);
              }
              if (currentPage < totalPages - 2) pages.push('...');
              pages.push(totalPages);
            }
            return pages.map((p, idx) =>
              typeof p === 'string' ? (
                <span key={`ellipsis-${idx}`} className="text-xs text-gray-400 px-1">…</span>
              ) : (
                <Button
                  key={p}
                  variant={p === currentPage ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setCurrentPage(p)}
                  className={`h-7 w-7 p-0 text-xs ${p === currentPage ? 'bg-[#2264A0] text-white hover:bg-[#1a5080]' : 'border-[#DDDDDD]'}`}
                >
                  {p}
                </Button>
              )
            );
          })()}

          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage >= totalPages}
            className="border-[#DDDDDD] h-7 px-2 text-xs"
          >
            Next →
          </Button>
        </div>

        <span className="text-xs text-gray-400">{pageSize} per page</span>
      </div>
    </div>
  );
}
