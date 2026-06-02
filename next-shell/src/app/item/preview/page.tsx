'use client';

// Route: /item/preview?key=...
// Opens a read-only Item form pre-filled with Bulk Cost allocation data.

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { loadBulkCostPreview } from '@/features/bulk-cost/bulk-cost.preview';
import type { BulkCostItemPreviewPayload } from '@/features/bulk-cost/bulk-cost.preview';
import { ItemForm } from '@/components/features/item/ItemForm';
import type { ItemData } from '@/types/item_types';

function ItemPreviewContent() {
    const searchParams = useSearchParams();
    const key = searchParams.get('key');
    const [payload, setPayload] = useState<BulkCostItemPreviewPayload | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (payload) return; // already loaded — avoid re-running on every render
        if (!key) {
            setError('No preview key provided.');
            return;
        }
        const loaded = loadBulkCostPreview(key);
        if (!loaded || loaded.type !== 'item') {
            setError('Preview data not found or expired. Please reopen from the Cost Workspace.');
            return;
        }
        setPayload(loaded as BulkCostItemPreviewPayload);
    }, [key]); // depend on key string, not searchParams object reference

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

    if (!payload) {
        return (
            <div className="h-full flex items-center justify-center bg-[#F0F2F5]">
                <p className="text-gray-500 text-sm">Loading preview…</p>
            </div>
        );
    }

    const { meta, itemData } = payload;

    return (
        <div className="h-full overflow-y-auto">
            <div className="bulk-cost-preview-banner">
                <div className="bulk-cost-preview-banner-content">
                    <span className="bulk-cost-preview-banner-title">ตัวอย่างแบบร่างข้อมูลสินค้า (Item Preview)</span>
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
            <ItemForm
                mode="VIEW"
                initialData={itemData as ItemData}
                readOnlyMode={true}
                onSave={() => { /* preview: no-op */ }}
                onCancel={() => window.close()}
                onExit={() => window.close()}
                onChangeMode={() => { /* preview: no mode change */ }}
            />
        </div>
    );
}

export default function ItemPreviewPage() {
    return (
        <Suspense fallback={
            <div className="h-full flex items-center justify-center bg-[#F0F2F5]">
                <p className="text-gray-500 text-sm">Loading preview…</p>
            </div>
        }>
            <ItemPreviewContent />
        </Suspense>
    );
}
