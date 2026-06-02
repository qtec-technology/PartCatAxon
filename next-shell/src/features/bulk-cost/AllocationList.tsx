'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Archive, ClipboardList, FileCheck2, Loader2, RefreshCw, Search, Send, Trophy, XCircle } from 'lucide-react';
import { listBulkCostRuns } from './bulk-cost.api';
import type { AllocationRunStatus, BulkCostRunSummary } from './bulk-cost.types';
import { useResizableTableColumns } from './useResizableTableColumns';
import type { ResizableTableColumn } from './useResizableTableColumns';

const ALLOCATION_TABLE_COLUMNS: ResizableTableColumn[] = [
  { key: 'runId',       defaultWidth: 92,  minWidth: 72 },
  { key: 'referenceNo', defaultWidth: 160, minWidth: 80 },
  { key: 'supplier',    defaultWidth: 220, minWidth: 100 },
  { key: 'vendorCode',  defaultWidth: 100, minWidth: 60 },
  { key: 'lines',       defaultWidth: 60,  minWidth: 50 },
  { key: 'amount',      defaultWidth: 130, minWidth: 80 },
  { key: 'currency',    defaultWidth: 80,  minWidth: 60 },
  { key: 'updatedAt',   defaultWidth: 160, minWidth: 120 },
  { key: 'updatedBy',   defaultWidth: 120, minWidth: 80 },
  { key: 'status',      defaultWidth: 170, minWidth: 150 },
  { key: 'action',      defaultWidth: 80,  minWidth: 70 },
];

const COL_LABELS: Record<string, string> = {
  runId: 'Run / Rev', referenceNo: 'Chain ID', supplier: 'Supplier', vendorCode: 'Code', lines: 'Lines',
  amount: 'Total Amount', currency: 'Currency', updatedAt: 'Updated Date',
  updatedBy: 'Updated By', status: 'Status', action: '',
};

type WorkspaceRunSummaryCard = {
  label: string;
  description: string;
  value: number;
  status?: AllocationRunStatus;
};

const PAGE_SIZE = 400;

function formatNumber(n: number, decimals = 2): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const day = String(d.getDate()).padStart(2, '0');
  const month = d.toLocaleString('en-US', { month: 'short' });
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  return `${day}-${month}-${year} ${hours}:${minutes}:${seconds}`;
}

interface AllocationListProps {
  onOpen: (run: BulkCostRunSummary) => void;
}

export function AllocationList({ onOpen }: AllocationListProps) {
  const tableSizing = useResizableTableColumns('allocation-list', ALLOCATION_TABLE_COLUMNS);

  const [runs, setRuns] = useState<BulkCostRunSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalRuns, setTotalRuns] = useState(0);
  const [statusFilter, setStatusFilter] = useState<AllocationRunStatus | undefined>(undefined);
  const [saleInchargeFilter, setSaleInchargeFilter] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isInitialLoading = isLoading && runs.length === 0;
  const isRefreshing = isLoading && runs.length > 0;

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setCurrentPage(1);
      setDebouncedSearch(value);
    }, 300);
  }, []);

  const fetchRuns = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await listBulkCostRuns({
        status: statusFilter,
        search: debouncedSearch || undefined,
        saleIncharge: saleInchargeFilter || undefined,
        page: currentPage,
        pageSize: PAGE_SIZE,
      });
      setRuns(result.runs);
      setTotalRuns(result.total);
    } catch {
      setError('Failed to load workspace runs. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, debouncedSearch, saleInchargeFilter, currentPage]);

  useEffect(() => {
    void fetchRuns();
  }, [fetchRuns]);

  const counts = runs.reduce<Record<string, number>>((acc, run) => {
    acc[run.status] = (acc[run.status] ?? 0) + 1;
    return acc;
  }, {});

  const summaryCards: WorkspaceRunSummaryCard[] = [
    {
      label: 'All Runs',
      description: 'งานทั้งหมด',
      value: totalRuns,
      status: undefined,
    },
    {
      label: 'Drafts',
      description: 'งานที่ยังเป็นแบบร่าง',
      value: counts.DRAFT ?? 0,
      status: 'DRAFT',
    },
    {
      label: 'Quoted',
      description: 'ส่งราคาแล้ว',
      value: counts.QUOTED ?? 0,
      status: 'QUOTED',
    },
    {
      label: 'Sales Won',
      description: 'ลูกค้าตกลง / งานขายชนะ',
      value: counts.AWARDED ?? 0,
      status: 'AWARDED',
    },
    {
      label: 'Sales Lost',
      description: 'ลูกค้าไม่ซื้อ / งานขายแพ้',
      value: counts.LOST ?? 0,
      status: 'LOST',
    },
  ];

  const saleInchargeOptions = useMemo(() => {
    const seen = new Set<string>();
    const options: string[] = [];
    for (const run of runs) {
      if (run.saleIncharge && !seen.has(run.saleIncharge)) {
        seen.add(run.saleIncharge);
        options.push(run.saleIncharge);
      }
    }
    return options.sort();
  }, [runs]);

  const totalPages = Math.max(1, Math.ceil(totalRuns / PAGE_SIZE));

  const handleFilterChange = useCallback((value: AllocationRunStatus | undefined) => {
    setStatusFilter(value);
    setCurrentPage(1);
  }, []);

  return (
    <div className="page-stack bulk-cost-supplier-page">
      {/* Search & filter panel */}
      <section className="panel supplier-search-panel">
        <div className="workspace-run-summary-grid" aria-label="Workspace run status summary">
          {summaryCards.map((card) => {
            const isActive = statusFilter === card.status;
            const summaryKey = card.status ?? 'ALL';
            return (
              <button
                key={summaryKey}
                type="button"
                className={`workspace-run-summary-card workspace-run-summary-card--${summaryKey.toLowerCase()}${isActive ? ' workspace-run-summary-card--active' : ''}`}
                onClick={() => handleFilterChange(card.status)}
                aria-pressed={isActive}
              >
                <span className="workspace-run-summary-copy">
                  <strong>{card.label}</strong>
                  <small>{card.description}</small>
                </span>
                <span className="workspace-run-summary-value">{isInitialLoading ? '…' : card.value}</span>
              </button>
            );
          })}
        </div>

        <div className="workspace-run-control-row">
          <div className="supplier-search-bar workspace-run-search-bar">
            <Search size={18} aria-hidden="true" />
            <input
              type="text"
              placeholder="Search supplier name, reference no., run #…"
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="supplier-search-input"
            />
          </div>

          <label className="supplier-filter-select-wrap workspace-run-owner-filter">
            <span>ผู้รับผิดชอบ</span>
            <select
              className="supplier-filter-select"
              value={saleInchargeFilter}
              onMouseDownCapture={(e) => {
                const el = e.currentTarget;
                if (typeof window === 'undefined') return;
                const rect = el.getBoundingClientRect();
                const vSpace = window.innerHeight - rect.bottom;
                if (vSpace < 260) window.scrollBy({ top: 260 - vSpace + 8, behavior: 'auto' });
              }}
              onChange={(e) => { setSaleInchargeFilter(e.target.value); setCurrentPage(1); }}
            >
              <option value="">ทั้งหมด</option>
              {saleInchargeOptions.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </label>

          <button
            type="button"
            className="secondary-button compact-btn"
            onClick={() => void fetchRuns()}
            title="Refresh list"
          >
            <RefreshCw size={14} aria-hidden="true" />
            Refresh
          </button>

          <span className="supplier-filter-result-count workspace-run-result-count">
            {!isInitialLoading && `${totalRuns} workspace run${totalRuns !== 1 ? 's' : ''}`}
          </span>
        </div>
      </section>

      {/* Table panel */}
      <section className="panel bulk-cost-table-panel" style={{ position: 'relative' }}>
        {/* Refresh overlay — keeps data visible but shows loading indicator */}
        {isRefreshing && (
          <div className="allocation-refresh-overlay" aria-hidden="true">
            <Loader2 size={18} className="allocation-refresh-spinner" />
          </div>
        )}

        {error ? (
          <div className="preview-empty">
            <XCircle size={28} aria-hidden="true" style={{ color: 'var(--pc-red)' }} />
            <p>{error}</p>
          </div>
        ) : !isInitialLoading && runs.length === 0 ? (
          <div className="preview-empty">
            <ClipboardList size={32} aria-hidden="true" />
            <p>No workspace runs found.</p>
            <small>Try a different search or filter, or create a new manual workspace.</small>
          </div>
        ) : (
          <>
            <div className="table-scroll supplier-table-scroll allocation-list-scroll">
              <table
                className="prototype-table allocation-list-table"
                style={tableSizing.tableStyle}
                data-resizable-table={tableSizing.tableId}
                aria-label="Cost workspace runs"
              >
                <colgroup>
                  {ALLOCATION_TABLE_COLUMNS.map((col) => (
                    <col key={col.key} style={tableSizing.getColumnStyle(col.key)} />
                  ))}
                </colgroup>
                <thead>
                  <tr>
                    {ALLOCATION_TABLE_COLUMNS.map((col) => (
                      <th key={col.key} className="resizable-table-header" {...tableSizing.getCellProps(col.key)}>
                        <span>{COL_LABELS[col.key]}</span>
                        {tableSizing.renderResizeHandle(col.key)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {isInitialLoading
                    ? Array.from({ length: 6 }).map((_, i) => (
                        <tr key={i} className="allocation-list-skeleton-row">
                          {ALLOCATION_TABLE_COLUMNS.map((col) => (
                            <td key={col.key}><span className="allocation-list-skeleton" /></td>
                          ))}
                        </tr>
                      ))
                    : runs.map((run) => (
                        <tr key={run.runId} className="supplier-select-row" onDoubleClick={() => onOpen(run)}>
                          <td className="center-cell allocation-list-run-id" {...tableSizing.getCellProps('runId')}>
                            #{run.runId} / R{run.revisionNo}
                          </td>
                          <td className="text-left-cell" {...tableSizing.getCellProps('referenceNo')}>
                            {run.referenceNo || <span style={{ color: 'var(--pc-muted)' }}>—</span>}
                          </td>
                          <td className="text-left-cell" {...tableSizing.getCellProps('supplier')}>{run.vendorName || run.vendorCode}</td>
                          <td className="text-left-cell allocation-list-vendor-code-cell" {...tableSizing.getCellProps('vendorCode')}>{run.vendorCode}</td>
                          <td className="center-cell" {...tableSizing.getCellProps('lines')}>{run.totalLines}</td>
                          <td className="numeric-cell" {...tableSizing.getCellProps('amount')}>{formatNumber(run.totalAmount)}</td>
                          <td className="center-cell" {...tableSizing.getCellProps('currency')}>{run.currency}</td>
                          <td className="center-cell" {...tableSizing.getCellProps('updatedAt')}>{formatDate(run.updatedAt)}</td>
                          <td className="center-cell" {...tableSizing.getCellProps('updatedBy')}>{run.updatedBy}</td>
                          <td className="center-cell" {...tableSizing.getCellProps('status')}>
                            <RunStatusBadge status={run.status} />
                          </td>
                          <td className="center-cell" {...tableSizing.getCellProps('action')}>
                            <button
                              type="button"
                              className="primary-button compact-btn"
                              onClick={() => onOpen(run)}
                            >
                              Open
                            </button>
                          </td>
                        </tr>
                      ))
                  }
                </tbody>
              </table>
            </div>

            <TablePager
              currentPage={Math.min(currentPage, totalPages)}
              pageSize={PAGE_SIZE}
              totalItems={totalRuns}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </>
        )}
      </section>
    </div>
  );
}

function RunStatusBadge({ status }: { status: AllocationRunStatus }) {
  if (status === 'QUOTED') {
    return (
      <span className="run-status-badge run-status-badge--quoted">
        <FileCheck2 size={12} aria-hidden="true" />
        Quoted
      </span>
    );
  }
  if (status === 'AWARDED') {
    return (
      <span className="run-status-badge run-status-badge--awarded">
        <Trophy size={12} aria-hidden="true" />
        Sales Won
      </span>
    );
  }
  if (status === 'LOST') {
    return (
      <span className="run-status-badge run-status-badge--lost">
        <XCircle size={12} aria-hidden="true" />
        Sales Lost
      </span>
    );
  }
  if (status === 'REVERSE_MAPPED') {
    return (
      <span className="run-status-badge run-status-badge--mapped">
        <Send size={12} aria-hidden="true" />
        Sent to PartCatalog
      </span>
    );
  }
  if (status === 'ARCHIVED') {
    return (
      <span className="run-status-badge run-status-badge--archived">
        <Archive size={12} aria-hidden="true" />
        Archived
      </span>
    );
  }
  return (
    <span className="run-status-badge run-status-badge--draft">
      <ClipboardList size={12} aria-hidden="true" />
      Draft
    </span>
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
        {pageButtons.map((page, index) =>
          typeof page === 'string' ? (
            <span className="bulk-page-ellipsis" key={`ellipsis-${index}`}>…</span>
          ) : (
            <button
              type="button"
              className={`bulk-page-button${page === currentPage ? ' bulk-page-active' : ''}`}
              key={page}
              onClick={() => onPageChange(page)}
            >
              {page}
            </button>
          )
        )}
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
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const pages: Array<number | string> = [1];
  if (currentPage > 3) pages.push('start-ellipsis');
  for (let p = Math.max(2, currentPage - 1); p <= Math.min(totalPages - 1, currentPage + 1); p++) {
    pages.push(p);
  }
  if (currentPage < totalPages - 2) pages.push('end-ellipsis');
  pages.push(totalPages);
  return pages;
}
