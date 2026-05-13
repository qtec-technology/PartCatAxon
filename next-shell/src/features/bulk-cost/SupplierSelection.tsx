'use client';

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Building2, ChevronDown, ChevronRight, Loader2, Plus, Search, SlidersHorizontal, X } from 'lucide-react';
import { type AllocationLineSource } from './bulk-cost.types';
import { listAxonQueue, type AxonQueueItem } from './bulk-cost.api';
import { getDemoLinesForSupplier, getDemoQuoteForSupplier } from './bulk-cost.mock';
import { useResizableTableColumns, type ResizableTableColumn } from './useResizableTableColumns';
import { lookupApi, type VendorLookupOption } from '@/services/lookup.api';

interface SupplierRow {
  queueId: number;
  vendorCode: string;
  quotationNo: string;
  name: string;
  currency: string;
  exchangeRate: number;
  itemCount: number;
  totalQty: number;
  totalAmount: number;
  orderTerm: string;
  paymentTerms: string;
  validityDays: string;
  deliveryLeadTime: string;
  termLocation: string;
  shipmentNote: string;
  saleIncharge: string;
  contactPerson: string;
  updatedAt: string;
}

const queueItemToSupplierRow = (item: AxonQueueItem): SupplierRow => {
  const vendorCode = item.supplierCodeHint ?? `AXON-${item.queueId}`;
  const demo = getDemoQuoteForSupplier(vendorCode);
  const lines = demo.lines;
  const totalQty = lines.reduce((s, l) => s + l.qty, 0);
  const totalAmount = lines.reduce((s, l) => s + l.amount, 0);
  const uniqueShipModes = Array.from(new Set(lines.map((l) => String(l.shipModeNo)))).join('/');
  const uniqueLeadTimes = Array.from(new Set(lines.map((l) => l.deliveryLeadTime).filter(Boolean)));
  return {
    queueId: item.queueId,
    vendorCode,
    quotationNo: item.documentNo ?? item.sourceFileName ?? item.sourceFileId,
    name: item.supplierRawName,
    currency: item.currency ?? demo.currency,
    exchangeRate: demo.exchangeRate,
    itemCount: item.totalLines,
    totalQty,
    totalAmount,
    orderTerm: item.purchaseTerm ?? demo.costs.orderTerm ?? '-',
    paymentTerms: demo.paymentTerms,
    validityDays: demo.validityDays,
    deliveryLeadTime: uniqueLeadTimes.length === 1 ? uniqueLeadTimes[0] : uniqueLeadTimes.length > 1 ? 'Mixed' : '-',
    termLocation: item.termLocation ?? demo.costs.location ?? '-',
    shipmentNote: uniqueShipModes || '-',
    saleIncharge: demo.saleIncharge,
    contactPerson: demo.contactPerson,
    updatedAt: item.receivedAt,
  };
};

const PAGE_SIZE = 400;

const SUPPLIER_TABLE_COLUMNS = [
  { key: 'expand', label: '', defaultWidth: 46, minWidth: 42, maxWidth: 52 },
  { key: 'quotationNo', label: 'Quotation No.', defaultWidth: 220, minWidth: 160, maxWidth: 360 },
  { key: 'name', label: 'Supplier Name', defaultWidth: 260, minWidth: 160, maxWidth: 440 },
  { key: 'itemCount', label: 'Item Lines', defaultWidth: 100, minWidth: 90 },
  { key: 'totalQty', label: 'Total Qty', defaultWidth: 112, minWidth: 96 },
  { key: 'totalAmount', label: 'Total Amount', defaultWidth: 150, minWidth: 126 },
  { key: 'currency', label: 'Currency', defaultWidth: 100, minWidth: 88 },
  { key: 'exchangeRate', label: 'Ex. Rate', defaultWidth: 110, minWidth: 96 },
  { key: 'orderTerm', label: 'Order Term', defaultWidth: 118, minWidth: 100 },
  { key: 'paymentTerms', label: 'Payment Terms', defaultWidth: 148, minWidth: 120, maxWidth: 240 },
  { key: 'validityDays', label: 'Validity', defaultWidth: 110, minWidth: 90, maxWidth: 160 },
  { key: 'termLocation', label: 'Location', defaultWidth: 160, minWidth: 130, maxWidth: 280 },
  { key: 'shipmentNote', label: 'Ship Mode', defaultWidth: 180, minWidth: 150, maxWidth: 280 },
  { key: 'saleIncharge', label: 'Sale Incharge', defaultWidth: 158, minWidth: 132, maxWidth: 260 },
  { key: 'contactPerson', label: 'Contact Person', defaultWidth: 158, minWidth: 132, maxWidth: 260 },
  { key: 'updatedAt', label: 'Updated At', defaultWidth: 172, minWidth: 158 },
] as const;

const SUPPLIER_DETAIL_TABLE_COLUMNS: Array<ResizableTableColumn & { label: string }> = [
  { key: 'no', label: 'No', defaultWidth: 74, minWidth: 64 },
  { key: 'description', label: 'Description', defaultWidth: 480, minWidth: 200, maxWidth: 900 },
  { key: 'manufacturer', label: 'Brand / Mfr', defaultWidth: 142, minWidth: 110, maxWidth: 280 },
  { key: 'mfgPartNumber', label: 'Mfr Part No.', defaultWidth: 166, minWidth: 132, maxWidth: 340 },
  { key: 'supplierOrderCode', label: 'Supp Part No.', defaultWidth: 160, minWidth: 128, maxWidth: 320 },
  { key: 'qty', label: 'Qty', defaultWidth: 80, minWidth: 68 },
  { key: 'uom', label: 'UOM', defaultWidth: 120, minWidth: 100 },
  { key: 'unitPrice', label: 'Unit Price', defaultWidth: 122, minWidth: 102 },
  { key: 'totalCost', label: 'Total Cost', defaultWidth: 130, minWidth: 110 },
  { key: 'moq', label: 'MOQ', defaultWidth: 100, minWidth: 86 },
  { key: 'leadTime', label: 'Lead Time', defaultWidth: 118, minWidth: 98 },
  { key: 'matchStatus', label: 'Match', defaultWidth: 112, minWidth: 96, maxWidth: 180 },
  { key: 'importPermit', label: 'Permit', defaultWidth: 118, minWidth: 104 },
  { key: 'shelfLifeRequire', label: 'Shelf Life', defaultWidth: 132, minWidth: 112 },
];

const SUPPLIER_DETAIL_DEFAULT_WIDTH = SUPPLIER_DETAIL_TABLE_COLUMNS.reduce(
  (sum, col) => sum + col.defaultWidth, 0,
);

const formatUpdatedAt = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const day = String(date.getDate()).padStart(2, '0');
  const month = date.toLocaleString('en-US', { month: 'short' });
  const year = date.getFullYear();
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  const second = String(date.getSeconds()).padStart(2, '0');
  return `${day}-${month}-${year} ${hour}:${minute}:${second}`;
};

const formatAmount = (value: number): string => value.toLocaleString(undefined, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const formatMatchStatus = (itemCode: string): string => (itemCode.trim() ? 'Existing' : 'New Item');

const formatYesNo = (value: string): string => {
  const v = value.trim().toLowerCase();
  if (v === 'yes' || v === 'y' || v === '1' || v === 'true') return 'Yes';
  return 'No';
};

const getSupplierItemPreviewRows = (supplier: SupplierRow): AllocationLineSource[] =>
  getDemoLinesForSupplier(supplier.vendorCode);

interface SupplierSelectionProps {
  onSelectSupplier: (vendor: { code: string; name: string }) => void;
}

export function SupplierSelection({ onSelectSupplier }: SupplierSelectionProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSaleIncharge, setFilterSaleIncharge] = useState('');
  const [filterOrderTerm, setFilterOrderTerm] = useState('');
  const [filterShipMode, setFilterShipMode] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [activeVendorCode, setActiveVendorCode] = useState<string | null>(null);
  const [expandedVendorCode, setExpandedVendorCode] = useState<string | null>(null);
  const [showManualDialog, setShowManualDialog] = useState(false);
  const [queueItems, setQueueItems] = useState<AxonQueueItem[]>([]);
  const [isQueueLoading, setIsQueueLoading] = useState(true);
  const tableSizing = useResizableTableColumns('bulk-cost-suppliers', SUPPLIER_TABLE_COLUMNS);

  useEffect(() => {
    setIsQueueLoading(true);
    listAxonQueue()
      .then((items) => setQueueItems(items))
      .catch(() => setQueueItems([]))
      .finally(() => setIsQueueLoading(false));
  }, []);

  const suppliers = useMemo(() => queueItems.map(queueItemToSupplierRow), [queueItems]);

  const saleInchargeOptions = useMemo(
    () => Array.from(new Set(suppliers.map((s) => s.saleIncharge).filter((v) => v && v !== '-'))).sort(),
    [suppliers],
  );
  const orderTermOptions = useMemo(
    () => Array.from(new Set(suppliers.map((s) => s.orderTerm).filter((v) => v && v !== '-' && v !== 'Mixed'))).sort(),
    [suppliers],
  );
  const shipModeOptions = useMemo(
    () => Array.from(new Set(suppliers.map((s) => s.shipmentNote).filter((v) => v && v !== '-' && v !== 'Mixed'))).sort(),
    [suppliers],
  );

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return suppliers.filter((supplier) => {
      if (filterSaleIncharge && supplier.saleIncharge !== filterSaleIncharge) return false;
      if (filterOrderTerm && supplier.orderTerm !== filterOrderTerm) return false;
      if (filterShipMode && supplier.shipmentNote !== filterShipMode) return false;
      if (!q) return true;
      return (
        supplier.quotationNo.toLowerCase().includes(q)
        || supplier.name.toLowerCase().includes(q)
        || supplier.currency.toLowerCase().includes(q)
        || supplier.orderTerm.toLowerCase().includes(q)
        || supplier.termLocation.toLowerCase().includes(q)
        || supplier.shipmentNote.toLowerCase().includes(q)
        || supplier.saleIncharge.toLowerCase().includes(q)
        || supplier.contactPerson.toLowerCase().includes(q)
      );
    });
  }, [searchQuery, filterSaleIncharge, filterOrderTerm, filterShipMode, suppliers]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageSuppliers = useMemo(() => {
    const safePage = Math.min(currentPage, totalPages);
    const start = (safePage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [currentPage, filtered, totalPages]);

  useEffect(() => {
    setCurrentPage(1);
    setActiveVendorCode(null);
    setExpandedVendorCode(null);
  }, [searchQuery, filterSaleIncharge, filterOrderTerm, filterShipMode]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const handleSelect = useCallback(
    (supplier: SupplierRow) => {
      onSelectSupplier({ code: supplier.vendorCode, name: supplier.name });
    },
    [onSelectSupplier],
  );

  const toggleExpanded = useCallback((supplier: SupplierRow) => {
    setActiveVendorCode(supplier.vendorCode);
    setExpandedVendorCode((prev) => (prev === supplier.vendorCode ? null : supplier.vendorCode));
  }, []);

  return (
    <div className="page-stack bulk-cost-supplier-page">
      <section className="panel supplier-search-panel">
        <div className="supplier-search-bar">
          <Search size={18} aria-hidden="true" />
          <input
            id="bulk-supplier-search"
            name="bulkSupplierSearch"
            type="text"
            placeholder="Search supplier name, quotation no., contact, currency, order term, ship mode…"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="supplier-search-input"
          />
          <button
            type="button"
            className="primary-button compact-btn"
            onClick={() => setShowManualDialog(true)}
            title="Create a new blank workspace for manual entry"
          >
            <Plus size={14} aria-hidden="true" />
            New Manual Quote
          </button>
        </div>

        <div className="supplier-filter-bar">
          <SlidersHorizontal size={15} aria-hidden="true" className="supplier-filter-bar-icon" />

          <label className="supplier-filter-select-wrap">
            <span>Sale Incharge</span>
            <select
              value={filterSaleIncharge}
              onChange={(e) => setFilterSaleIncharge(e.target.value)}
              className="supplier-filter-select"
            >
              <option value="">All</option>
              {saleInchargeOptions.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </label>

          <label className="supplier-filter-select-wrap">
            <span>Order Term</span>
            <select
              value={filterOrderTerm}
              onChange={(e) => setFilterOrderTerm(e.target.value)}
              className="supplier-filter-select"
            >
              <option value="">All</option>
              {orderTermOptions.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </label>

          <label className="supplier-filter-select-wrap">
            <span>Ship Mode</span>
            <select
              value={filterShipMode}
              onChange={(e) => setFilterShipMode(e.target.value)}
              className="supplier-filter-select"
            >
              <option value="">All</option>
              {shipModeOptions.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </label>

          {(filterSaleIncharge || filterOrderTerm || filterShipMode) && (
            <button
              type="button"
              className="supplier-filter-clear"
              onClick={() => { setFilterSaleIncharge(''); setFilterOrderTerm(''); setFilterShipMode(''); }}
            >
              Clear filters
            </button>
          )}

          <span className="supplier-filter-result-count">
            {filtered.length} / {suppliers.length} suppliers
          </span>
        </div>
      </section>

      <section className="panel bulk-cost-table-panel">
        {isQueueLoading ? (
          <div className="preview-empty">
            <Loader2 size={32} aria-hidden="true" className="animate-spin" />
            <p>Loading AXON queue…</p>
          </div>
        ) : suppliers.length === 0 ? (
          <div className="preview-empty">
            <Building2 size={32} aria-hidden="true" />
            <p>No pending AXON extractions.</p>
            <small>Use &ldquo;New Manual Quote&rdquo; to start a new blank workspace.</small>
          </div>
        ) : filtered.length === 0 ? (
          <div className="preview-empty">
            <Building2 size={32} aria-hidden="true" />
            <p>No suppliers found matching your search.</p>
            <small>Try a different keyword or filter.</small>
          </div>
        ) : (
          <>
            <div className="table-scroll supplier-table-scroll">
              <table
                className="prototype-table supplier-table"
                aria-label="Bulk cost supplier batches"
                data-resizable-table={tableSizing.tableId}
                style={{
                  ...tableSizing.tableStyle,
                  minWidth: expandedVendorCode ? `${SUPPLIER_DETAIL_DEFAULT_WIDTH}px` : undefined,
                }}
              >
                <colgroup>
                  {SUPPLIER_TABLE_COLUMNS.map((column) => (
                    <col key={column.key} style={tableSizing.getColumnStyle(column.key)} />
                  ))}
                </colgroup>
                <thead>
                  <tr>
                    {SUPPLIER_TABLE_COLUMNS.map((column) => (
                      <th className="resizable-table-header" key={column.key} {...tableSizing.getCellProps(column.key)}>
                        <span>{column.label}</span>
                        {tableSizing.renderResizeHandle(column.key)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pageSuppliers.map((supplier) => {
                    const rowKey = String(supplier.queueId);
                    const expanded = expandedVendorCode === supplier.vendorCode;
                    const itemPreviewRows = getSupplierItemPreviewRows(supplier);
                    return (
                      <Fragment key={rowKey}>
                        <tr
                          aria-label={`Open ${supplier.name} allocation`}
                          className={`supplier-select-row ${expanded ? 'supplier-select-row-expanded' : ''} ${activeVendorCode === supplier.vendorCode ? 'supplier-select-row-active' : ''}`}
                          key={rowKey}
                          onClick={() => setActiveVendorCode(supplier.vendorCode)}
                          onDoubleClick={() => handleSelect(supplier)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.preventDefault();
                              handleSelect(supplier);
                            }
                          }}
                          role="button"
                          tabIndex={0}
                        >
                          <td {...tableSizing.getCellProps('expand')} className="center-cell">
                            <button
                              type="button"
                              className="supplier-expand-button"
                              aria-expanded={expanded}
                              aria-label={`${expanded ? 'Collapse' : 'Expand'} item lines for ${supplier.name}`}
                              onClick={(event) => {
                                event.stopPropagation();
                                toggleExpanded(supplier);
                              }}
                              onDoubleClick={(event) => event.stopPropagation()}
                            >
                              {expanded ? <ChevronDown size={16} aria-hidden="true" /> : <ChevronRight size={16} aria-hidden="true" />}
                            </button>
                          </td>
                          <td {...tableSizing.getCellProps('quotationNo')} className="text-left-cell">{supplier.quotationNo || '-'}</td>
                          <td {...tableSizing.getCellProps('name')} className="text-left-cell">
                            <strong>{supplier.name}</strong>
                          </td>
                          <td {...tableSizing.getCellProps('itemCount')} className="center-cell">{supplier.itemCount.toLocaleString()}</td>
                          <td {...tableSizing.getCellProps('totalQty')} className="center-cell">{supplier.totalQty.toLocaleString()}</td>
                          <td {...tableSizing.getCellProps('totalAmount')} className="numeric-cell">{supplier.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                          <td {...tableSizing.getCellProps('currency')} className="center-cell">{supplier.currency}</td>
                          <td {...tableSizing.getCellProps('exchangeRate')} className="numeric-cell">{supplier.exchangeRate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          <td {...tableSizing.getCellProps('orderTerm')} className="center-cell">{supplier.orderTerm}</td>
                          <td {...tableSizing.getCellProps('paymentTerms')} className="center-cell">{supplier.paymentTerms}</td>
                          <td {...tableSizing.getCellProps('validityDays')} className="center-cell">{supplier.validityDays}</td>
                          <td {...tableSizing.getCellProps('termLocation')} className="center-cell">{supplier.termLocation}</td>
                          <td {...tableSizing.getCellProps('shipmentNote')} className="center-cell">{supplier.shipmentNote}</td>
                          <td {...tableSizing.getCellProps('saleIncharge')}>{supplier.saleIncharge}</td>
                          <td {...tableSizing.getCellProps('contactPerson')}>{supplier.contactPerson}</td>
                          <td {...tableSizing.getCellProps('updatedAt')} className="center-cell">{formatUpdatedAt(supplier.updatedAt)}</td>
                        </tr>
                        {expanded && (
                          <tr className="supplier-detail-row" key={`${rowKey}-detail`}>
                            <td colSpan={SUPPLIER_TABLE_COLUMNS.length}>
                              <SupplierItemPreview
                                lines={itemPreviewRows}
                                onSelectSupplier={() => handleSelect(supplier)}
                                supplier={supplier}
                              />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <TablePager
              currentPage={Math.min(currentPage, totalPages)}
              pageSize={PAGE_SIZE}
              totalItems={filtered.length}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </>
        )}
      </section>

      {showManualDialog && (
        <ManualQuoteDialog
          onClose={() => setShowManualDialog(false)}
          onOpen={(code, name) => {
            setShowManualDialog(false);
            onSelectSupplier({ code, name });
          }}
        />
      )}
    </div>
  );
}

function ManualQuoteDialog({
  onClose,
  onOpen,
}: {
  onClose: () => void;
  onOpen: (code: string, name: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<VendorLookupOption | null>(null);
  const [vendors, setVendors] = useState<VendorLookupOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    lookupApi.getTermVendors().then((data) => {
      setVendors(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return vendors.slice(0, 60);
    const starts: VendorLookupOption[] = [];
    const rest: VendorLookupOption[] = [];
    for (const v of vendors) {
      const code = v.cardCode.toLowerCase();
      const name = v.cardName.toLowerCase();
      if (code.startsWith(q) || name.startsWith(q)) starts.push(v);
      else if (name.includes(q)) rest.push(v);
    }
    return [...starts, ...rest].slice(0, 60);
  }, [query, vendors]);

  const handleSelect = useCallback((vendor: VendorLookupOption) => {
    setSelected(vendor);
    setQuery(`${vendor.cardCode} — ${vendor.cardName}`);
    setOpen(false);
  }, []);

  const handleOpen = useCallback(() => {
    if (!selected) return;
    onOpen(selected.cardCode, selected.cardName);
  }, [selected, onOpen]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    setSelected(null);
    setOpen(true);
  }, []);

  const handleInputFocus = useCallback(() => {
    if (!selected) setOpen(true);
  }, [selected]);

  const handleInputKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') { setOpen(false); return; }
    if (e.key === 'Enter') {
      if (filtered.length === 1) { handleSelect(filtered[0]); return; }
      if (selected) handleOpen();
    }
  }, [filtered, handleOpen, handleSelect, selected]);

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="manual-dialog-title"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal-panel">
        <div className="modal-header">
          <h3 id="manual-dialog-title">New Manual Quote</h3>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close">
            <X size={16} aria-hidden="true" />
          </button>
        </div>
        <p className="modal-desc">
          Select a supplier to open a blank workspace. You can add item lines manually inside.
        </p>

        <div className="modal-form">
          <label className="modal-field">
            <span>Supplier</span>
            <div className="vendor-combobox" onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
            }}>
              <div className="vendor-combobox-input-wrap">
                {loading
                  ? <Loader2 size={14} className="spin-icon vendor-combobox-icon" aria-hidden="true" />
                  : <Search size={14} className="vendor-combobox-icon" aria-hidden="true" />
                }
                <input
                  ref={inputRef}
                  id="manual-vendor-search"
                  name="manualVendorSearch"
                  type="text"
                  autoComplete="off"
                  className="vendor-combobox-input"
                  value={query}
                  placeholder={loading ? 'Loading suppliers…' : 'Type code or name to search…'}
                  disabled={loading}
                  onChange={handleInputChange}
                  onFocus={handleInputFocus}
                  onKeyDown={handleInputKeyDown}
                  aria-autocomplete="list"
                  aria-expanded={open}
                  aria-controls="vendor-combobox-list"
                />
                {query && (
                  <button
                    type="button"
                    className="vendor-combobox-clear"
                    tabIndex={-1}
                    onClick={() => { setQuery(''); setSelected(null); setOpen(false); inputRef.current?.focus(); }}
                    aria-label="Clear"
                  >
                    <X size={12} aria-hidden="true" />
                  </button>
                )}
              </div>

              {open && filtered.length > 0 && (
                <ul
                  ref={listRef}
                  id="vendor-combobox-list"
                  className="vendor-combobox-list"
                  role="listbox"
                >
                  {filtered.map((v) => (
                    <li
                      key={v.cardCode}
                      className={`vendor-combobox-option${selected?.cardCode === v.cardCode ? ' selected' : ''}`}
                      role="option"
                      aria-selected={selected?.cardCode === v.cardCode}
                      onMouseDown={(e) => { e.preventDefault(); handleSelect(v); }}
                    >
                      <span className="vendor-code">{v.cardCode}</span>
                      <span className="vendor-name">{v.cardName}</span>
                    </li>
                  ))}
                </ul>
              )}
              {open && !loading && filtered.length === 0 && (
                <div className="vendor-combobox-empty">No suppliers found</div>
              )}
            </div>
          </label>
        </div>

        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="primary-button"
            disabled={!selected}
            onClick={handleOpen}
          >
            Open Workspace
          </button>
        </div>
      </div>
    </div>
  );
}

function SupplierItemPreview({
  lines,
  onSelectSupplier,
  supplier,
}: {
  lines: AllocationLineSource[];
  onSelectSupplier: () => void;
  supplier: SupplierRow;
}) {
  const showingAll = lines.length >= supplier.itemCount;
  const detailSizing = useResizableTableColumns(`bulk-cost-supplier-detail-${supplier.vendorCode}`, SUPPLIER_DETAIL_TABLE_COLUMNS);

  return (
    <div className="supplier-detail-panel">
      <div className="supplier-detail-header">
        <div>
          <strong>Item Lines</strong>
          <span>
            {showingAll
              ? `${lines.length.toLocaleString()} records`
              : `Showing ${lines.length.toLocaleString()} of ${supplier.itemCount.toLocaleString()} records`}
          </span>
        </div>
        <button type="button" className="primary-button compact-btn" onClick={onSelectSupplier}>
          Open Allocation →
        </button>
      </div>

      <div className="supplier-detail-table-scroll">
        <table
          className="prototype-table supplier-detail-table"
          aria-label={`Item lines for ${supplier.name}`}
          data-resizable-table={detailSizing.tableId}
          style={detailSizing.tableStyle}
        >
          <colgroup>
            {SUPPLIER_DETAIL_TABLE_COLUMNS.map((column) => (
              <col key={column.key} style={detailSizing.getColumnStyle(column.key)} />
            ))}
          </colgroup>
          <thead>
            <tr>
              {SUPPLIER_DETAIL_TABLE_COLUMNS.map((column) => (
                <th className="resizable-table-header" key={column.key} {...detailSizing.getCellProps(column.key)}>
                  <span>{column.label}</span>
                  {detailSizing.renderResizeHandle(column.key)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr key={line.lineKey}>
                <td {...detailSizing.getCellProps('no')} className="center-cell">{line.no}</td>
                <td {...detailSizing.getCellProps('description')} className="text-left-cell supplier-detail-description">{line.sapDescription}</td>
                <td {...detailSizing.getCellProps('manufacturer')}>{line.manufacturer}</td>
                <td {...detailSizing.getCellProps('mfgPartNumber')}>{line.mfgPartNumber}</td>
                <td {...detailSizing.getCellProps('supplierOrderCode')} className="text-left-cell">{line.supplierOrderCode}</td>
                <td {...detailSizing.getCellProps('qty')} className="center-cell">{line.qty.toLocaleString()}</td>
                <td {...detailSizing.getCellProps('uom')} className="center-cell">
                  <span className="uom-cell">
                    {line.uom}
                    {line.uom !== line.purchaseUOM && (
                      <AlertTriangle size={13} className="uom-mismatch-icon" aria-label={`UOM mismatch: purchase UOM is ${line.purchaseUOM}`} />
                    )}
                  </span>
                </td>
                <td {...detailSizing.getCellProps('unitPrice')} className="numeric-cell">{formatAmount(line.unitPrice)}</td>
                <td {...detailSizing.getCellProps('totalCost')} className="numeric-cell">{formatAmount(line.amount)}</td>
                <td {...detailSizing.getCellProps('moq')} className="center-cell">{line.moq?.toLocaleString() ?? '-'}</td>
                <td {...detailSizing.getCellProps('leadTime')} className="center-cell">{line.deliveryLeadTime || '-'}</td>
                <td {...detailSizing.getCellProps('matchStatus')} className="center-cell">{formatMatchStatus(line.itemCode)}</td>
                <td {...detailSizing.getCellProps('importPermit')} className="center-cell">{formatYesNo(line.importPermit)}</td>
                <td {...detailSizing.getCellProps('shelfLifeRequire')} className="center-cell">{line.shelfLifeRequire ? formatYesNo(line.shelfLifeRequire) : 'No'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TablePager({
  currentPage,
  pageSize,
  totalItems,
  totalPages,
  onPageChange,
}: {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  const start = totalItems > 0 ? (currentPage - 1) * pageSize + 1 : 0;
  const end = Math.min(currentPage * pageSize, totalItems);
  const pageButtons = makePageButtons(currentPage, totalPages);

  return (
    <div className="bulk-table-pager">
      <span className="bulk-table-page-info">
        {totalItems > 0 ? `Showing ${start}-${end} of ${totalItems} records` : 'No records'}
      </span>
      <div className="bulk-table-page-buttons">
        <button
          type="button"
          className="bulk-page-button bulk-page-nav"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
        >
          Prev
        </button>
        {pageButtons.map((page, index) => (
          typeof page === 'string' ? (
            <span className="bulk-page-ellipsis" key={`${page}-${index}`}>...</span>
          ) : (
            <button
              type="button"
              className={`bulk-page-button ${page === currentPage ? 'bulk-page-active' : ''}`}
              key={page}
              onClick={() => onPageChange(page)}
            >
              {page}
            </button>
          )
        ))}
        <button
          type="button"
          className="bulk-page-button bulk-page-nav"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
        >
          Next
        </button>
      </div>
      <span className="bulk-table-page-size">{pageSize} per page</span>
    </div>
  );
}

function makePageButtons(currentPage: number, totalPages: number): Array<number | string> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages: Array<number | string> = [1];
  if (currentPage > 3) pages.push('start-ellipsis');
  for (let page = Math.max(2, currentPage - 1); page <= Math.min(totalPages - 1, currentPage + 1); page += 1) {
    pages.push(page);
  }
  if (currentPage < totalPages - 2) pages.push('end-ellipsis');
  pages.push(totalPages);
  return pages;
}
