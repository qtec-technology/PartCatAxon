'use client';

// Route: /term/preview?key=...
// Opens a read-only Term form pre-filled with Bulk Cost allocation data.

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { loadBulkCostPreview } from '@/features/bulk-cost/bulk-cost.preview';
import type { BulkCostTermPreviewPayload } from '@/features/bulk-cost/bulk-cost.preview';
import { TermHeader } from '@/components/features/term/TermHeader';
import { TermInfoRow } from '@/components/features/term/TermInfoRow';
import { StageIndicators } from '@/components/features/term/StageIndicators';
import { TermForm } from '@/components/features/term/TermForm';
import { useTermPageData } from '@/components/features/term/hooks/useTermPageData';
import { deriveStageStatusFromUiResults } from '@/components/features/term/mappers/term-calculation.mapper';
import type { TermCalcResults, TermFormData, TermStageStatus } from '@/types/term_form.types';
import { defaultTermCalcResults, defaultTermStageStatus } from '@/types/term_form.types';

function TermPreviewContent() {
    const searchParams = useSearchParams();
    const key = searchParams.get('key');
    const [payload, setPayload] = useState<BulkCostTermPreviewPayload | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [calcResults, setCalcResults] = useState<TermCalcResults>(defaultTermCalcResults);
    const [stageStatus, setStageStatus] = useState<TermStageStatus>(defaultTermStageStatus);

    useEffect(() => {
        if (payload) return; // already loaded — avoid re-running on every render
        if (!key) {
            setError('No preview key provided.');
            return;
        }
        const loaded = loadBulkCostPreview(key);
        if (!loaded || loaded.type !== 'term') {
            setError('Preview data not found or expired. Please reopen from the Cost Workspace.');
            return;
        }
        const termPayload = loaded as BulkCostTermPreviewPayload;
        setPayload(termPayload);
        setCalcResults(termPayload.calcResults);
        setStageStatus(deriveStageStatusFromUiResults(termPayload.calcResults, {
            currency: termPayload.formData.currency,
            excisePercent: termPayload.formData.excisePercent,
            purchaseUOM: termPayload.formData.purchaseUOM,
            salesUOM: termPayload.formData.salesUOM,
        }));
    }, [key]); // depend on key string, not searchParams object reference

    // Load lookup data (suppliers, currencies, etc.) for dropdowns in read-only display
    const {
        isInitialLoading,
        suppliers,
        contacts,
        orderTerms,
        locations,
        purchaseSubLocations,
        salesSubLocations,
        currencies,
        freightTypes,
        salesPersons,
        uomOptions,
    } = useTermPageData({
        mode: 'new',
        readOnlyMode: true,
    });

    if (error) {
        return (
            <div className="h-full flex items-center justify-center bg-[#F0F2F5]">
                <div className="text-center p-8 max-w-md">
                    <p className="text-red-600 font-semibold mb-2">Preview Unavailable</p>
                    <p className="text-gray-600 text-sm">{error}</p>
                    <button
                        className="mt-4 px-4 py-2 text-sm bg-gray-200 rounded hover:bg-gray-300"
                        type="button"
                        onClick={() => window.close()}
                    >
                        Close Tab
                    </button>
                </div>
            </div>
        );
    }

    if (!payload || isInitialLoading) {
        return (
            <div className="h-full bg-[#F0F2F5] flex items-center justify-center">
                <div className="flex items-center gap-2 text-term-blue font-semibold">
                    <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
                    <span>Loading preview…</span>
                </div>
            </div>
        );
    }

    const { meta, formData } = payload;
    const noop = () => { /* preview: no-op */ };

    return (
        <div className="bg-[#F0F2F5] font-sans text-gray-900">
            <div className="bulk-cost-preview-banner">
                <div className="bulk-cost-preview-banner-content">
                    <span className="bulk-cost-preview-banner-title">ตัวอย่างแบบร่างเงื่อนไขการจัดซื้อ (Term Preview)</span>
                    <span className="bulk-cost-preview-banner-sub">
                        {meta.description || meta.lineKey} · {meta.supplierName} · อ่านอย่างเดียว (Read-only) · ยังไม่บันทึก
                    </span>
                </div>
                <button
                    className="bulk-cost-preview-banner-close"
                    type="button"
                    onClick={() => window.close()}
                >
                    ปิดหน้าต่าง
                </button>
            </div>
            <TermHeader
                mode="view"
                itemCode={meta.lineKey}
                onSave={noop}
                onExit={() => window.close()}
                onBack={() => window.close()}
                onEdit={noop}
                onCancel={noop}
                onDelete={noop}
                onSendRfq={noop}
                isSendingRfq={false}
                disableMutations={true}
                disableEdit={true}
                disableDelete={true}
                disableSave={true}
            />
            <TermInfoRow
                itemCode={meta.lineKey}
                itemDesc={meta.description}
                formData={formData as TermFormData}
                updateFormData={noop as never}
                isReadOnly={true}
                suppliers={suppliers}
                contacts={contacts}
                orderTerms={orderTerms}
                locations={locations}
                purchaseSubLocations={purchaseSubLocations}
                salesSubLocations={salesSubLocations}
                onSuppOrderCodeCommit={noop}
                onSupplierChange={noop}
            />
            <StageIndicators status={stageStatus} />
            <TermForm
                mode="view"
                formData={formData as TermFormData}
                updateFormData={noop as never}
                calcResults={calcResults}
                setCalcResults={setCalcResults}
                setStageStatus={setStageStatus}
                attachments={[]}
                currencies={currencies}
                freightTypes={freightTypes}
                salesPersons={salesPersons}
                uoms={uomOptions}
                onAddAttachment={undefined}
                onDeleteAttachment={undefined}
                attachmentOwner={null}
            />
        </div>
    );
}

export default function TermPreviewPage() {
    return (
        <Suspense fallback={
            <div className="h-full bg-[#F0F2F5] flex items-center justify-center">
                <div className="flex items-center gap-2 text-term-blue font-semibold">
                    <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
                    <span>Loading preview…</span>
                </div>
            </div>
        }>
            <TermPreviewContent />
        </Suspense>
    );
}
