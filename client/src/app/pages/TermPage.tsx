import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../auth/AuthContext';
import { termApi } from '../services/term.api';
import { TermHeader } from '../components/features/term/TermHeader';
import { TermInfoRow } from '../components/features/term/TermInfoRow';
import { StageIndicators } from '../components/features/term/StageIndicators';
import { TermForm } from '../components/features/term/TermForm';
import { useTermPageData } from '../components/features/term/hooks/useTermPageData';
import { deriveStageStatusFromUiResults } from '../components/features/term/mappers/term-calculation.mapper';
import { featureFlags } from '../config/feature-flags';
import type { TermCalcResults, TermFormData, TermStageStatus } from '../types/term_form.types';
import { defaultTermCalcResults, defaultTermStageStatus } from '../types/term_form.types';
import { canDeleteOwnedRecord } from '../utils/delete-permission';

interface TermFormPageProps {
    mode: 'new' | 'view' | 'edit';
}

const parseNullableInt = (value: unknown): number | null => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
};

/**
 * Map frontend TermFormData → API payload (matching CreateTermDTO on server).
 */
function mapFormDataToApiPayload(formData: TermFormData, itemId?: number): Record<string, unknown> {
    return {
        ...(itemId != null ? { ItemID: itemId } : {}),
        VendorCode: formData.supplier || '',
        VendorStockItemNo: formData.suppOrderCode || '',
        U_OrderTerm: formData.purchaseTerm || '',
        U_TermLocation: formData.purchaseTermLocation || '',
        SubLocation: formData.purchaseSubLocation || '',
        U_ProdCost: Number(formData.prodCost) || 0,
        U_PurCurr: formData.currency || '',
        U_PurRate: Number(formData.exRate) || 1,
        U_PKH: Number(formData.pkh) || 0,
        U_SOC: Number(formData.soc) || 0,
        U_ShipModeNo: Number(formData.shipMode) || -1,
        U_DimUnitNo: Number(formData.dimUnit) || 1,
        U_Length: Number(formData.length) || 0,
        U_Width: Number(formData.width) || 0,
        U_Height: Number(formData.height) || 0,
        U_Weight: Number(formData.weight) || 0,
        U_FreightType: formData.freightType || '',
        U_FreightRate: Number(formData.freightRate) || 0,
        U_FR: Number(formData.fr) || 0,
        INS_Percent: Number(formData.insPercent) || 0,
        U_ZoneRate: Number(formData.zoneRate) || 0,
        U_DT_Percent: Number(formData.dutyPercent) || 0,
        U_ETPer: Number(formData.excisePercent) || 0,
        U_MiscTax: Number(formData.miscTax) || 0,
        U_WTT: Number(formData.wireTT) || 0,
        U_CC: Number(formData.customClear) || 0,
        U_ASP: Number(formData.scc) || 0,
        U_STK_Percent: Number(formData.stockFeePercent) || 0,
        U_SPK: Number(formData.spk) || 0,
        U_QOC: Number(formData.qoc) || 0,
        U_MK_Percent: Number(formData.markup) || 0,
        BuyUnitMsr: formData.purchaseUOM || '',
        NumInBuy: Number(formData.numInBuy) || 1,
        SalUnitMsr: formData.salesUOM || '',
        NumInSale: Number(formData.numInSale) || 1,
        U_MOQ: formData.moq || '',
        LeadTime: formData.leadTime || '',
        U_VendorBPA: formData.vendorBPA ? 'Y' : '',
        CntctCode: parseNullableInt(formData.contactPerson),
        SlpCode: parseNullableInt(formData.salesPerson),
        SlpSprtCode: parseNullableInt(formData.sourcedBy),
        U_ValidFrom: formData.validFrom || null,
        U_ValidTo: formData.validTo || null,
        U_SalesTerm: formData.salesTerm || '',
        U_Remark: formData.remark || '',
        SaleSubLocation: formData.salesSubLocation || '',
        Active: formData.active !== false,
        ContractNo: formData.contractNo || '',
    };
}

export default function TermPage({ mode: initialMode }: TermFormPageProps) {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { id } = useParams<{ id: string }>();
    const [searchParams] = useSearchParams();
    const readOnlyMode = featureFlags.readOnlyMode;
    const sourceItemId = searchParams.get('itemId') || undefined;

    const [mode, setMode] = useState<'new' | 'view' | 'edit'>(initialMode);
    const [calcResults, setCalcResults] = useState<TermCalcResults>(defaultTermCalcResults);
    const [stageStatus, setStageStatus] = useState<TermStageStatus>(defaultTermStageStatus);
    const [isSendingRfq, setIsSendingRfq] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        if (readOnlyMode && initialMode !== 'view') {
            toast.info('Read-only phase: edit/create is disabled');
            if (initialMode === 'edit' && id) {
                navigate(`/term/${id}`);
            } else {
                navigate('/');
            }
            return;
        }
    }, [id, initialMode, navigate, readOnlyMode]);

    const effectiveMode = mode;

    const {
        isInitialLoading,
        itemCode,
        itemDesc,
        formData,
        storedCalcResults,
        attachments,
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
        updateFormData,
        refreshCWeightBySuppOrderCode,
        handleSupplierChange,
        createTermAttachment,
        deleteTermAttachment,
    } = useTermPageData({
        id,
        sourceItemId,
        mode: effectiveMode,
        readOnlyMode,
    });

    useEffect(() => {
        if (effectiveMode !== 'view') return;

        setCalcResults(storedCalcResults);
        setStageStatus(deriveStageStatusFromUiResults(storedCalcResults, {
            currency: formData.currency,
            excisePercent: formData.excisePercent,
            purchaseUOM: formData.purchaseUOM,
            salesUOM: formData.salesUOM,
        }));
    }, [
        effectiveMode,
        formData.currency,
        formData.excisePercent,
        formData.purchaseUOM,
        formData.salesUOM,
        storedCalcResults,
    ]);

    const handleSave = useCallback(async () => {
        if (readOnlyMode) {
            toast.info('Read-only phase: save is disabled');
            return;
        }
        if (isSaving) return;

        setIsSaving(true);
        try {
            if (effectiveMode === 'new') {
                const parsedItemId = sourceItemId ? Number(sourceItemId) : NaN;
                if (!Number.isFinite(parsedItemId) || parsedItemId <= 0) {
                    toast.error('Cannot save: missing source ItemID');
                    return;
                }
                const payload = mapFormDataToApiPayload(formData, parsedItemId);
                const result = await termApi.createTerm(payload);
                toast.success(`Term created (ID: ${result.TermID})`);
                navigate(`/term/${result.TermID}`, { replace: true });
            } else if (effectiveMode === 'edit' && id) {
                const payload = mapFormDataToApiPayload(formData);
                await termApi.updateTerm(id, payload);
                toast.success('Term updated successfully');
                setMode('view');
            }
        } catch (err: any) {
            toast.error(err?.message || 'Failed to save term');
        } finally {
            setIsSaving(false);
        }
    }, [effectiveMode, formData, id, isSaving, navigate, readOnlyMode, sourceItemId]);

    const handleExit = () => {
        navigate('/');
    };

    const handleBack = () => navigate('/');
    const handleEdit = () => {
        setMode('edit');
    };
    const handleCancel = () => {
        setMode('view');
    };
    const handleDelete = useCallback(async () => {
        if (readOnlyMode) {
            toast.info('Read-only phase: delete is disabled');
            return;
        }
        if (isDeleting) return;

        const termId = Number(id);
        if (!Number.isFinite(termId) || termId <= 0) {
            toast.error('Invalid TermID');
            return;
        }

        const firstConfirmed = window.confirm(
            `Delete term "${termId}"? This action cannot be undone.`
        );
        if (!firstConfirmed) return;

        const secondConfirmText = String(
            window.prompt('Type DELETE to confirm permanently deleting this term.', '') || ''
        ).trim().toUpperCase();

        if (secondConfirmText !== 'DELETE') {
            toast.warning('Delete canceled: confirmation text did not match');
            return;
        }

        try {
            setIsDeleting(true);
            await termApi.deleteTerm(termId, secondConfirmText);
            toast.success('Term deleted successfully');
            navigate('/');
        } catch (err: any) {
            toast.error(err?.message || 'Failed to delete term');
        } finally {
            setIsDeleting(false);
        }
    }, [id, isDeleting, navigate, readOnlyMode]);
    const handlePrint = () => {
        window.print();
    };

    const canDeleteTermRecord = canDeleteOwnedRecord(formData.updatedBy, user);

    const handleSendRfq = async () => {
        if (!id) return;
        setIsSendingRfq(true);
        try {
            const result = await termApi.getVendorEmail(id);
            // Server always provides mailtoUrl (empty To if no vendor email)
            window.location.href = result.mailtoUrl!;
        } catch (err: any) {
            toast.error(err?.message || 'Failed to get vendor email');
        } finally {
            setIsSendingRfq(false);
        }
    };

    if (isInitialLoading) {
        return (
            <div
                className="h-full bg-[#F0F2F5] flex items-center justify-center"
                role="status"
                aria-live="polite"
                aria-busy="true"
            >
                <div className="flex items-center gap-2 text-term-blue font-semibold">
                    <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
                    <span>Loading term data...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full overflow-y-auto bg-[#F0F2F5] font-sans text-gray-900">
            <TermHeader
                mode={effectiveMode}
                itemCode={itemCode}
                onSave={handleSave}
                onExit={handleExit}
                onBack={handleBack}
                onEdit={handleEdit}
                onCancel={handleCancel}
                onDelete={handleDelete}
                onPrint={handlePrint}
                onSendRfq={handleSendRfq}
                isSendingRfq={isSendingRfq}
                disableMutations={readOnlyMode}
                disableEdit={false}
                disableDelete={isDeleting || isSaving || !canDeleteTermRecord}
                disableSave={isSaving}
            />
            <TermInfoRow
                itemCode={itemCode}
                itemDesc={itemDesc}
                formData={formData}
                updateFormData={updateFormData}
                isReadOnly={effectiveMode === 'view'}
                suppliers={suppliers}
                contacts={contacts}
                orderTerms={orderTerms}
                locations={locations}
                purchaseSubLocations={purchaseSubLocations}
                salesSubLocations={salesSubLocations}
                onSuppOrderCodeCommit={refreshCWeightBySuppOrderCode}
                onSupplierChange={handleSupplierChange}
            />
            <StageIndicators status={stageStatus} />
            <TermForm
                mode={effectiveMode}
                formData={formData}
                updateFormData={updateFormData}
                calcResults={calcResults}
                setCalcResults={setCalcResults}
                setStageStatus={setStageStatus}
                attachments={attachments}
                currencies={currencies}
                freightTypes={freightTypes}
                salesPersons={salesPersons}
                uoms={uomOptions}
                onAddAttachment={!readOnlyMode && effectiveMode === 'edit' ? createTermAttachment : undefined}
                onDeleteAttachment={!readOnlyMode && effectiveMode === 'edit' ? deleteTermAttachment : undefined}
            />
        </div>
    );
}
