import { useEffect, useMemo, useRef } from 'react';
import { termApi } from '../../../../services/term.api';
import type {
    TermCalcResults,
    TermCalculationPayload,
    TermCalculationResponse,
    TermFormData,
    TermStageStatus,
} from '../../../../types/term_form.types';
import {
    buildTermCalculationPayload,
    deriveTermStageStatus,
    mapCalculationResponseToUi,
} from '../mappers/term-calculation.mapper';
import { clientLogger } from '../../../../utils/logger';

interface UseTermCalculationParams {
    formData: TermFormData;
    setCalcResults: (results: TermCalcResults) => void;
    setStageStatus: (status: TermStageStatus) => void;
    enabled?: boolean;
    debounceMs?: number;
}

export function useTermCalculation({
    formData,
    setCalcResults,
    setStageStatus,
    enabled = true,
    debounceMs = 250,
}: UseTermCalculationParams): void {
    const requestSeqRef = useRef(0);
    const lastPayloadKeyRef = useRef<string>('');
    const latestCalculatedRef = useRef<TermCalculationResponse | null>(null);

    const payload = useMemo<TermCalculationPayload>(
        () => buildTermCalculationPayload(formData),
        [
            formData.prodCost,
            formData.pkh,
            formData.soc,
            formData.exRate,
            formData.purchaseTerm,
            formData.shipMode,
            formData.dimUnit,
            formData.length,
            formData.width,
            formData.height,
            formData.weight,
            formData.freightRate,
            formData.fr,
            formData.insPercent,
            formData.zoneRate,
            formData.dutyPercent,
            formData.excisePercent,
            formData.miscTax,
            formData.wireTT,
            formData.customClear,
            formData.scc,
            formData.stockFeePercent,
            formData.spk,
            formData.qoc,
            formData.markup,
            formData.numInBuy,
            formData.numInSale,
        ]
    );
    const payloadKey = useMemo(() => JSON.stringify(payload), [payload]);

    useEffect(() => {
        if (!enabled) return;

        const cachedCalculated = latestCalculatedRef.current;
        const canReuseCachedCalculation =
            cachedCalculated !== null &&
            lastPayloadKeyRef.current === payloadKey;

        if (canReuseCachedCalculation) {
            setStageStatus(
                deriveTermStageStatus(cachedCalculated, payload, formData.currency, {
                    purchaseUOM: formData.purchaseUOM,
                    salesUOM: formData.salesUOM,
                })
            );
            return;
        }

        const currentSeq = ++requestSeqRef.current;
        const controller = new AbortController();

        const timerId = window.setTimeout(async () => {
            try {
                const calculated = await termApi.previewCalculation(payload, {
                    signal: controller.signal,
                });

                if (currentSeq !== requestSeqRef.current) return;

                latestCalculatedRef.current = calculated;
                lastPayloadKeyRef.current = payloadKey;
                setCalcResults(mapCalculationResponseToUi(calculated));
                setStageStatus(
                    deriveTermStageStatus(calculated, payload, formData.currency, {
                        purchaseUOM: formData.purchaseUOM,
                        salesUOM: formData.salesUOM,
                    })
                );
            } catch (error) {
                if (controller.signal.aborted || currentSeq !== requestSeqRef.current) return;
                clientLogger.error('Failed to preview term calculation', error);
            }
        }, debounceMs);

        return () => {
            window.clearTimeout(timerId);
            controller.abort();
        };
    }, [
        debounceMs,
        enabled,
        formData.currency,
        formData.purchaseUOM,
        formData.salesUOM,
        payload,
        payloadKey,
        setCalcResults,
        setStageStatus,
    ]);
}
