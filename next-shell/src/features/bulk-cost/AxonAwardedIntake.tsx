'use client';

import { useMemo, useState, useEffect, Fragment } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Edit3,
  ExternalLink,
  Info,
  Layers,
  Loader2,
  Play,
  RefreshCw,
  Search,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { useResizableTableColumns } from './useResizableTableColumns';
import type { ResizableTableColumn } from './useResizableTableColumns';

interface AxonLine {
  axonLineId: string;
  supplier: string;
  brand: string;
  mfrCatalogNo: string;
  description: string;
  qty: number;
  unitPrice: number;
  currency: string;
  costMark: 'LINE_TOTAL' | 'HEADER_TOTAL';
}

interface SupplierGroupInfo {
  name: string;
  code: string;
  itemsCount: number;
  currency: string;
}

interface AxonProject {
  chainId: string;
  customerName: string;
  rfqNo: string;
  subject: string;
  updatedAt: string;
  saleIncharge: string;
  status: 'NEW' | 'IN_PROGRESS' | 'COMPLETED';
  suppliers: SupplierGroupInfo[];
  lines: AxonLine[];
}

const PAGE_SIZE = 400;

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

const AXON_INBOX_TABLE_COLUMNS: ResizableTableColumn[] = [
  { key: 'chainId',        defaultWidth: 130, minWidth: 90 },
  { key: 'customerName',   defaultWidth: 200, minWidth: 100 },
  { key: 'subject',        defaultWidth: 280, minWidth: 150 },
  { key: 'suppliers',      defaultWidth: 220, minWidth: 120 },
  { key: 'linesCount',     defaultWidth: 90,  minWidth: 70 },
  { key: 'updatedAt',      defaultWidth: 160, minWidth: 120 },
  { key: 'saleIncharge',   defaultWidth: 120, minWidth: 80 },
  { key: 'status',         defaultWidth: 150, minWidth: 100 },
  { key: 'action',         defaultWidth: 80,  minWidth: 70 },
];

const COL_LABELS: Record<string, string> = {
  chainId: 'Chain ID (AIX)',
  customerName: 'Customer Name',
  subject: 'Comparison Subject',
  suppliers: 'Awarded Suppliers',
  linesCount: 'Total Items',
  updatedAt: 'Updated Date',
  saleIncharge: 'Sale Incharge',
  status: 'Import Status',
  action: '',
};

const AXON_PARENT_SUPPLIER_COLUMNS: ResizableTableColumn[] = [
  { key: 'expand',     defaultWidth: 45,  minWidth: 45, maxWidth: 45 },
  { key: 'select',     defaultWidth: 50,  minWidth: 50, maxWidth: 50 },
  { key: 'supplier',   defaultWidth: 280, minWidth: 150 },
  { key: 'items',      defaultWidth: 150, minWidth: 100 },
  { key: 'currency',   defaultWidth: 120, minWidth: 80 },
  { key: 'amount',     defaultWidth: 180, minWidth: 120 },
  { key: 'action',     defaultWidth: 160, minWidth: 120 },
];

const PARENT_COL_LABELS: Record<string, string> = {
  expand: '',
  select: 'Select',
  supplier: 'Supplier Name & Code',
  items: 'Awarded Items',
  currency: 'Currency',
  amount: 'Import Amount',
  action: 'Action',
};

const AXON_CHILD_ITEMS_COLUMNS: ResizableTableColumn[] = [
  { key: 'select',       defaultWidth: 50,  minWidth: 45, maxWidth: 50 },
  { key: 'axonLineId',   defaultWidth: 140, minWidth: 100 },
  { key: 'brand',        defaultWidth: 120, minWidth: 80 },
  { key: 'mfrCatalogNo', defaultWidth: 150, minWidth: 100 },
  { key: 'description',  defaultWidth: 320, minWidth: 150 },
  { key: 'qty',          defaultWidth: 80,  minWidth: 60 },
  { key: 'unitPrice',    defaultWidth: 110, minWidth: 80 },
  { key: 'currency',     defaultWidth: 90,  minWidth: 70 },
  { key: 'costMark',     defaultWidth: 150, minWidth: 100 },
];

const CHILD_COL_LABELS: Record<string, string> = {
  select: 'Select',
  axonLineId: 'AXON Line ID',
  brand: 'Brand',
  mfrCatalogNo: 'Mfg Catalog No',
  description: 'Description',
  qty: 'Qty',
  unitPrice: 'Unit Price',
  currency: 'Currency',
  costMark: 'Cost Mark',
};

const AXON_INBOX_PROJECTS: AxonProject[] = [
  {
    chainId: 'AIX-2026-001',
    customerName: 'Western Digital Thailand',
    rfqNo: 'RFQ-WD-2026-0428',
    subject: 'Western Digital Grade-A Socket Adapters',
    updatedAt: '2026-05-28T09:12:00',
    saleIncharge: 'Anucha S.',
    status: 'NEW',
    suppliers: [
      { name: 'Grainger', code: 'V-GRA-001', itemsCount: 2, currency: 'USD' },
      { name: 'McMaster-Carr', code: 'V-MCM-EXW-COUR', itemsCount: 1, currency: 'USD' },
    ],
    lines: [
      {
        axonLineId: 'AXON-L001',
        supplier: 'Grainger',
        brand: 'PROTO',
        mfrCatalogNo: 'PROTO-ADP-038',
        description: 'PROTO Socket Adapter: 3/8 in Output Drive Size, Square, 1 3/8 in Overall Lg, Chrome',
        qty: 10,
        unitPrice: 9.02,
        currency: 'USD',
        costMark: 'LINE_TOTAL',
      },
      {
        axonLineId: 'AXON-L002',
        supplier: 'Grainger',
        brand: 'PROTO',
        mfrCatalogNo: 'PROTO-ADP-012',
        description: 'PROTO Socket Adapter: 1/2 in Output Drive Size, Square, 1 7/16 in Overall Lg, Chrome',
        qty: 25,
        unitPrice: 7.30,
        currency: 'USD',
        costMark: 'HEADER_TOTAL',
      },
      {
        axonLineId: 'AXON-L003',
        supplier: 'McMaster-Carr',
        brand: 'MCMASTER-CARR',
        mfrCatalogNo: '91257A624',
        description: 'Stainless steel hex head cap screw, 1/2-13 thread, pack of 100',
        qty: 5,
        unitPrice: 42.80,
        currency: 'USD',
        costMark: 'LINE_TOTAL',
      },
    ],
  },
  {
    chainId: 'AIX-2026-002',
    customerName: 'Thai Beverage Plc.',
    rfqNo: 'RFQ-TB-2026-0514',
    subject: 'ThaiBev Pneumatic & Hydraulic Valve Upgrades',
    updatedAt: '2026-05-26T14:45:00',
    saleIncharge: 'Somchai K.',
    status: 'IN_PROGRESS',
    suppliers: [
      { name: 'SMC Corporation', code: 'V-SMC-FOB-AIR', itemsCount: 3, currency: 'JPY' },
      { name: 'Parker China', code: 'V-PARKER-CN-SEA', itemsCount: 2, currency: 'CNY' },
    ],
    lines: [
      {
        axonLineId: 'AXON-L101',
        supplier: 'SMC Corporation',
        brand: 'SMC',
        mfrCatalogNo: 'CDQ2B40-100DMZ',
        description: 'SMC compact cylinder, 40 mm bore, 100 mm stroke',
        qty: 4,
        unitPrice: 13800,
        currency: 'JPY',
        costMark: 'LINE_TOTAL',
      },
      {
        axonLineId: 'AXON-L102',
        supplier: 'SMC Corporation',
        brand: 'SMC',
        mfrCatalogNo: 'SY5120-5DZ-01',
        description: 'SMC solenoid valve, 5 port, 24 VDC',
        qty: 8,
        unitPrice: 4200,
        currency: 'JPY',
        costMark: 'HEADER_TOTAL',
      },
      {
        axonLineId: 'AXON-L103',
        supplier: 'SMC Corporation',
        brand: 'SMC',
        mfrCatalogNo: 'AW30-F03E-B',
        description: 'SMC air filter regulator with gauge',
        qty: 3,
        unitPrice: 6700,
        currency: 'JPY',
        costMark: 'LINE_TOTAL',
      },
      {
        axonLineId: 'AXON-L104',
        supplier: 'Parker China',
        brand: 'PARKER',
        mfrCatalogNo: '937859Q',
        description: 'Parker hydraulic filter element, 10 micron',
        qty: 12,
        unitPrice: 260,
        currency: 'CNY',
        costMark: 'LINE_TOTAL',
      },
      {
        axonLineId: 'AXON-L105',
        supplier: 'Parker China',
        brand: 'PARKER',
        mfrCatalogNo: 'BVL-16',
        description: 'Parker brass ball valve, full port, 1 inch',
        qty: 10,
        unitPrice: 95,
        currency: 'CNY',
        costMark: 'LINE_TOTAL',
      },
    ],
  },
  {
    chainId: 'AIX-2026-003',
    customerName: 'PTT Global Chemical',
    rfqNo: 'RFQ-PTT-2026-0520',
    subject: 'PTTGC Electrical Equipment Replacements',
    updatedAt: '2026-05-20T10:30:00',
    saleIncharge: 'Nattaporn P.',
    status: 'COMPLETED',
    suppliers: [
      { name: 'RS Components', code: 'V-RSC-FCA-TRUCK', itemsCount: 3, currency: 'GBP' },
    ],
    lines: [
      {
        axonLineId: 'AXON-L201',
        supplier: 'RS Components',
        brand: 'RS PRO',
        mfrCatalogNo: '125-3070',
        description: 'RS PRO VDE diagonal cutter, 160 mm',
        qty: 6,
        unitPrice: 18.40,
        currency: 'GBP',
        costMark: 'LINE_TOTAL',
      },
      {
        axonLineId: 'AXON-L202',
        supplier: 'RS Components',
        brand: 'RS PRO',
        mfrCatalogNo: '501-752',
        description: 'RS PRO DIN rail terminal block, 2.5 mm2, grey',
        qty: 50,
        unitPrice: 0.86,
        currency: 'GBP',
        costMark: 'LINE_TOTAL',
      },
      {
        axonLineId: 'AXON-L203',
        supplier: 'RS Components',
        brand: 'RS PRO',
        mfrCatalogNo: '123-8778',
        description: 'RS PRO handheld tachometer with certificate',
        qty: 1,
        unitPrice: 142.00,
        currency: 'GBP',
        costMark: 'LINE_TOTAL',
      },
    ],
  },
];

interface AxonAwardedIntakeProps {
  onImportSupplier?: (vendor: { code: string; name: string }) => void;
}

export function AxonAwardedIntake({ onImportSupplier }: AxonAwardedIntakeProps) {
  const [selectedProject, setSelectedProject] = useState<AxonProject | null>(null);
  const tableSizing = useResizableTableColumns('axon-inbound-inbox', AXON_INBOX_TABLE_COLUMNS);
  const parentSizing = useResizableTableColumns('axon-parent-suppliers', AXON_PARENT_SUPPLIER_COLUMNS);
  const childSizing = useResizableTableColumns('axon-child-items', AXON_CHILD_ITEMS_COLUMNS);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'NEW' | 'IN_PROGRESS' | 'COMPLETED'>('ALL');
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter]);

  // Calculate counts dynamically from AXON_INBOX_PROJECTS
  const counts = useMemo(() => {
    return AXON_INBOX_PROJECTS.reduce<Record<string, number>>((acc, p) => {
      acc[p.status] = (acc[p.status] ?? 0) + 1;
      return acc;
    }, {});
  }, []);

  const summaryCards = useMemo(() => {
    return [
      {
        label: 'All Projects',
        description: 'โครงการนำเข้าทั้งหมด',
        value: AXON_INBOX_PROJECTS.length,
        status: 'ALL' as const,
      },
      {
        label: 'New Comparisons',
        description: 'โครงการมาใหม่',
        value: counts.NEW ?? 0,
        status: 'NEW' as const,
      },
      {
        label: 'In Progress',
        description: 'กำลังปันส่วนต้นทุน',
        value: counts.IN_PROGRESS ?? 0,
        status: 'IN_PROGRESS' as const,
      },
      {
        label: 'Completed',
        description: 'นำเข้าสำเร็จแล้ว',
        value: counts.COMPLETED ?? 0,
        status: 'COMPLETED' as const,
      },
    ];
  }, [counts]);

  // Simulator State Machine
  const [simulationState, setSimulationState] = useState<'idle' | 'connecting' | 'fetching' | 'success'>('idle');
  const [simulatingSupplier, setSimulatingSupplier] = useState<SupplierGroupInfo | null>(null);
  const [simulationProgress, setSimulationProgress] = useState(0);

  // Line selection states within selected project
  const [selectedLineIds, setSelectedLineIds] = useState<Record<string, boolean>>({});
  // Supplier expansion states
  const [expandedSuppliers, setExpandedSuppliers] = useState<Record<string, boolean>>({});

  // Reset lines selection and expand all suppliers by default when project changes
  useEffect(() => {
    if (selectedProject) {
      const initial: Record<string, boolean> = {};
      selectedProject.lines.forEach((line) => {
        initial[line.axonLineId] = true; // default select all
      });
      setSelectedLineIds(initial);

      const exp: Record<string, boolean> = {};
      selectedProject.suppliers.forEach((s) => {
        exp[s.name] = true;
      });
      setExpandedSuppliers(exp);
    }
  }, [selectedProject]);

  const toggleSupplierExpand = (suppName: string) => {
    setExpandedSuppliers((prev) => ({
      ...prev,
      [suppName]: !prev[suppName],
    }));
  };

  // Simulator timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (simulationState === 'connecting') {
      interval = setInterval(() => {
        setSimulationProgress((p) => {
          if (p >= 40) {
            clearInterval(interval);
            setSimulationState('fetching');
            return 40;
          }
          return p + 10;
        });
      }, 300);
    } else if (simulationState === 'fetching') {
      interval = setInterval(() => {
        setSimulationProgress((p) => {
          if (p >= 90) {
            clearInterval(interval);
            setSimulationState('success');
            return 100;
          }
          return p + 15;
        });
      }, 400);
    } else if (simulationState === 'success') {
      const timeout = setTimeout(() => {
        if (onImportSupplier && simulatingSupplier) {
          toast.success(`นำเข้าออเดอร์ของซัพพลายเออร์ ${simulatingSupplier.name} เรียบร้อยแล้ว!`, {
            description: 'ระบบกำลังนำทางท่านไปยังบอร์ดการแบ่งปันต้นทุนหลัก...',
          });
          onImportSupplier({ code: simulatingSupplier.code, name: simulatingSupplier.name });
        }
        setSimulationState('idle');
        setSimulatingSupplier(null);
        setSimulationProgress(0);
      }, 1000);
      return () => clearTimeout(timeout);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [simulationState, simulatingSupplier, onImportSupplier]);

  const handleStartSimulation = (supplier: SupplierGroupInfo) => {
    setSimulatingSupplier(supplier);
    setSimulationState('connecting');
    setSimulationProgress(0);
  };

  // Filter inbox list
  const filteredProjects = useMemo(() => {
    return AXON_INBOX_PROJECTS.filter((p) => {
      const matchSearch =
        p.chainId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.subject.toLowerCase().includes(searchQuery.toLowerCase());

      const matchStatus =
        statusFilter === 'ALL' || p.status === statusFilter;

      return matchSearch && matchStatus;
    });
  }, [searchQuery, statusFilter]);

  const totalItems = filteredProjects.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));

  const paginatedProjects = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    return filteredProjects.slice(startIndex, startIndex + PAGE_SIZE);
  }, [filteredProjects, currentPage]);

  // Group lines by supplier inside selected project
  const linesBySupplier = useMemo(() => {
    if (!selectedProject) return {};
    const groups: Record<string, AxonLine[]> = {};
    selectedProject.lines.forEach((line) => {
      if (!groups[line.supplier]) {
        groups[line.supplier] = [];
      }
      groups[line.supplier].push(line);
    });
    return groups;
  }, [selectedProject]);

  // Supplier-specific counts and totals inside selected project
  const supplierAggregates = useMemo(() => {
    if (!selectedProject) return {};
    const aggregates: Record<string, { totalQty: number; totalAmount: number; selectedCount: number }> = {};

    Object.entries(linesBySupplier).forEach(([suppName, lines]) => {
      let qty = 0;
      let amount = 0;
      let selected = 0;
      lines.forEach((l) => {
        qty += l.qty;
        amount += l.qty * l.unitPrice;
        if (selectedLineIds[l.axonLineId]) {
          selected += 1;
        }
      });
      aggregates[suppName] = { totalQty: qty, totalAmount: amount, selectedCount: selected };
    });

    return aggregates;
  }, [selectedProject, linesBySupplier, selectedLineIds]);

  const toggleLine = (lineId: string) => {
    setSelectedLineIds((prev) => ({ ...prev, [lineId]: !prev[lineId] }));
  };

  const toggleAllSupplierLines = (suppName: string, value: boolean) => {
    const lines = linesBySupplier[suppName] || [];
    setSelectedLineIds((prev) => {
      const next = { ...prev };
      lines.forEach((l) => {
        next[l.axonLineId] = value;
      });
      return next;
    });
  };

  const formatStatus = (status: 'NEW' | 'IN_PROGRESS' | 'COMPLETED') => {
    switch (status) {
      case 'NEW':
        return <span className="axon-inbound-badge axon-inbound-badge--new">New</span>;
      case 'IN_PROGRESS':
        return <span className="axon-inbound-badge axon-inbound-badge--progress">In Progress</span>;
      case 'COMPLETED':
        return <span className="axon-inbound-badge axon-inbound-badge--completed">Completed</span>;
    }
  };

  // ─── VIEW 1: INBOX PROJECTS LIST ──────────────────────────────────────────
  if (!selectedProject) {
    return (
      <div className="page-stack bulk-cost-supplier-page animated-fadeIn">
        <section className="panel supplier-search-panel">
          <div className="workspace-run-summary-grid" aria-label="AXON inbox status summary">
            {summaryCards.map((card) => {
              const isActive = statusFilter === card.status;
              const summaryKey = card.status;
              return (
                <button
                  key={summaryKey}
                  type="button"
                  className={`workspace-run-summary-card workspace-run-summary-card--${summaryKey.toLowerCase()}${isActive ? ' workspace-run-summary-card--active' : ''}`}
                  onClick={() => setStatusFilter(card.status)}
                  aria-pressed={isActive}
                >
                  <span className="workspace-run-summary-copy">
                    <strong>{card.label}</strong>
                    <small>{card.description}</small>
                  </span>
                  <span className="workspace-run-summary-value">{card.value}</span>
                </button>
              );
            })}
          </div>

          <div className="workspace-run-control-row">
            <div className="supplier-search-bar workspace-run-search-bar">
              <Search size={18} aria-hidden="true" />
              <input
                type="text"
                placeholder="Search customer name, Chain ID, subject..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="supplier-search-input"
              />
            </div>

            <button
              type="button"
              className="secondary-button compact-btn"
              onClick={() => {
                toast.success('Refreshing new projects list...', {
                  description: 'Updated to the latest status from cloud view.',
                });
              }}
              title="Refresh list"
            >
              <RefreshCw size={14} aria-hidden="true" />
              Refresh
            </button>

            <span className="supplier-filter-result-count workspace-run-result-count">
              {filteredProjects.length} project{filteredProjects.length !== 1 ? 's' : ''} found
            </span>
          </div>
        </section>

        {/* Projects Table Card */}
        <section className="panel bulk-cost-table-panel">
          <div className="table-scroll supplier-table-scroll allocation-list-scroll">
            <table
              className="prototype-table allocation-list-table axon-inbound-table"
              style={tableSizing.tableStyle}
              data-resizable-table={tableSizing.tableId}
              aria-label="AXON Inbound inbox"
            >
              <colgroup>
                {AXON_INBOX_TABLE_COLUMNS.map((col) => (
                  <col key={col.key} style={tableSizing.getColumnStyle(col.key)} />
                ))}
              </colgroup>
              <thead>
                <tr>
                  {AXON_INBOX_TABLE_COLUMNS.map((col) => (
                    <th key={col.key} className="resizable-table-header" {...tableSizing.getCellProps(col.key)}>
                      <span>{COL_LABELS[col.key]}</span>
                      {tableSizing.renderResizeHandle(col.key)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginatedProjects.map((p) => (
                  <tr
                    key={p.chainId}
                    className="axon-inbound-project-row"
                    onDoubleClick={() => setSelectedProject(p)}
                  >
                    <td className="center-cell strong-cell text-term-blue" title={p.chainId} {...tableSizing.getCellProps('chainId')}>{p.chainId}</td>
                    <td title={p.customerName} {...tableSizing.getCellProps('customerName')}>{p.customerName}</td>
                    <td className="strong-cell" style={{ color: '#1e293b', textAlign: 'left' }} title={`${p.subject} (${p.rfqNo})`} {...tableSizing.getCellProps('subject')}>
                      <div style={{ display: 'block', textAlign: 'left' }}>
                        <div style={{ fontWeight: 'bold', lineHeight: '1.25' }}>{p.subject}</div>
                        <div style={{ color: '#475569', fontFamily: 'monospace', fontSize: '10.5px', marginTop: '3px' }}>
                          {p.rfqNo}
                        </div>
                      </div>
                    </td>
                    <td title={p.suppliers.map((s) => `${s.name} (${s.itemsCount})`).join(', ')} {...tableSizing.getCellProps('suppliers')}>
                      <div className="flex flex-wrap gap-x-1.5 gap-y-2">
                        {p.suppliers.map((s) => (
                          <span key={s.name} className="axon-inbound-supplier-badge">
                            {s.name} ({s.itemsCount})
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="center-cell font-bold" title={String(p.lines.length)} {...tableSizing.getCellProps('linesCount')}>{p.lines.length}</td>
                    <td className="center-cell" title={formatDate(p.updatedAt)} {...tableSizing.getCellProps('updatedAt')}>{formatDate(p.updatedAt)}</td>
                    <td className="center-cell" title={p.saleIncharge} {...tableSizing.getCellProps('saleIncharge')}>{p.saleIncharge}</td>
                    <td className="center-cell" title={p.status} {...tableSizing.getCellProps('status')}>{formatStatus(p.status)}</td>
                    <td className="center-cell" {...tableSizing.getCellProps('action')}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedProject(p);
                        }}
                        className="primary-button compact-btn text-[11px] font-bold"
                        style={{ height: '28px', padding: '0 10px', fontSize: '11px' }}
                      >
                        Open
                      </button>
                    </td>
                  </tr>
                ))}
                {totalItems === 0 && (
                  <tr>
                    <td colSpan={8} className="center-cell text-gray-400 py-10">
                      No inbound projects found matching your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <TablePager
            currentPage={Math.min(currentPage, totalPages)}
            pageSize={PAGE_SIZE}
            totalItems={totalItems}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        </section>
      </div>
    );
  }

  // ─── VIEW 2: GROUPED DETAIL PREVIEW VIEW ───────────────────────────────────
  return (
    <div className="page-stack bulk-cost-supplier-page animated-fadeIn">
      {/* Simulation Overlay Loader */}
      {simulationState !== 'idle' && (
        <div className="axon-simulator-overlay flex flex-col items-center justify-center">
          <div className="axon-simulator-card p-8 rounded-xl shadow-2xl flex flex-col items-center text-center">
            <Loader2 size={44} className="animate-spin text-term-blue mb-4" />
            <h3 className="text-lg font-extrabold text-gray-900 mb-1">
              กำลังเชื่อมต่อจำลองกับ AXON Database View
            </h3>
            <p className="text-sm text-gray-500 mb-6 font-mono">
              Chain ID: {selectedProject.chainId} | Supplier: {simulatingSupplier?.name}
            </p>

            {/* Simulated Progress Bar */}
            <div className="w-64 h-3.5 bg-gray-100 rounded-full overflow-hidden border border-gray-200 mb-6">
              <div
                className="h-full bg-term-blue transition-all duration-300 ease-out"
                style={{ width: `${simulationProgress}%` }}
              />
            </div>

            {/* Stepper Status Logs */}
            <div className="flex flex-col gap-2.5 text-left w-full max-w-xs px-2">
              <div className="flex items-center gap-2 text-xs font-bold">
                <span className={`w-4 h-4 rounded-full flex items-center justify-center ${simulationProgress >= 20 ? 'bg-green-500 text-white' : 'bg-term-blue text-white animate-pulse'}`}>
                  {simulationProgress >= 20 ? '✓' : '1'}
                </span>
                <span className={simulationProgress >= 20 ? 'text-gray-500' : 'text-gray-900'}>
                  Connecting to SBO Linked Server...
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs font-bold">
                <span className={`w-4 h-4 rounded-full flex items-center justify-center ${simulationProgress >= 60 ? 'bg-green-500 text-white' : simulationProgress >= 20 ? 'bg-term-blue text-white animate-pulse' : 'bg-gray-200 text-gray-400'}`}>
                  {simulationProgress >= 60 ? '✓' : '2'}
                </span>
                <span className={simulationProgress >= 60 ? 'text-gray-500' : simulationProgress >= 20 ? 'text-gray-900' : 'text-gray-400'}>
                  Pulling Awarded Line Candidates...
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs font-bold">
                <span className={`w-4 h-4 rounded-full flex items-center justify-center ${simulationProgress >= 100 ? 'bg-green-500 text-white' : simulationProgress >= 60 ? 'bg-term-blue text-white animate-pulse' : 'bg-gray-200 text-gray-400'}`}>
                  {simulationProgress >= 100 ? '✓' : '3'}
                </span>
                <span className={simulationProgress >= 100 ? 'text-gray-900' : simulationProgress >= 60 ? 'text-gray-900' : 'text-gray-400'}>
                  Caching DraftItem/DraftTerm...
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Detail Header Section */}
      <section className="panel supplier-search-panel">
        <div className="flex items-center gap-2.5 mb-2">
          <button
            type="button"
            className="secondary-button compact-btn flex items-center gap-1"
            onClick={() => setSelectedProject(null)}
          >
            <ArrowLeft size={13} />
            ย้อนกลับไปกล่องรับจดหมาย (Back to Inbox)
          </button>
        </div>

        <div className="supplier-selection-copy flex justify-between items-end w-full">
          <div>
            <p className="eyebrow flex items-center gap-1.5">
              <span>AXON PREVIEW &amp; INTAKE SYSTEM</span>
              <span className="run-status-badge run-status-badge--simulator text-[10px] py-0.5 px-2">
                SIMULATOR
              </span>
            </p>
            <h2 className="text-xl font-black text-gray-900">
              รายละเอียดและสิทธิ์ผู้ชนะใบเสนอราคาโครงการ {selectedProject.chainId}
            </h2>
          </div>
          <div className="text-right text-[12.5px] font-semibold text-slate-600">
            <div>{selectedProject.customerName}</div>
            <div className="text-[11.5px] text-slate-500 font-mono mt-0.5">{selectedProject.rfqNo}</div>
          </div>
        </div>

        {/* Modern Stepper Indicator & Warning Container */}
        <div className="grid grid-cols-1 lg:grid-cols-[430px_1fr] items-stretch gap-4 w-full mt-5 mb-1">
          {/* Modern Stepper Indicator */}
          <div className="axon-intake-stepper-row" style={{ margin: 0, height: '100%' }}>
            <div className="axon-intake-step axon-intake-step--active">
              <span className="axon-intake-step-circle">1</span>
              <strong>ดึงข้อมูลผู้ชนะ</strong>
              <small>AXON Stream</small>
            </div>
            <div className="axon-intake-step-line" />
            <div className="axon-intake-step">
              <span className="axon-intake-step-circle">2</span>
              <strong>คัดแยกผู้ขาย</strong>
              <small>Supplier Isolation</small>
            </div>
            <div className="axon-intake-step-line" />
            <div className="axon-intake-step">
              <span className="axon-intake-step-circle">3</span>
              <strong>เข้ากระดานปันส่วน</strong>
              <small>Bulk calculation</small>
            </div>
          </div>

          {/* Glassmorphic Blocked Warning */}
          <div className="axon-intake-alert" style={{ margin: 0, height: '100%', padding: '16px 20px', display: 'flex', alignItems: 'center' }}>
            <AlertTriangle size={18} className="axon-intake-alert-icon text-amber-500" aria-hidden="true" style={{ marginTop: 0 }} />
            <div className="flex flex-col gap-1.5 text-slate-700 w-full">
              <span className="font-extrabold text-sm text-slate-850">
                หมายเหตุการพัฒนาระบบคำนวณแบบจำลอง (Simulation Mode)
              </span>
              <ul className="list-disc pl-5 text-xs space-y-1 font-semibold leading-relaxed" style={{ margin: 0 }}>
                <li>
                  ช่องทางเชื่อมโยงฐานข้อมูลการเชื่อมต่อแบบเรียลไทม์ <code className="text-blue-700 bg-blue-100/80 px-1.5 py-0.5 rounded font-bold text-[11px]">Live Sync</code> ยังอยู่ระหว่างรอการสร้าง SQL View <code className="text-blue-700 bg-blue-100/80 px-1.5 py-0.5 rounded font-mono font-bold text-[11px]">vw_comparisons</code> จากทีม <strong className="text-blue-800 font-extrabold">AXON</strong>
                </li>
                <li>
                  ท่านสามารถคลิกปุ่ม <strong className="text-blue-800 font-extrabold">"จำลองคำนวณ"</strong> (ปุ่มสีน้ำเงินขวาบนของการ์ดแต่ละผู้ขาย) เพื่อจำลองโฟลว์การนำรายการสินค้าวิ่งผ่านฐานข้อมูลจำลอง <code className="text-blue-700 bg-blue-100/80 px-1.5 py-0.5 rounded font-mono font-bold text-[11px]">AIX Draft Snapshots</code>
                </li>
                <li>
                  ระบบจะนำทางท่านไปยัง <strong className="text-blue-800 font-extrabold">กระดานคำนวณหลัก (Bulk Cost Workspace)</strong> เพื่อให้เห็นขั้นตอนการวิเคราะห์เปรียบเทียบและการปันส่วนต้นทุนจริงได้ครบถ้วน
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Supplier-Grouped Collapsible Table (PartCatalog Style) */}
      <section className="panel bulk-cost-table-panel animated-fadeIn shadow-md">
        <div className="table-scroll supplier-table-scroll">
          <table
            className="prototype-table allocation-list-table axon-intake-table"
            style={parentSizing.tableStyle}
            data-resizable-table={parentSizing.tableId}
          >
            <colgroup>
              {AXON_PARENT_SUPPLIER_COLUMNS.map((col) => (
                <col key={col.key} style={parentSizing.getColumnStyle(col.key)} />
              ))}
            </colgroup>
            <thead className="bg-[#2264A0] text-white">
              <tr className="hover:bg-[#2264A0] border-b-0">
                {AXON_PARENT_SUPPLIER_COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    className="resizable-table-header text-white"
                    style={{ background: '#2264A0', color: 'white' }}
                    {...parentSizing.getCellProps(col.key)}
                  >
                    <span>{PARENT_COL_LABELS[col.key]}</span>
                    {col.key !== 'expand' && col.key !== 'select' && parentSizing.renderResizeHandle(col.key)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(linesBySupplier).map(([suppName, lines]) => {
                const matchingSupp = selectedProject.suppliers.find((s) => s.name === suppName);
                const agg = supplierAggregates[suppName] || { totalQty: 0, totalAmount: 0, selectedCount: 0 };
                const allSelected = agg.selectedCount === lines.length;
                const noneSelected = agg.selectedCount === 0;
                const isExpanded = !!expandedSuppliers[suppName];

                return (
                  <Fragment key={suppName}>
                    {/* Supplier Parent Row */}
                    <tr
                      className={`cursor-pointer h-12 transition-colors ${
                        isExpanded ? 'bg-[#f1f5f9]' : 'bg-white hover:bg-slate-50/50'
                      }`}
                      onClick={() => toggleSupplierExpand(suppName)}
                    >
                      <td className="center-cell" {...parentSizing.getCellProps('expand')} onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => toggleSupplierExpand(suppName)}
                          className="flex items-center justify-center w-6 h-6 hover:bg-gray-200 rounded-full text-gray-500 transition-colors"
                          aria-label={isExpanded ? 'Collapse items' : 'Expand items'}
                        >
                          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </button>
                      </td>
                      <td className="center-cell" {...parentSizing.getCellProps('select')} onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={allSelected}
                          onChange={(e) => toggleAllSupplierLines(suppName, e.target.checked)}
                          className="w-4.5 h-4.5 rounded cursor-pointer accent-term-blue"
                          aria-label={`Select all ${suppName} lines`}
                        />
                      </td>
                      <td className="font-extrabold text-slate-800 text-sm text-left" title={`${suppName} (${matchingSupp ? matchingSupp.code : ''})`} {...parentSizing.getCellProps('supplier')}>
                        <div className="flex items-center gap-2">
                          <span className="text-[13.5px] font-bold text-slate-800">{suppName}</span>
                          <span className="axon-vendor-code-badge">
                            {matchingSupp ? matchingSupp.code : 'Vendor'}
                          </span>
                        </div>
                      </td>
                      <td className="center-cell font-semibold text-slate-700" title={`${agg.selectedCount} / ${lines.length}`} {...parentSizing.getCellProps('items')}>
                        {agg.selectedCount} / {lines.length}
                      </td>
                      <td className="center-cell font-bold text-slate-700" title={matchingSupp?.currency || 'USD'} {...parentSizing.getCellProps('currency')}>
                        {matchingSupp?.currency || 'USD'}
                      </td>
                      <td className="numeric-cell font-extrabold font-mono text-slate-900" title={agg.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {...parentSizing.getCellProps('amount')}>
                        {agg.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="center-cell" {...parentSizing.getCellProps('action')} onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          disabled={noneSelected || !matchingSupp}
                          onClick={() => matchingSupp && handleStartSimulation(matchingSupp)}
                          className="axon-simulate-btn"
                        >
                          <Play size={10} fill="currentColor" />
                          จำลองคำนวณ
                        </button>
                      </td>
                    </tr>

                    {/* Nested Child Items Table */}
                    {isExpanded && (
                      <tr>
                        <td colSpan={7} className="p-3 bg-slate-100 border-r border-[#DDDDDD]">
                          <div className="bg-white rounded border border-gray-300 overflow-hidden shadow-sm">
                            <div className="bg-[#E8F0F8] px-4 py-1.5 border-b border-blue-200 flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-[#2264A0] font-extrabold text-xs">รายการสินค้าผู้เสนอราคา ({suppName})</span>
                                <span className="text-[11px] text-slate-500 font-bold">({lines.length} รายการ)</span>
                              </div>
                              <span className="text-[11px] text-slate-400 font-semibold">
                                คลิกที่แถวสินค้าด้านล่างเพื่อเลือก/ยกเลิกการปันส่วน
                              </span>
                            </div>
                            <div className="overflow-x-auto">
                              <table
                                className="prototype-table allocation-list-table axon-intake-table min-w-full"
                                style={childSizing.tableStyle}
                                data-resizable-table={childSizing.tableId}
                              >
                                <colgroup>
                                  {AXON_CHILD_ITEMS_COLUMNS.map((col) => (
                                    <col key={col.key} style={childSizing.getColumnStyle(col.key)} />
                                  ))}
                                </colgroup>
                                <thead>
                                  <tr className="bg-[#666666] border-b-0 hover:bg-[#666666]">
                                    {AXON_CHILD_ITEMS_COLUMNS.map((col) => (
                                      <th
                                        key={col.key}
                                        className="resizable-table-header text-white border-r border-gray-500"
                                        style={{ background: '#666666', color: 'white' }}
                                        {...childSizing.getCellProps(col.key)}
                                      >
                                        <span>{CHILD_COL_LABELS[col.key]}</span>
                                        {col.key !== 'select' && childSizing.renderResizeHandle(col.key)}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {lines.map((line) => {
                                    const isChecked = !!selectedLineIds[line.axonLineId];
                                    return (
                                      <tr
                                        key={line.axonLineId}
                                        className={`axon-intake-placeholder-row hover:bg-blue-50/50 cursor-pointer h-9 ${isChecked ? 'bg-[#f8fafc]' : 'opacity-65'}`}
                                        onClick={() => toggleLine(line.axonLineId)}
                                      >
                                        <td className="center-cell border-r border-gray-200" {...childSizing.getCellProps('select')} onClick={(e) => e.stopPropagation()}>
                                          <input
                                            type="checkbox"
                                            checked={isChecked}
                                            onChange={() => toggleLine(line.axonLineId)}
                                            className="w-4 h-4 cursor-pointer accent-term-blue"
                                            aria-label={`Select line ${line.axonLineId}`}
                                          />
                                        </td>
                                        <td className="center-cell strong-cell font-mono text-[12px] text-slate-800 border-r border-gray-200" title={line.axonLineId} {...childSizing.getCellProps('axonLineId')}>{line.axonLineId}</td>
                                        <td className="strong-cell text-slate-700 text-xs font-semibold border-r border-gray-200" style={{ textAlign: 'left' }} title={line.brand} {...childSizing.getCellProps('brand')}>{line.brand}</td>
                                        <td className="font-mono text-xs text-slate-700 font-semibold border-r border-gray-200" style={{ textAlign: 'left' }} title={line.mfrCatalogNo} {...childSizing.getCellProps('mfrCatalogNo')}>{line.mfrCatalogNo}</td>
                                        <td className="axon-desc-cell text-slate-900 text-xs font-semibold border-r border-gray-200" style={{ textAlign: 'left' }} title={line.description} {...childSizing.getCellProps('description')}>{line.description}</td>
                                        <td className="center-cell font-bold text-slate-900 border-r border-gray-200" title={String(line.qty)} {...childSizing.getCellProps('qty')}>{line.qty}</td>
                                        <td className="numeric-cell font-mono font-bold text-slate-900 border-r border-gray-200" title={line.unitPrice.toFixed(2)} {...childSizing.getCellProps('unitPrice')}>
                                          {line.unitPrice.toFixed(2)}
                                        </td>
                                        <td className="center-cell font-bold text-slate-700 border-r border-gray-200" {...childSizing.getCellProps('currency')}>{line.currency}</td>
                                        <td className="center-cell" {...childSizing.getCellProps('costMark')}>
                                          <span className={`axon-cost-marker axon-cost-marker--${line.costMark === 'LINE_TOTAL' ? 'line' : 'header'}`}>
                                            {line.costMark}
                                          </span>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
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
