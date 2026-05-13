import { useState, useMemo, Fragment, useCallback } from 'react';
import { format } from 'date-fns';
import {
  useReactTable,
  getCoreRowModel,
  ColumnDef,
  flexRender,
  ColumnSizingState,
} from '@tanstack/react-table';
import { PartItem, TermItem } from '../../../types/partcatalog_types';
import { Button } from '../../ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../ui/table';
import { Check, X, ChevronRight, ChevronDown, Loader2 } from 'lucide-react';

interface PartItemsGridProps {
  items: PartItem[];
  totalItems: number;
  termsByItemId: Record<number, TermItem[]>;
  loadingTermItemIds?: Set<number>;
  isLoading?: boolean;
  onItemSelect: (item: PartItem) => void;
  onItemDoubleClick: (item: PartItem) => void;
  onTermDoubleClick?: (termId: number, itemId: number) => void;
  onExpandItem?: (itemId: number) => void;
  currentPage: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

// Helper to measure text width for auto-fit
const measureTextWidth = (text: string, font: string) => {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) return 0;
  context.font = font;
  return context.measureText(text).width;
};

// --- Sub-component: Terms Grid (TanStack Table) ---
// Renders the nested table with TanStack to support Resizing and Auto-fit
function TermsGrid({ terms, onTermDoubleClick, parentItemId }: { terms: TermItem[], onTermDoubleClick?: (termId: number, itemId: number) => void, parentItemId: number }) {
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});

  const formatDate = (dateStr?: string, includeTime: boolean = false) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    const options: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit', year: 'numeric' };
    if (includeTime) {
      options.hour = '2-digit';
      options.minute = '2-digit';
      options.hour12 = false;
    }
    return format(date, includeTime ? 'dd-MMM-yyyy HH:mm:ss' : 'dd-MMM-yyyy');
  };

  const formatAwardedSO = (value: unknown) => {
    if (value === null || value === undefined) return '';
    const text = String(value).trim();
    return text.length > 0 ? text : '';
  };

  const formatFlag = (val?: boolean) => {
    return val ? <Check className="w-4 h-4 mx-auto text-[#5AA02A]" /> : <X className="w-4 h-4 mx-auto text-[#C12B2B]" />;
  };

  const columns = useMemo<ColumnDef<TermItem>[]>(() => [
    { accessorKey: 'Active', header: 'Active', size: 60, cell: info => formatFlag(info.getValue() as boolean) },
    { accessorKey: 'LastAwardedSO', header: 'AwardedSO', size: 100, cell: info => <div className="text-center">{formatAwardedSO(info.getValue())}</div> },
    { accessorKey: 'CardName', header: 'Vendor Name', size: 250, cell: info => <span className="font-medium">{info.getValue() as string}</span> },
    { accessorKey: 'U_QLC', header: 'QTEC W/H COST', size: 120, cell: info => <div className="text-right text-[#2264A0] font-bold">{(info.getValue() as number)?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div> },
    { accessorKey: 'VendorStockItemNo', header: 'Vendor Stock No.', size: 150 },
    { accessorKey: 'U_OrderTerm', header: 'Order Term', size: 100, cell: info => <div className="text-center">{info.getValue() as string}</div> },
    { accessorKey: 'U_TermLocation', header: 'Order Term Location', size: 150, cell: info => <div className="text-center">{info.getValue() as string}</div> }, // Centered as requested
    { accessorKey: 'SubLocation', header: 'Order Term Sub Loc', size: 150 },
    { accessorKey: 'ContractNo', header: 'ContractNo', size: 150 },
    { accessorKey: 'U_SalesTerm', header: 'Sales Term', size: 100, cell: info => <div className="text-center">{info.getValue() as string}</div> },
    { accessorKey: 'SaleSubLocation', header: 'Sales Sub Loc', size: 150 },
    { accessorKey: 'U_ProdCost', header: 'Product Cost', size: 120, cell: info => <div className="text-right">{(info.getValue() as number)?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div> },
    { accessorKey: 'U_PurCurr', header: 'Pur Currency', size: 80, cell: info => <div className="text-center">{info.getValue() as string}</div> },
    {
      accessorKey: 'U_PurRate',
      header: 'Pur Ex.Rate',
      size: 100,
      cell: (info) => {
        const value = Number(info.getValue());
        const normalized = Number.isFinite(value) ? value : 1;
        return (
          <div className="text-right">
            {normalized.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        );
      },
    },
    { accessorKey: 'BuyUnitMsr', header: 'Pur UOM', size: 80, cell: info => <div className="text-center">{info.getValue() as string}</div> },
    { accessorKey: 'SalUnitMsr', header: 'Sales UOM', size: 80, cell: info => <div className="text-center">{info.getValue() as string}</div> },
    { accessorKey: 'Updatedby', header: 'Updated By', size: 150 },
    { accessorKey: 'UpdatedDate', header: 'Updated Date', size: 150, cell: info => <div className="text-center">{formatDate(info.getValue() as string, true)}</div> },
    { accessorKey: 'U_ValidFrom', header: 'Valid From', size: 100, cell: info => <div className="text-center">{formatDate(info.getValue() as string)}</div> },
    { accessorKey: 'U_ValidTo', header: 'Valid To', size: 100, cell: info => <div className="text-center">{formatDate(info.getValue() as string)}</div> },
  ], []);

  const table = useReactTable({
    data: terms,
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
    terms.forEach(item => {
      const val = (item as any)[columnId];
      if (val) {
        const width = measureTextWidth(String(val), font);
        if (width > maxWidth) maxWidth = width;
      }
    });
    const finalWidth = Math.ceil(maxWidth + 24);
    setColumnSizing(old => ({ ...old, [columnId]: finalWidth }));
  }, [terms, columns]);

  return (
    <div className="bg-white rounded border border-gray-300 overflow-hidden">
      <div className="bg-[#E8F0F8] px-4 py-1 border-b border-blue-200 flex items-center gap-2">
        <span className="text-[#2264A0] font-bold text-sm">Terms List (Resizable)</span>
        <span className="text-xs text-gray-500">({terms.length} records)</span>
      </div>
      <div className="overflow-x-auto">
        <Table style={{ width: table.getTotalSize(), minWidth: '100%', tableLayout: 'fixed' }}>
          <TableHeader>
            {table.getHeaderGroups().map(headerGroup => (
              // Disabled Hover Effect by forcing same bg color on hover
              <TableRow key={headerGroup.id} className="bg-[#666666] border-b-0 hover:bg-[#666666]">
                {headerGroup.headers.map(header => (
                  <TableHead
                    key={header.id}
                    className="text-white text-center border-r border-gray-500 p-0 relative group h-7 select-none text-xs hover:bg-[#666666]"
                    style={{ width: header.getSize() }}
                  >
                    <div className="flex items-center justify-center gap-1 h-full px-1">
                      <span className="truncate">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                      </span>
                    </div>
                    {header.column.getCanResize() && (
                      <div
                        onMouseDown={header.getResizeHandler()}
                        onTouchStart={header.getResizeHandler()}
                        onDoubleClick={() => handleDoubleClickResize(header.column.id)}
                        className={`absolute right-0 top-0 h-full w-[4px] bg-gray-400 cursor-col-resize touch-none opacity-0 group-hover:opacity-100 ${header.column.getIsResizing() ? 'bg-yellow-400 opacity-100' : ''
                          }`}
                      />
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map(row => (
              <TableRow
                key={row.id}
                className="hover:bg-blue-50 cursor-pointer h-8"
                onDoubleClick={() => onTermDoubleClick?.(row.original.TermID, parentItemId)}
              >
                {row.getVisibleCells().map(cell => (
                  <TableCell
                    key={cell.id}
                    className="p-1 border-r border-gray-200 align-middle text-xs truncate"
                    style={{ width: cell.column.getSize() }}
                    title={String(cell.getValue() || '')}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// --- Main Component ---
export function PartItemsGrid({
  items,
  totalItems,
  termsByItemId,
  loadingTermItemIds,
  isLoading = false,
  onItemSelect,
  onItemDoubleClick,
  onTermDoubleClick,
  onExpandItem,
  currentPage,
  pageSize,
  onPageChange,
}: PartItemsGridProps) {
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [selectedRow, setSelectedRow] = useState<number | null>(null);

  const toggleRow = (itemId: number) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId);
    } else {
      newExpanded.add(itemId);
      onExpandItem?.(itemId);
    }
    setExpandedRows(newExpanded);
  };

  const formatFlag = (val?: boolean) => {
    return val ? <Check className="w-4 h-4 mx-auto text-[#5AA02A]" /> : <X className="w-4 h-4 mx-auto text-[#C12B2B]" />;
  };

  const formatDate = (dateStr?: string, includeTime: boolean = false) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    const options: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit', year: 'numeric' };
    if (includeTime) {
      options.hour = '2-digit';
      options.minute = '2-digit';
      options.hour12 = false;
    }
    return format(date, includeTime ? 'dd-MMM-yyyy HH:mm:ss' : 'dd-MMM-yyyy');
  };

  // Server sends only current page data — no client-side slicing needed
  const paginatedItems = items;
  const totalPages = Math.ceil(totalItems / pageSize);

  const columns = useMemo<ColumnDef<PartItem>[]>(() => [
    {
      id: 'expand',
      header: '',
      cell: ({ row }) => {
        const itemId = row.original.ItemID;
        const isLoadingTerms = loadingTermItemIds?.has(itemId) ?? false;
        return (
          <div
            onClick={(e) => {
              e.stopPropagation();
              toggleRow(itemId);
            }}
            className="flex items-center justify-center w-6 h-6 cursor-pointer hover:bg-gray-200 rounded-full text-gray-500 transition-colors"
          >
            {isLoadingTerms && expandedRows.has(itemId)
              ? <Loader2 size={16} className="animate-spin" />
              : expandedRows.has(itemId)
                ? <ChevronDown size={16} />
                : <ChevronRight size={16} />}
          </div>
        );
      },
      size: 30,
      enableResizing: false,
    },
    { accessorKey: 'Active', header: 'Active', cell: info => formatFlag(info.getValue() as boolean), size: 60 },
    { accessorKey: 'MasterFG', header: 'Master', cell: info => formatFlag(info.getValue() as boolean), size: 60 },
    { accessorKey: 'LastAwardedSO', header: 'AwardedSO', size: 100 },
    { accessorKey: 'U_CustBPA', header: 'BPA', cell: info => formatFlag(info.getValue() as boolean), size: 60 },
    { accessorKey: 'U_VMI', header: 'S-Agmt', cell: info => formatFlag(info.getValue() as boolean), size: 60 },
    { accessorKey: 'U_IsQTECSTock', header: 'Q-STK', cell: info => formatFlag(info.getValue() as boolean), size: 60 },
    { accessorKey: 'InvntryUom', header: 'STK UOM', size: 80 },
    { accessorKey: 'ItemCode', header: 'Item Code', cell: info => <span className="font-bold text-[#2264A0]">{info.getValue() as string}</span>, size: 120 },
    { accessorKey: 'B1ItemNo', header: 'SAP Item No', size: 120 },
    { accessorKey: 'U_Calalogno', header: 'Mfr Catalog No', size: 250 },
    { accessorKey: 'BPStockItemNo', header: 'Customer Stock', size: 200 },
    { accessorKey: 'U_Brand', header: 'Brand / MFG', size: 150 },
    { accessorKey: 'ItemDescription', header: 'Item Description', size: 300 },
    { accessorKey: 'LongDesc1', header: 'LongDesc1', size: 200, cell: info => <span className="text-gray-500">{info.getValue() as string}</span> },
    { accessorKey: 'LongDesc2', header: 'LongDesc2', size: 200, cell: info => <span className="text-gray-500">{info.getValue() as string}</span> },
    { accessorKey: 'LongDesc3', header: 'LongDesc3', size: 200, cell: info => <span className="text-gray-500">{info.getValue() as string}</span> },
    { accessorKey: 'LongDesc4', header: 'LongDesc4', size: 200, cell: info => <span className="text-gray-500">{info.getValue() as string}</span> },
    { accessorKey: 'VatGroupPu', header: 'Pur VAT', size: 80 },
    { accessorKey: 'VatGourpSa', header: 'Sales VAT', size: 80 },
    { accessorKey: 'U_CountryOrg', header: 'Origin', size: 100, cell: info => <div className="text-center">{info.getValue() as string}</div> }, // Centered as requested
    { accessorKey: 'Updatedby', header: 'Updated By', size: 150 },
    { accessorKey: 'UpdatedDate', header: 'Updated Date', cell: info => <div className="text-center">{formatDate(info.getValue() as string, true)}</div>, size: 150 },
    { accessorKey: 'TariffDescription', header: 'TariffDescription', size: 200 },
    { accessorKey: 'TariffCode', header: 'TariffCode', size: 100 },
    { accessorKey: 'CustomsDuty', header: 'Duty %', cell: info => <div className="text-right">{info.getValue() as string}</div>, size: 80 },
  ], [expandedRows, loadingTermItemIds]);

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
      <div
        className="border border-[#DDDDDD] bg-white relative"
        style={{ height: 'calc(100vh - 270px)', overflow: 'auto' }}
      >
        <table
          className="caption-bottom text-sm w-full"
          style={{
            width: table.getTotalSize(),
            minWidth: '100%',
            tableLayout: 'fixed',
          }}
        >
          <TableHeader className="bg-[#2264A0] shadow-sm sticky top-0 z-20">
            {table.getHeaderGroups().map(headerGroup => (
              <TableRow key={headerGroup.id} className="hover:bg-[#2264A0] border-b-0">
                {headerGroup.headers.map(header => (
                  <TableHead
                    key={header.id}
                    className="sticky top-0 z-20 bg-[#2264A0] text-white text-center border-r border-blue-400 p-0 relative group h-10 select-none"
                    style={{ width: header.getSize() }}
                  >
                    <div className="flex flex-col h-full overflow-hidden">
                      <div className="flex items-center justify-center gap-1 h-full px-1">
                        <span className="truncate">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                        </span>
                      </div>
                    </div>
                    {header.column.getCanResize() && (
                      <div
                        onMouseDown={header.getResizeHandler()}
                        onTouchStart={header.getResizeHandler()}
                        onDoubleClick={() => handleDoubleClickResize(header.column.id)}
                        className={`absolute right-0 top-0 h-full w-[4px] bg-blue-300 cursor-col-resize touch-none opacity-0 group-hover:opacity-100 ${header.column.getIsResizing() ? 'bg-yellow-400 opacity-100' : ''
                          }`}
                      />
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row, rowIndex) => {
              const terms = termsByItemId[row.original.ItemID] || [];
              const isTermsLoading = loadingTermItemIds?.has(row.original.ItemID) ?? false;
              const isTermsExpanded = expandedRows.has(row.original.ItemID);
              const isSelected = selectedRow === row.original.ItemID;
              const stripeBg = rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50';

              return (
                <Fragment key={row.original.ItemID}>
                  <TableRow
                    className={`cursor-pointer group h-[35px] ${isSelected ? 'bg-[#D4E7F7]' : `${stripeBg} hover:bg-[#E8F0F8]`}`}
                    onClick={() => {
                      setSelectedRow(row.original.ItemID);
                      onItemSelect(row.original);
                    }}
                    onDoubleClick={() => onItemDoubleClick(row.original)}
                  >
                    {row.getVisibleCells().map(cell => (
                      <TableCell
                        key={cell.id}
                        className="p-1 border-r border-[#DDDDDD] align-middle text-xs truncate"
                        style={{ width: cell.column.getSize() }}
                        title={String(cell.getValue() || '')}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>

                  {isTermsExpanded && (
                    <TableRow>
                      <TableCell colSpan={columns.length} className="bg-[#F5F5F5] p-2 shadow-inner border-r border-[#DDDDDD]">
                        {isTermsLoading && (
                          <div className="h-16 flex items-center justify-center text-sm text-gray-500 gap-2">
                            <Loader2 size={16} className="animate-spin" />
                            Loading terms...
                          </div>
                        )}
                        {!isTermsLoading && terms.length > 0 && (
                          <TermsGrid
                            terms={terms}
                            onTermDoubleClick={onTermDoubleClick}
                            parentItemId={row.original.ItemID}
                          />
                        )}
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              );
            })}
          </TableBody>
        </table>
      </div>

      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-white/60 flex items-center justify-center z-10">
          <span className="text-sm text-gray-500 animate-pulse">Loading...</span>
        </div>
      )}

      {/* Pagination bar — always visible */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-[#DDDDDD] bg-white text-sm" style={{ flexShrink: 0 }}>
        {/* Left: record range info */}
        <span className="text-xs text-gray-500">
          {totalItems > 0
            ? `Showing ${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, totalItems)} of ${totalItems} records`
            : 'No records'}
        </span>

        {/* Center: page buttons */}
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1 || isLoading}
            className="border-[#DDDDDD] h-7 px-2 text-xs"
          >
            ← Prev
          </Button>

          {/* Page number buttons */}
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
                  onClick={() => onPageChange(p)}
                  disabled={isLoading}
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
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages || isLoading}
            className="border-[#DDDDDD] h-7 px-2 text-xs"
          >
            Next →
          </Button>
        </div>

        {/* Right: page size info */}
        <span className="text-xs text-gray-400">{pageSize} per page</span>
      </div>
    </div>
  );
}
