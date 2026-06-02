'use client';

import { Suspense, useCallback, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Boxes, FileSpreadsheet, LayoutDashboard, PanelLeftClose, PanelLeftOpen, Plus, Upload } from 'lucide-react';
import { AllocationList } from '@/features/bulk-cost/AllocationList';
import { BulkCostWorkspace } from '@/features/bulk-cost/BulkCostWorkspace';
import { SupplierSelection } from '@/features/bulk-cost/SupplierSelection';
import { AxonAwardedIntake } from '@/features/bulk-cost/AxonAwardedIntake';
import type { BulkCostRunSummary } from '@/features/bulk-cost/bulk-cost.types';

type WorkspaceView = 'runs' | 'new' | 'axon';

const WORKSPACE_VIEWS = new Set<WorkspaceView>(['runs', 'new', 'axon']);

function normalizeWorkspaceView(value: string | null): WorkspaceView {
  if (value === 'allocations') return 'runs';
  if (value && WORKSPACE_VIEWS.has(value as WorkspaceView)) return value as WorkspaceView;
  return 'runs';
}

function BulkCostContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const codeFromUrl = searchParams.get('supplier') ?? '';
  const nameFromUrl = searchParams.get('supplierName') ?? '';
  const tabFromUrl = normalizeWorkspaceView(searchParams.get('tab'));
  const runIdFromUrl = searchParams.get('runId') ?? '';
  const fromTab = normalizeWorkspaceView(searchParams.get('from'));

  const selectedSupplier = codeFromUrl ? { code: codeFromUrl, name: nameFromUrl } : null;
  const activeView = selectedSupplier ? 'editor' : tabFromUrl;

  const navItems = useMemo(
    () => [
      {
        id: 'runs' as const,
        label: 'Workspace Runs',
        description: 'รายการคำนวณที่บันทึกไว้',
        icon: LayoutDashboard,
      },
      {
        id: 'axon' as const,
        label: 'AXON Awarded',
        description: 'รายการผู้ขายที่ได้รับเลือก',
        icon: Upload,
      },
      {
        id: 'new' as const,
        label: 'New Manual',
        description: 'สร้างรายการคำนวณใหม่ (ป้อนข้อมูลเอง)',
        icon: Plus,
      },
    ],
    [],
  );

  const setParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null) params.delete(key);
        else params.set(key, value);
      }
      router.replace(`?${params.toString()}`);
    },
    [router, searchParams],
  );

  // From New Manual tab: open fresh workspace
  const handleSelectSupplier = useCallback(
    (vendor: { code: string; name: string }) => {
      setParams({ supplier: vendor.code, supplierName: vendor.name, tab: null, from: 'new', runId: null });
    },
    [setParams],
  );

  // From Workspace Runs list: open existing run
  const handleOpenRun = useCallback(
    (run: BulkCostRunSummary) => {
      setParams({ supplier: run.vendorCode, supplierName: run.vendorName, runId: String(run.runId), tab: null, from: 'runs' });
    },
    [setParams],
  );

  // Back from workspace: return to whichever tab the user came from
  const handleBack = useCallback(() => {
    setParams({ supplier: null, supplierName: null, runId: null, from: null, tab: fromTab });
  }, [setParams, fromTab]);

  const handleViewChange = useCallback(
    (value: WorkspaceView) => {
      setParams({ tab: value, supplier: null, supplierName: null, runId: null, from: null });
    },
    [setParams],
  );

  // From AXON tab: import mock supplier data and redirect to editor
  const handleImportSupplier = useCallback(
    (vendor: { code: string; name: string }) => {
      setParams({ supplier: vendor.code, supplierName: vendor.name, tab: null, from: 'axon', runId: null });
    },
    [setParams],
  );

  const viewContent = selectedSupplier ? (
    <BulkCostWorkspace
      supplierCode={selectedSupplier.code}
      supplierName={selectedSupplier.name}
      savedRunId={runIdFromUrl ? Number(runIdFromUrl) : null}
      backLabel={fromTab === 'runs' ? 'Back to Workspace Runs' : fromTab === 'axon' ? 'Back to AXON Awarded' : 'Back to Supplier List'}
      onBack={handleBack}
    />
  ) : tabFromUrl === 'new' ? (
    <SupplierSelection onSelectSupplier={handleSelectSupplier} />
  ) : tabFromUrl === 'axon' ? (
    <AxonAwardedIntake onImportSupplier={handleImportSupplier} />
  ) : (
    <AllocationList onOpen={handleOpenRun} />
  );

  return (
    <div className="bulk-cost-page-root">
      <div className={`cost-workspace-shell ${sidebarCollapsed ? 'cost-workspace-shell--collapsed' : ''}`}>
        <aside className="cost-workspace-sidebar" aria-label="Cost Workspace navigation">
          <div className="cost-workspace-sidebar-header">
            <div className="cost-workspace-sidebar-brand" aria-hidden="true">
              <Boxes size={18} />
            </div>
            {!sidebarCollapsed && (
              <div className="cost-workspace-sidebar-title">
                <strong>Cost Workspace</strong>
                <span>AXON & Manual Cost</span>
              </div>
            )}
            <button
              aria-label={sidebarCollapsed ? 'Expand Cost Workspace sidebar' : 'Collapse Cost Workspace sidebar'}
              className="cost-workspace-sidebar-toggle"
              type="button"
              onClick={() => setSidebarCollapsed((value) => !value)}
              title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {sidebarCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
            </button>
          </div>

          <nav className="cost-workspace-sidebar-nav">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeView === item.id;
              return (
                <button
                  aria-current={isActive ? 'page' : undefined}
                  className={`cost-workspace-nav-item ${isActive ? 'cost-workspace-nav-item--active' : ''}`}
                  key={item.id}
                  onClick={() => handleViewChange(item.id)}
                  title={sidebarCollapsed ? item.label : undefined}
                  type="button"
                >
                  <Icon size={18} aria-hidden="true" />
                  {!sidebarCollapsed && (
                    <span>
                      <strong>{item.label}</strong>
                      <small>{item.description}</small>
                    </span>
                  )}
                </button>
              );
            })}

            {selectedSupplier && (
              <div className="cost-workspace-nav-item cost-workspace-nav-item--active cost-workspace-nav-item--readonly" title={sidebarCollapsed ? 'Editor' : undefined}>
                <FileSpreadsheet size={18} aria-hidden="true" />
                {!sidebarCollapsed && (
                  <span>
                    <strong>Editor</strong>
                    <small>{selectedSupplier.name || selectedSupplier.code}</small>
                  </span>
                )}
              </div>
            )}
          </nav>

          {!sidebarCollapsed && (
            <div className="cost-workspace-sidebar-note">
              <strong>ข้อมูลฉบับร่าง (Draft)</strong>
              <span>Save Revision บันทึกเป็นร่างการคำนวณเท่านั้น ยังไม่เข้า PartCatalog/SAP จริง</span>
            </div>
          )}
        </aside>

        <section className="cost-workspace-main" aria-label="Cost Workspace content">
          {viewContent}
        </section>
      </div>
    </div>
  );
}

export default function BulkCostPage() {
  return (
    <Suspense fallback={<div className="page-stack" />}>
      <BulkCostContent />
    </Suspense>
  );
}
