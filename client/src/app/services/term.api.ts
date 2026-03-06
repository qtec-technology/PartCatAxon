import { TermItem } from '../types/partcatalog_types';
import type { TermCalculationPayload, TermCalculationResponse } from '../types/term_form.types';
import { requestJson } from './http';

export const termApi = {
    getTermsByItemId: async (itemId: number | string): Promise<TermItem[]> => {
        const parsedItemId = Number(itemId);
        if (Number.isNaN(parsedItemId)) return [];
        const payload = await requestJson<TermItem[]>(`/api/terms?itemId=${parsedItemId}`);
        return payload.data || [];
    },

    getTerms: async (itemId: number | string): Promise<{ success: true; data: TermItem[] }> => {
        const data = await termApi.getTermsByItemId(itemId);
        return { success: true, data };
    },

    getTermById: async (id: number | string): Promise<Record<string, unknown>> => {
        const termId = Number(id);
        if (Number.isNaN(termId)) {
            throw new Error('Invalid TermID');
        }
        const payload = await requestJson<Record<string, unknown>>(`/api/terms/${termId}`);
        return payload.data;
    },

    getMasterFG: async (itemId: number | string): Promise<{ success: true; data: boolean }> => {
        const parsedItemId = Number(itemId);
        if (Number.isNaN(parsedItemId)) {
            return { success: true, data: false };
        }
        const payload = await requestJson<{ masterFG: boolean }>(`/api/terms/master-fg/${parsedItemId}`);
        return { success: true, data: payload.data?.masterFG === true };
    },

    previewCalculation: async (
        data: TermCalculationPayload,
        options?: { signal?: AbortSignal }
    ): Promise<TermCalculationResponse> => {
        const payload = await requestJson<TermCalculationResponse>('/api/terms/calculate', {
            method: 'POST',
            body: data,
            signal: options?.signal,
        });
        return payload.data;
    },

    getCWeightByVendorStockItemNo: async (
        vendorStockItemNo: string,
        options?: { signal?: AbortSignal }
    ): Promise<number> => {
        const normalized = String(vendorStockItemNo || '').trim();
        if (!normalized) return 0;
        const query = new URLSearchParams({ vendorStockItemNo: normalized });
        const payload = await requestJson<{ cWeight?: number | string }>(`/api/terms/cweight?${query.toString()}`, {
            signal: options?.signal,
        });
        const parsed = Number(payload.data?.cWeight ?? 0);
        return Number.isFinite(parsed) ? parsed : 0;
    },

    /** Get vendor email + pre-built mailto URL for RFQ */
    getVendorEmail: async (termId: number | string): Promise<{
        email: string | null;
        mailtoUrl: string | null;
        contactName: string | null;
    }> => {
        const id = Number(termId);
        if (Number.isNaN(id)) throw new Error('Invalid TermID');
        const payload = await requestJson<{
            email: string | null;
            mailtoUrl: string | null;
            contactName: string | null;
        }>(`/api/terms/${id}/vendor-email`);
        return payload.data;
    },

    createTerm: async (data: Record<string, unknown>): Promise<{ TermID: number }> => {
        const payload = await requestJson<{ TermID: number }>('/api/terms', {
            method: 'POST',
            body: data,
        });
        return payload.data;
    },

    updateTerm: async (id: number | string, data: Record<string, unknown>): Promise<void> => {
        await requestJson(`/api/terms/${id}`, {
            method: 'PUT',
            body: data,
        });
    },

    deleteTerm: async (id: number | string, confirmText: string = 'DELETE'): Promise<void> => {
        const termId = Number(id);
        if (Number.isNaN(termId) || termId <= 0) {
            throw new Error('Invalid TermID');
        }

        await requestJson<null>(`/api/terms/${termId}`, {
            method: 'DELETE',
            body: {
                confirmText,
                confirmTermId: termId,
            },
        });
    },
};
