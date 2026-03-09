import { memo, useId, useMemo } from 'react';
import { format } from 'date-fns';
import { NumberInput } from '../../common/NumberInput';
import { InlineSelect } from '../../common/InlineSelect';
import type { TermCalcResults, TermFormData, TermSalesPersonOption, UpdateTermFormData } from '../../../types/term_form.types';

interface MiddleColumnProps {
  formData: MiddleColumnFormData;
  updateFormData: UpdateTermFormData;
  isReadOnly: boolean;
  calcResults: TermCalcResults;
  salesPersons: TermSalesPersonOption[];
}

type MiddleColumnFormData = Pick<
  TermFormData,
  | 'purchaseTerm'
  | 'shipMode'
  | 'insPercent'
  | 'fr'
  | 'zoneRate'
  | 'dutyPercent'
  | 'miscTax'
  | 'excisePercent'
  | 'leadTime'
  | 'moq'
  | 'vendorBPA'
  | 'salesPerson'
  | 'salesPersonName'
  | 'sourcedBy'
  | 'sourcedByName'
  | 'updatedBy'
  | 'updatedDate'
>;

const f = 'focus:outline-none focus:border-term-red focus:ring-1 focus:ring-term-red disabled:bg-white disabled:text-gray-500 enabled:border-gray-500';
const DUTY_OPTIONS = [0, 1, 3, 5, 10, 15, 20, 25, 30, 40, 50, 1000];
const moneyFormatter = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const ensureOption = (list: TermSalesPersonOption[], code: string, name: string): TermSalesPersonOption[] => {
  const normalizedCode = String(code || '').trim();
  if (!normalizedCode) return list;
  return list.some((row) => row.code === normalizedCode)
    ? list
    : [{ code: normalizedCode, name: String(name || '').trim() || normalizedCode, active: 'Y' }, ...list];
};

function CalcRow({
  label,
  value,
  highlight,
  labelClass,
  isWhite,
  isSans,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  labelClass?: string;
  isWhite?: boolean;
  isSans?: boolean;
}) {
  const fieldId = useId();
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
      <label htmlFor={fieldId} className={`text-xs text-left text-gray-700 whitespace-nowrap flex-1 ${labelClass || 'sm:text-right'}`}>{label}</label>
      <input
        id={fieldId}
        name={fieldId}
        type="text"
        value={value}
        readOnly
        className={`w-full sm:w-[160px] px-2 py-1.5 border rounded text-sm text-right ${isSans ? '' : 'font-mono'} ${
          highlight
            ? 'border-term-red bg-red-50 font-bold text-gray-900'
            : isWhite
              ? 'border-gray-300 bg-white text-gray-900'
              : 'border-gray-300 bg-gray-200 text-gray-900'
        }`}
      />
    </div>
  );
}

export const MiddleColumn = memo(function MiddleColumn({
  formData,
  updateFormData,
  isReadOnly,
  calcResults,
  salesPersons,
}: MiddleColumnProps) {
  const idBase = useId();
  const fmt = (v: number) => moneyFormatter.format(v);
  const salesPersonOptions = useMemo(
    () => ensureOption(salesPersons, formData.salesPerson || '', formData.salesPersonName || ''),
    [formData.salesPerson, formData.salesPersonName, salesPersons]
  );
  const sourcedByOptions = useMemo(
    () => ensureOption(salesPersons, formData.sourcedBy || '', formData.sourcedByName || ''),
    [formData.sourcedBy, formData.sourcedByName, salesPersons]
  );
  const shouldShowZoneRate = useMemo(() => {
    const purchaseTerm = String(formData.purchaseTerm || '').trim().toUpperCase();
    const shipModeNo = Number(formData.shipMode);
    const isEligibleTerm = purchaseTerm === 'EXWORK' || purchaseTerm === 'FCA';
    return isEligibleTerm && (shipModeNo === 3 || shipModeNo === 6);
  }, [formData.purchaseTerm, formData.shipMode]);
  const ids = useMemo(
    () => ({
      insPercent: `${idBase}-insPercent`,
      insAmount: `${idBase}-insAmount`,
      fr: `${idBase}-fr`,
      zoneRate: `${idBase}-zoneRate`,
      dutyPercent: `${idBase}-dutyPercent`,
      miscTax: `${idBase}-miscTax`,
      excisePercent: `${idBase}-excisePercent`,
      leadTime: `${idBase}-leadTime`,
      moq: `${idBase}-moq`,
      salesPerson: `${idBase}-salesPerson`,
      sourcedBy: `${idBase}-sourcedBy`,
      vendorBpa: `${idBase}-vendorBpa`,
    }),
    [idBase]
  );
  const inlineSelectCls = `flex-1 w-full sm:w-[180px] px-2 py-1 border border-gray-300 rounded text-sm bg-white ${f} disabled:opacity-100 disabled:bg-gray-200 disabled:text-gray-900`;

  return (
    <div className="flex flex-col gap-4 h-full min-h-0">
      <div className="border border-term-red rounded-md overflow-hidden shadow-sm">
        <div className="bg-term-red px-3 py-2">
          <span className="text-base font-bold text-white tracking-wide">CIF Price (CIF)</span>
        </div>
        <div className="p-5 space-y-2 bg-white">
          <CalcRow label="Order Price (OP2)" value={fmt(calcResults.OP2_THB)} />

          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
            <label htmlFor={ids.insPercent} className="text-xs text-left sm:text-right text-gray-700 whitespace-nowrap flex-1">Insurance (INS)</label>
            <div className="flex items-center gap-1 w-full sm:w-[160px] flex-none justify-end">
              <NumberInput
                id={ids.insPercent}
                value={formData.insPercent}
                onChange={(v) => updateFormData('insPercent', v)}
                className={`w-[55px] px-1.5 py-1 border border-gray-300 rounded text-xs bg-white text-right ${f}`}
                disabled={isReadOnly}
                zeroAsInteger
                precision={0}
              />
              <span className="text-[10px] text-gray-500">%</span>
              <input
                id={ids.insAmount}
                name="insuranceAmount"
                type="text"
                value={fmt(calcResults.INS)}
                readOnly
                aria-label="Insurance amount"
                className="w-[85px] px-2 py-1.5 border border-gray-300 rounded text-sm bg-gray-200 font-mono text-right text-gray-900"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
            <label htmlFor={ids.fr} className="text-xs text-left sm:text-right text-gray-700 whitespace-nowrap flex-1">Freight (FR)</label>
            <NumberInput
              id={ids.fr}
              value={formData.fr}
              onChange={(val) => updateFormData('fr', val)}
              className={`w-full sm:w-[160px] px-2 py-1.5 border border-gray-300 rounded text-sm bg-white text-right ${f}`}
              disabled={isReadOnly}
            />
          </div>
          <CalcRow label="CIF Price (THB) =" value={fmt(calcResults.CIF)} highlight />

          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
            <label htmlFor={ids.zoneRate} className="text-xs text-left sm:text-right text-gray-700 whitespace-nowrap flex-1">Zone Rate (THB/KG)</label>
            <input
              id={ids.zoneRate}
              type="text"
              value={fmt(shouldShowZoneRate ? (formData.zoneRate || 0) : 0)}
              readOnly
              className="w-full sm:w-[160px] px-2 py-1.5 border border-gray-300 rounded text-sm bg-gray-200 font-mono text-gray-900 text-right"
            />
          </div>
          <CalcRow label="Freight (FR) (Zone)" value={fmt(calcResults.FR_ZONE || 0)} />
          <CalcRow label="CIF Price (Zone)(THB) =" value={fmt(calcResults.CIF_ZONE || 0)} />
        </div>
      </div>

      <div className="border border-term-red rounded-md overflow-hidden shadow-sm">
        <div className="bg-term-red px-3 py-2">
          <span className="text-base font-bold text-white tracking-wide">Import Duty (DT)</span>
        </div>
        <div className="p-3 space-y-2 bg-white">
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-gray-700">Duty</p>
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5 mb-2">
              {DUTY_OPTIONS.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => updateFormData('dutyPercent', v)}
                  disabled={isReadOnly}
                  className={`h-8 px-2 rounded text-xs font-semibold transition-colors ${
                    formData.dutyPercent === v
                      ? 'bg-term-red text-white'
                      : isReadOnly
                        ? 'bg-gray-100 text-gray-400'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {v}%
                </button>
              ))}
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
              <label htmlFor={ids.dutyPercent} className="text-xs text-left sm:text-right text-gray-700 whitespace-nowrap flex-1">Duty %</label>
              <input
                id={ids.dutyPercent}
                type="text"
                value={`${Number(formData.dutyPercent || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`}
                readOnly
                className="w-full sm:w-[160px] px-2 py-1.5 border border-gray-300 rounded text-sm bg-gray-200 font-mono text-gray-900 text-right"
              />
            </div>
          </div>
          <CalcRow label="Duty Tax (DT)(FR)(THB)" value={fmt(calcResults.DT)} />
          <CalcRow label="Duty Tax (DT Zone)(THB)" value={fmt(calcResults.DT_ZONE)} />
          <CalcRow label="Duty Tax (DT)(THB)" value={fmt(calcResults.DT)} highlight />
        </div>
      </div>

      <div className="border border-term-red rounded-md overflow-hidden shadow-sm">
        <div className="bg-term-red px-3 py-2 flex items-center justify-between">
          <span className="text-base font-bold text-white tracking-wide">Excise Tax (ET)</span>
        </div>
        <div className="p-3 space-y-2 bg-white">
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
            <label htmlFor={ids.miscTax} className="text-xs text-left sm:text-right text-gray-700 whitespace-nowrap flex-1">Misc Tax (ETC) (THB)</label>
            <NumberInput
              id={ids.miscTax}
              value={formData.miscTax}
              onChange={(v) => updateFormData('miscTax', v)}
              disabled={isReadOnly}
              className={`w-full sm:w-[160px] px-2 py-1.5 border border-gray-300 rounded text-sm bg-white text-right ${f}`}
            />
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
            <label htmlFor={ids.excisePercent} className="text-xs text-left sm:text-right text-gray-700 whitespace-nowrap flex-1">Excise Tax (%ET)</label>
            <NumberInput
              id={ids.excisePercent}
              value={formData.excisePercent}
              onChange={(v) => updateFormData('excisePercent', v)}
              disabled={isReadOnly}
              className={`w-full sm:w-[160px] px-2 py-1.5 border border-gray-300 rounded text-sm bg-white text-right ${f}`}
            />
          </div>
          <CalcRow label="Excise Tax (ET)(THB)" value={fmt(calcResults.ET)} highlight />
        </div>
      </div>

      <div className="border border-term-red rounded-md overflow-hidden shadow-sm">
        <div className="bg-term-red px-3 py-2 flex items-center justify-between">
          <span className="text-base font-bold text-white tracking-wide">Municipal Tax (MT)</span>
        </div>
        <div className="p-3 space-y-2 bg-white">
          <CalcRow label="Municipal Tax (MT 10%)" value={fmt(calcResults.MT)} highlight />
          <div className="text-xs text-gray-500 text-left sm:text-right">= DT + ETC + ET + MT</div>
        </div>
      </div>

      <div className="border border-term-red rounded-md overflow-hidden shadow-sm">
        <div className="bg-term-red px-3 py-2">
          <span className="text-base font-bold text-white tracking-wide">Logistics</span>
        </div>
        <div className="p-3 bg-white">
          <div className="grid grid-cols-[minmax(0,1fr)_90px_minmax(0,1fr)_90px] items-center gap-2">
            <label htmlFor={ids.leadTime} className="min-w-0 text-xs text-gray-700 font-medium leading-tight">L/T (Days)</label>
            <input
              id={ids.leadTime}
              value={formData.leadTime}
              onChange={(e) => updateFormData('leadTime', e.target.value)}
              disabled={isReadOnly}
              type="text"
              maxLength={5}
              className={`w-full px-2 py-1 border border-gray-300 rounded text-xs bg-white text-center ${f}`}
            />
            <label htmlFor={ids.moq} className="min-w-0 text-xs text-gray-700 font-medium leading-tight">MOQ/MOV</label>
            <input
              id={ids.moq}
              value={formData.moq}
              onChange={(e) => updateFormData('moq', e.target.value)}
              disabled={isReadOnly}
              type="text"
              className={`w-full px-2 py-1 border border-gray-300 rounded text-xs bg-white text-center ${f}`}
            />
          </div>
        </div>
      </div>

      <div className="border-2 border-term-red rounded-md overflow-hidden shadow-md">
        <div className="bg-white px-3 py-2 text-center border-b border-term-red">
          <span className="text-sm font-bold text-gray-900">QTEC W/H COST (QLC)</span>
        </div>
        <div className="bg-gradient-to-r from-[#C12B2B] to-[#F58300] text-white text-center py-4">
          <span className="text-2xl font-bold font-mono tracking-wide">{fmt(calcResults.QLC)}</span>
          <span className="text-xs ml-2 opacity-80">THB</span>
        </div>
      </div>

      <div className="border border-term-red rounded-md overflow-hidden shadow-sm">
        <div className="bg-term-red px-3 py-2 flex items-center justify-between">
          <span className="text-base font-bold text-white tracking-wide">Additional Info</span>
          <label className={`flex items-center gap-1.5 text-xs text-white ${isReadOnly ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'}`}>
            <input
              id={ids.vendorBpa}
              type="checkbox"
              checked={formData.vendorBPA || false}
              disabled={isReadOnly}
              onChange={(e) => updateFormData('vendorBPA', e.target.checked)}
              className="w-3.5 h-3.5"
            />
            Is Vendor BPA/Any Agreement?
          </label>
        </div>
        <div className="p-3 space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
            <label htmlFor={ids.salesPerson} className="text-xs text-left sm:text-right text-gray-700 w-full sm:w-[80px] font-medium">Call By</label>
            <InlineSelect
              id={ids.salesPerson}
              value={formData.salesPerson || ''}
              onValueChange={(nextCode) => {
                const nextSalesPerson = salesPersonOptions.find((row) => row.code === nextCode);
                updateFormData('salesPerson', nextCode);
                updateFormData('salesPersonName', nextSalesPerson?.name || '');
              }}
              disabled={isReadOnly}
              placeholder="- Please Select -"
              allowClear
              size="sm"
              className={inlineSelectCls}
              options={salesPersonOptions.map((row) => ({ value: row.code, label: row.name }))}
            />
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
            <label htmlFor={ids.sourcedBy} className="text-xs text-left sm:text-right text-gray-700 w-full sm:w-[80px] font-medium">Sourced By</label>
            <InlineSelect
              id={ids.sourcedBy}
              value={formData.sourcedBy || ''}
              onValueChange={(nextCode) => {
                const nextSalesPerson = sourcedByOptions.find((row) => row.code === nextCode);
                updateFormData('sourcedBy', nextCode);
                updateFormData('sourcedByName', nextSalesPerson?.name || '');
              }}
              disabled={isReadOnly}
              placeholder="- Please Select -"
              allowClear
              size="sm"
              className={inlineSelectCls}
              options={sourcedByOptions.map((row) => ({ value: row.code, label: row.name }))}
            />
          </div>
        </div>
      </div>

      <div className="border border-term-red rounded-md overflow-hidden shadow-sm">
        <div className="bg-term-red px-3 py-2">
          <span className="text-base font-bold text-white tracking-wide">Updated By</span>
        </div>
        <div className="px-3 py-2 flex items-center justify-between">
          <span className="text-sm text-gray-800 font-medium">{formData.updatedBy || '-'}</span>
          <span className="text-xs text-gray-500">
            {formData.updatedDate ? format(new Date(formData.updatedDate), 'dd-MMM-yyyy HH:mm:ss') : ''}
          </span>
        </div>
      </div>
    </div>
  );
});
