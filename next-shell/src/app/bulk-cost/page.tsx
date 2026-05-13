'use client';

import { Suspense, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AllocationList } from '@/features/bulk-cost/AllocationList';
import { BulkCostWorkspace } from '@/features/bulk-cost/BulkCostWorkspace';
import { SupplierSelection } from '@/features/bulk-cost/SupplierSelection';
import type { BulkCostRunSummary } from '@/features/bulk-cost/bulk-cost.types';

function BulkCostContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const codeFromUrl = searchParams.get('supplier') ?? '';
  const nameFromUrl = searchParams.get('supplierName') ?? '';
  const tabFromUrl = searchParams.get('tab') ?? 'allocations';
  const runIdFromUrl = searchParams.get('runId') ?? '';
  const fromTab = searchParams.get('from') ?? 'allocations';

  const selectedSupplier = codeFromUrl ? { code: codeFromUrl, name: nameFromUrl } : null;

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

  // From New Allocation tab: open fresh workspace
  const handleSelectSupplier = useCallback(
    (vendor: { code: string; name: string }) => {
      setParams({ supplier: vendor.code, supplierName: vendor.name, tab: null, from: 'new', runId: null });
    },
    [setParams],
  );

  // From Allocations list: open existing run
  const handleOpenRun = useCallback(
    (run: BulkCostRunSummary) => {
      setParams({ supplier: run.vendorCode, supplierName: run.vendorName, runId: String(run.runId), tab: null, from: 'allocations' });
    },
    [setParams],
  );

  // Back from workspace: return to whichever tab the user came from
  const handleBack = useCallback(() => {
    setParams({ supplier: null, supplierName: null, runId: null, from: null, tab: fromTab });
  }, [setParams, fromTab]);

  const handleTabChange = useCallback(
    (value: string) => {
      setParams({ tab: value, supplier: null, supplierName: null, runId: null, from: null });
    },
    [setParams],
  );

  // Supplier selected → show Workspace (bypasses tabs)
  if (selectedSupplier) {
    return (
      <div className="bulk-cost-page-root">
        <BulkCostWorkspace
          supplierCode={selectedSupplier.code}
          supplierName={selectedSupplier.name}
          savedRunId={runIdFromUrl ? Number(runIdFromUrl) : null}
          backLabel={fromTab === 'allocations' ? 'Back to Allocations' : 'Back to Supplier List'}
          onBack={handleBack}
        />
      </div>
    );
  }

  return (
    <div className="bulk-cost-page-root">
      <Tabs value={tabFromUrl} onValueChange={handleTabChange} className="bulk-cost-tabs-root">
        <TabsList>
          <TabsTrigger value="allocations" className="data-[state=active]:bg-[#2264A0] data-[state=active]:text-white px-4 py-3 h-auto rounded-none">Allocations</TabsTrigger>
          <TabsTrigger value="new" className="data-[state=active]:bg-[#2264A0] data-[state=active]:text-white px-4 py-3 h-auto rounded-none">New Allocation</TabsTrigger>
        </TabsList>

        <TabsContent value="allocations" className="bulk-cost-tab-content">
          <AllocationList onOpen={handleOpenRun} />
        </TabsContent>

        <TabsContent value="new" className="bulk-cost-tab-content">
          <SupplierSelection onSelectSupplier={handleSelectSupplier} />
        </TabsContent>
      </Tabs>
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
