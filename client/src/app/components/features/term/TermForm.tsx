import { useMemo } from 'react';
import { LeftColumn } from './LeftColumn';
import { MiddleColumn } from './MiddleColumn';
import { RightColumn } from './RightColumn';
import { useTermCalculation } from './hooks/useTermCalculation';
import type {
  CreateTermAttachmentInput,
  TermAttachmentItem,
  TermCalcResults,
  TermFormData,
  TermStageStatus,
  UpdateTermFormData,
} from '../../../types/term_form.types';

interface TermFormProps {
  mode: 'new' | 'view' | 'edit';
  formData: TermFormData;
  updateFormData: UpdateTermFormData;
  calcResults: TermCalcResults;
  setCalcResults: (results: TermCalcResults) => void;
  setStageStatus: (status: TermStageStatus) => void;
  attachments?: TermAttachmentItem[];
  currencies: Array<{ code: string; name: string; exRate: number }>;
  freightTypes: Array<{ code: string; name: string; rate: number }>;
  salesPersons: string[];
  uoms: Array<{ value: string; label: string }>;
  onAddAttachment?: (input: CreateTermAttachmentInput) => Promise<void>;
  onDeleteAttachment?: (attachmentId: string) => Promise<void>;
}

export function TermForm({
  mode,
  formData,
  updateFormData,
  calcResults,
  setCalcResults,
  setStageStatus,
  attachments,
  currencies,
  freightTypes,
  salesPersons,
  uoms,
  onAddAttachment,
  onDeleteAttachment,
}: TermFormProps) {
  const isReadOnly = mode === 'view';
  const leftColumnFormData = useMemo(
    () => ({
      prodCost: formData.prodCost,
      pkh: formData.pkh,
      soc: formData.soc,
      currency: formData.currency,
      exRate: formData.exRate,
      shipMode: formData.shipMode,
      dimUnit: formData.dimUnit,
      length: formData.length,
      width: formData.width,
      height: formData.height,
      weight: formData.weight,
      cWeight: formData.cWeight,
      freightType: formData.freightType,
      freightRate: formData.freightRate,
      wireTT: formData.wireTT,
      customClear: formData.customClear,
      scc: formData.scc,
      stockFeePercent: formData.stockFeePercent,
      remark: formData.remark,
    }),
    [
      formData.prodCost,
      formData.pkh,
      formData.soc,
      formData.currency,
      formData.exRate,
      formData.shipMode,
      formData.dimUnit,
      formData.length,
      formData.width,
      formData.height,
      formData.weight,
      formData.cWeight,
      formData.freightType,
      formData.freightRate,
      formData.wireTT,
      formData.customClear,
      formData.scc,
      formData.stockFeePercent,
      formData.remark,
    ]
  );
  const middleColumnFormData = useMemo(
    () => ({
      purchaseTerm: formData.purchaseTerm,
      shipMode: formData.shipMode,
      insPercent: formData.insPercent,
      fr: formData.fr,
      zoneRate: formData.zoneRate,
      dutyPercent: formData.dutyPercent,
      miscTax: formData.miscTax,
      excisePercent: formData.excisePercent,
      leadTime: formData.leadTime,
      moq: formData.moq,
      vendorBPA: formData.vendorBPA,
      salesPerson: formData.salesPerson,
      sourcedBy: formData.sourcedBy,
      updatedBy: formData.updatedBy,
      updatedDate: formData.updatedDate,
    }),
    [
      formData.purchaseTerm,
      formData.shipMode,
      formData.insPercent,
      formData.fr,
      formData.zoneRate,
      formData.dutyPercent,
      formData.miscTax,
      formData.excisePercent,
      formData.leadTime,
      formData.moq,
      formData.vendorBPA,
      formData.salesPerson,
      formData.sourcedBy,
      formData.updatedBy,
      formData.updatedDate,
    ]
  );
  const rightColumnFormData = useMemo(
    () => ({
      purchaseUOM: formData.purchaseUOM,
      numInBuy: formData.numInBuy,
      stockUOM: formData.stockUOM,
      numInSale: formData.numInSale,
      salesUOM: formData.salesUOM,
      spk: formData.spk,
      qoc: formData.qoc,
      markup: formData.markup,
    }),
    [
      formData.purchaseUOM,
      formData.numInBuy,
      formData.stockUOM,
      formData.numInSale,
      formData.salesUOM,
      formData.spk,
      formData.qoc,
      formData.markup,
    ]
  );

  useTermCalculation({
    formData,
    setCalcResults,
    setStageStatus,
    enabled: !isReadOnly,
  });

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 items-stretch gap-4 p-5 bg-[#F0F2F5]">
      <LeftColumn
        formData={leftColumnFormData}
        updateFormData={updateFormData}
        isReadOnly={isReadOnly}
        calcResults={calcResults}
        currencies={currencies}
        freightTypes={freightTypes}
      />
      <MiddleColumn
        formData={middleColumnFormData}
        updateFormData={updateFormData}
        isReadOnly={isReadOnly}
        calcResults={calcResults}
        salesPersons={salesPersons}
      />
      <RightColumn
        formData={rightColumnFormData}
        updateFormData={updateFormData}
        isReadOnly={isReadOnly}
        calcResults={calcResults}
        attachments={attachments}
        uomOptions={uoms}
        onAddAttachment={onAddAttachment}
        onDeleteAttachment={onDeleteAttachment}
      />
    </div>
  );
}
