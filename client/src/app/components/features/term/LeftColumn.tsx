import { memo, useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import type {
  TermCalcResults,
  TermCurrencyOption,
  TermFormData,
  TermFreightTypeOption,
  UpdateTermFormData,
} from '../../../types/term_form.types';
import { NumberInput } from '../../common/NumberInput';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';

interface LeftColumnProps {
  formData: LeftColumnFormData;
  updateFormData: UpdateTermFormData;
  isReadOnly: boolean;
  calcResults: TermCalcResults;
  currencies: TermCurrencyOption[];
  freightTypes: TermFreightTypeOption[];
}

type LeftColumnFormData = Pick<
  TermFormData,
  | 'prodCost'
  | 'pkh'
  | 'soc'
  | 'currency'
  | 'exRate'
  | 'shipMode'
  | 'dimUnit'
  | 'length'
  | 'width'
  | 'height'
  | 'weight'
  | 'cWeight'
  | 'freightType'
  | 'freightRate'
  | 'wireTT'
  | 'customClear'
  | 'scc'
  | 'stockFeePercent'
  | 'remark'
>;

const f = 'focus:outline-none focus:border-term-blue focus:ring-1 focus:ring-term-blue disabled:bg-white disabled:text-gray-500 enabled:border-gray-500';
const inputCls = `w-full sm:w-[160px] px-2 py-1.5 border border-gray-300 rounded text-sm bg-white ${f}`;
const readCls = 'w-full sm:w-[160px] px-2 py-1.5 border border-gray-300 rounded text-sm bg-gray-200 font-mono text-gray-900 text-right';

const SHIP_MODES = [
  { value: '1', label: 'Air Forwarder' },
  { value: '6', label: 'Air Courier' },
  { value: '2', label: 'Sea' },
  { value: '3', label: 'Truck' },
  { value: '4', label: 'QTEC-Motorcycle' },
  { value: '5', label: 'QTEC-Truck' },
];

const DIMENSION_UNITS = [
  { value: '1', label: 'CM' },
  { value: '2', label: 'INCH' },
];

const STOCK_FEE_OPTIONS = [0, 3, 5, 10, 15, 20, 25, 30];
const moneyFormatter = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const exchangeRateFormatter = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
const frLabelBaseCls = 'text-xs w-[140px] sm:w-[160px] text-left whitespace-nowrap shrink-0';
const frReadValueCls = 'flex-1 min-w-0 sm:flex-none sm:w-[160px] px-2 py-1.5 border border-gray-300 rounded text-sm bg-gray-200 font-mono text-gray-900 text-right';
const frMutedValueCls = 'flex-1 min-w-0 sm:flex-none sm:w-[160px] px-2 py-1.5 border border-gray-300 rounded text-sm bg-[#F5F5F5] font-mono text-gray-600 text-right';

const isNullCurrencyCode = (value: string) => {
  const normalized = String(value || '').trim().toUpperCase();
  return normalized === '_NULL' || normalized === 'NULL';
};

const fmtExRate = (value: number) => exchangeRateFormatter.format(Number(value || 0));

function FieldRow({
  label,
  children,
  required,
  labelClass,
  htmlFor,
}: {
  label: string;
  children: ReactNode;
  required?: boolean;
  labelClass?: string;
  htmlFor?: string;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
      {htmlFor ? (
        <label htmlFor={htmlFor} className={`text-xs whitespace-nowrap w-full sm:w-[140px] text-left sm:text-right ${required ? 'text-term-blue font-bold' : 'text-gray-700'} ${labelClass || ''}`}>
          {label}
          {required && ' *'}
        </label>
      ) : (
        <p className={`text-xs whitespace-nowrap w-full sm:w-[140px] text-left sm:text-right ${required ? 'text-term-blue font-bold' : 'text-gray-700'} ${labelClass || ''}`}>
          {label}
          {required && ' *'}
        </p>
      )}
      <div className="flex-1 w-full sm:w-auto">{children}</div>
    </div>
  );
}

export const LeftColumn = memo(function LeftColumn({
  formData,
  updateFormData,
  isReadOnly,
  calcResults,
  currencies,
  freightTypes,
}: LeftColumnProps) {
  const idBase = useId();
  const fmt = (v: number) => moneyFormatter.format(v);
  const ids = useMemo(
    () => ({
      prodCost: `${idBase}-prodCost`,
      pkh: `${idBase}-pkh`,
      soc: `${idBase}-soc`,
      op1Pcs: `${idBase}-op1Pcs`,
      op1Thb: `${idBase}-op1Thb`,
      exRate: `${idBase}-exRate`,
      length: `${idBase}-length`,
      width: `${idBase}-width`,
      height: `${idBase}-height`,
      dimWeight: `${idBase}-dimWeight`,
      weight: `${idBase}-weight`,
      cWeight: `${idBase}-cWeight`,
      shipWeight: `${idBase}-shipWeight`,
      frQtec: `${idBase}-frQtec`,
      freightType: `${idBase}-freightType`,
      wireTT: `${idBase}-wireTT`,
      customClear: `${idBase}-customClear`,
      scc: `${idBase}-scc`,
      preQlc: `${idBase}-preQlc`,
      stockFeePercent: `${idBase}-stockFeePercent`,
      stockFeeAmount: `${idBase}-stockFeeAmount`,
      remark: `${idBase}-remark`,
    }),
    [idBase]
  );
  const [currencyFlagLoadError, setCurrencyFlagLoadError] = useState(false);

  const shipModeOptions = useMemo(() => {
    const shipMode = String(formData.shipMode || '').trim();
    if (!shipMode || shipMode === '-1') return SHIP_MODES;
    const exists = SHIP_MODES.some((mode) => mode.value === shipMode);
    return exists ? SHIP_MODES : [{ value: shipMode, label: `Unknown (${shipMode})` }, ...SHIP_MODES];
  }, [formData.shipMode]);

  const freightOptions = useMemo(() => {
    const base = freightTypes
      .map((row) => ({
        value: String(row.code || row.name || '').trim(),
        name: String(row.name || row.code || '').trim(),
        rate: Number(row.rate || 0),
      }))
      .filter((row) => row.value !== '' && row.name !== '');

    if (!formData.freightType) return base;
    const exists = base.some((opt) => opt.value === formData.freightType);
    if (exists) return base;

    return [
      { value: formData.freightType, name: formData.freightType, rate: Number(formData.freightRate || 0) },
      ...base,
    ];
  }, [formData.freightRate, formData.freightType, freightTypes]);

  const currencyOptions = useMemo(() => {
    const base = currencies
      .map((row) => ({
        value: String(row.code || '').trim(),
        name: String(row.name || row.code || '').trim(),
        exRate: Number(row.exRate || 0),
      }))
      .filter((row) => row.value !== '' && row.name !== '');

    const currentCurrency = String(formData.currency || '').trim();
    if (!currentCurrency || isNullCurrencyCode(currentCurrency)) return base;

    const exists = base.some((row) => row.value === currentCurrency);
    if (exists) return base;

    return [{
      value: currentCurrency,
      name: currentCurrency,
      exRate: Number(formData.exRate || 1),
    }, ...base];
  }, [currencies, formData.currency, formData.exRate]);

  const currencyCodeForFlag = useMemo(() => {
    const raw = String(formData.currency || '').trim();
    if (!raw || isNullCurrencyCode(raw)) return '';
    return raw.toLowerCase();
  }, [formData.currency]);

  const currencyFlagUrl = useMemo(
    () => (currencyCodeForFlag ? `${import.meta.env.BASE_URL}flags/${currencyCodeForFlag}.png` : ''),
    [currencyCodeForFlag]
  );

  useEffect(() => {
    setCurrencyFlagLoadError(false);
  }, [currencyFlagUrl]);

  return (
    <div className="flex flex-col gap-4 h-full min-h-0">
      <section className="border border-term-blue rounded-md overflow-hidden shadow-sm" aria-labelledby="term-op-heading">
        <div className="bg-term-blue px-3 py-2">
          <h2 id="term-op-heading" className="text-base font-bold text-white tracking-wide">Order Price (OP1)</h2>
        </div>
        <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 gap-x-4 gap-y-2 bg-white">
          <FieldRow label="Product Cost (PCS)" required labelClass="sm:text-left sm:w-[160px]" htmlFor={ids.prodCost}>
            <NumberInput id={ids.prodCost} value={formData.prodCost} onChange={(v) => updateFormData('prodCost', v)} disabled={isReadOnly} className={`${inputCls} text-right`} />
          </FieldRow>
          <FieldRow label="Packing Handling (PKH)" labelClass="sm:text-left sm:w-[160px]" htmlFor={ids.pkh}>
            <NumberInput id={ids.pkh} value={formData.pkh} onChange={(v) => updateFormData('pkh', v)} disabled={isReadOnly} className={`${inputCls} text-right`} />
          </FieldRow>
          <FieldRow label="Supplier Outb Cost (SOC)" labelClass="sm:text-left sm:w-[160px]" htmlFor={ids.soc}>
            <NumberInput id={ids.soc} value={formData.soc} onChange={(v) => updateFormData('soc', v)} disabled={isReadOnly} className={`${inputCls} text-right`} />
          </FieldRow>
          <FieldRow label="Order Price (OP1) (PCS)" labelClass="sm:text-left sm:w-[160px]" htmlFor={ids.op1Pcs}>
            <div className="flex min-w-0 w-full items-center gap-1.5 flex-nowrap">
              <input
                id={ids.op1Pcs}
                name="op1Pcs"
                type="text"
                value={fmt(calcResults.OP1)}
                readOnly
                className="min-w-0 flex-1 sm:flex-none sm:w-[160px] px-2 py-1.5 border border-gray-300 rounded text-sm bg-gray-200 font-mono text-gray-900 text-right"
                aria-label="Order price OP1 per piece"
              />
              <div className="w-[62px] shrink-0">
                <Select
                  value={formData.currency || undefined}
                  onValueChange={(selectedCode) => {
                    const selected = currencyOptions.find((row) => row.value === selectedCode);
                    updateFormData('currency', selectedCode);
                    updateFormData('exRate', selected?.exRate || 1);
                  }}
                  disabled={isReadOnly}
                >
                  <SelectTrigger
                    className={`w-full h-8 px-1.5 border border-gray-300 rounded text-[11px] bg-white text-center ${f} disabled:opacity-100 disabled:bg-gray-200 disabled:text-gray-900`}
                    aria-label="Currency"
                  >
                    <SelectValue placeholder="" className="w-full justify-center text-center" />
                  </SelectTrigger>
                  <SelectContent side="bottom" avoidCollisions={false}>
                    {currencyOptions.map((row) => (
                      <SelectItem key={row.value} value={row.value} subLabel={fmtExRate(row.exRate)}>
                        {row.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="h-8 w-10 shrink-0 bg-white flex items-center justify-center overflow-hidden" aria-hidden={!currencyFlagUrl || currencyFlagLoadError}>
                {currencyFlagUrl && !currencyFlagLoadError ? (
                  <img
                    key={currencyFlagUrl}
                    src={currencyFlagUrl}
                    alt={`${formData.currency || ''} flag`}
                    className="h-full w-full object-contain"
                    loading="lazy"
                    decoding="async"
                    onError={() => setCurrencyFlagLoadError(true)}
                  />
                ) : null}
              </div>
            </div>
          </FieldRow>
          <FieldRow label="Exchange Rates (Ex. Rate)" labelClass="sm:text-left sm:w-[160px]" htmlFor={ids.exRate}>
            <NumberInput id={ids.exRate} value={formData.exRate} onChange={(v) => updateFormData('exRate', v)} disabled={isReadOnly} className={readCls} />
          </FieldRow>
          <FieldRow label="Order Price (OP1) (THB)" labelClass="sm:text-left sm:w-[160px]" htmlFor={ids.op1Thb}>
            <input
              id={ids.op1Thb}
              name="op1Thb"
              type="text"
              value={fmt(calcResults.OP1_THB)}
              readOnly
              className="w-full sm:w-[160px] px-2 py-1.5 border border-term-blue rounded text-sm bg-blue-50 font-mono font-bold text-term-blue text-right"
              aria-label="Order price OP1 in THB"
            />
          </FieldRow>
        </div>
      </section>

      <section className="border border-term-blue rounded-md overflow-hidden shadow-sm" aria-labelledby="term-fr-heading">
        <div className="bg-term-blue px-3 py-2">
          <h2 id="term-fr-heading" className="text-base font-bold text-white tracking-wide">Freight to QTEC (FR)</h2>
        </div>
        <div className="p-5 space-y-2.5 bg-white">
          <div className="flex flex-col sm:flex-row gap-4 border-b border-gray-100 pb-3">
            <fieldset className="flex-1 flex flex-col gap-2" disabled={isReadOnly}>
              <legend className="text-xs text-term-blue font-bold whitespace-nowrap">Ship Mode *</legend>
              <div className="flex flex-col gap-2 pl-2">
                {shipModeOptions.map((mode) => (
                  <label key={mode.value} className={`flex items-center gap-1.5 text-xs cursor-pointer ${isReadOnly ? 'cursor-not-allowed opacity-60' : 'hover:text-term-blue'} transition-colors`}>
                    <input
                      type="radio"
                      name={`${idBase}-shipMode`}
                      value={mode.value}
                      checked={formData.shipMode === mode.value}
                      onChange={(e) => updateFormData('shipMode', e.target.value)}
                      className="w-3.5 h-3.5 accent-term-blue"
                    />
                    {mode.label}
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className="flex-1 flex flex-col gap-2 border-t sm:border-t-0 sm:border-l border-gray-100 pt-2 sm:pt-0 sm:pl-4" disabled={isReadOnly}>
              <legend className="sr-only">Dimensions</legend>
              <div className="flex items-center justify-between">
                <span className="text-xs text-term-blue font-bold underline decoration-dotted underline-offset-2">Dimensions</span>
                <div className="flex gap-3">
                  {DIMENSION_UNITS.map((unit) => (
                    <label key={unit.value} className={`flex items-center gap-1 text-[10px] cursor-pointer font-bold ${formData.dimUnit === unit.value ? 'text-term-blue' : 'text-gray-400'}`}>
                      <input
                        type="radio"
                        name={`${idBase}-dimUnit`}
                        value={unit.value}
                        checked={formData.dimUnit === unit.value}
                        onChange={(e) => updateFormData('dimUnit', e.target.value)}
                        className="w-3 h-3 accent-term-blue"
                      />
                      {unit.label}
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                {[
                  { label: 'Length', field: 'length' as const },
                  { label: 'Width', field: 'width' as const },
                  { label: 'Height', field: 'height' as const },
                ].map((d) => (
                  <div key={d.field} className="flex items-center gap-2">
                    <label htmlFor={ids[d.field]} className="text-xs text-gray-600 w-[50px] text-right">{d.label}</label>
                    <NumberInput
                      id={ids[d.field]}
                      value={formData[d.field]}
                      onChange={(v) => updateFormData(d.field, v)}
                      disabled={isReadOnly}
                      className={`flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm bg-white text-right ${f}`}
                    />
                  </div>
                ))}
              </div>
            </fieldset>
          </div>

          <div className="pt-2 space-y-2">
            <div className="flex items-center gap-2">
              <label htmlFor={ids.dimWeight} className={`${frLabelBaseCls} text-gray-600`}>Dim Weight (DW)</label>
              <input id={ids.dimWeight} type="text" value={fmt(calcResults.DIM_WEIGHT)} readOnly className={frMutedValueCls} />
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor={ids.weight} className={`${frLabelBaseCls} text-term-blue font-bold`}>Item Weight (KG)*</label>
              <NumberInput
                id={ids.weight}
                value={formData.weight}
                onChange={(v) => updateFormData('weight', v)}
                disabled={isReadOnly}
                className="flex-1 min-w-0 sm:flex-none sm:w-[160px] px-2 py-1.5 border border-gray-300 rounded text-sm bg-white text-right focus:outline-none focus:border-term-blue focus:ring-1 focus:ring-term-blue disabled:bg-white disabled:text-gray-500 enabled:border-gray-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor={ids.cWeight} className={`${frLabelBaseCls} text-term-blue font-bold underline decoration-dotted underline-offset-2`}>Chargeable W (KG)</label>
              <input
                id={ids.cWeight}
                type="text"
                value={fmt(formData.cWeight ?? 0)}
                readOnly
                className={frReadValueCls}
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
            <label htmlFor={ids.freightType} className={`${frLabelBaseCls} text-gray-600 w-full sm:w-[160px]`}>Freight/Courier Rate</label>
            <div className="flex min-w-0 w-full sm:w-[300px] items-center gap-1.5">
              <div className="min-w-0 flex-1">
                <Select
                  value={formData.freightType || undefined}
                  onValueChange={(selectedValue) => {
                    const selected = freightOptions.find((row) => row.value === selectedValue);
                    updateFormData('freightType', selectedValue);
                    updateFormData('freightRate', Number(selected?.rate ?? 0));
                  }}
                  disabled={isReadOnly}
                >
                  <SelectTrigger id={ids.freightType} name="freightType" className={`w-full min-w-0 px-2 py-1.5 border border-gray-300 rounded text-xs bg-white ${f} disabled:opacity-100 disabled:bg-gray-200 disabled:text-gray-900`}>
                    <SelectValue placeholder="- Please Select -" />
                  </SelectTrigger>
                  <SelectContent side="bottom" avoidCollisions={false}>
                    {freightOptions.map((row) => (
                      <SelectItem key={row.value} value={row.value} subLabel={fmtExRate(row.rate)}>
                        {row.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <NumberInput
                value={formData.freightRate}
                onChange={(v) => updateFormData('freightRate', v)}
                className="w-[84px] shrink-0 px-2 py-1.5 border border-gray-300 rounded text-sm text-center bg-gray-200 font-mono text-gray-900"
                disabled
                placeholder="Rate"
                zeroAsInteger
                precision={0}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor={ids.shipWeight} className={`${frLabelBaseCls} text-gray-600`}>Shipping Weight</label>
            <input id={ids.shipWeight} type="text" value={fmt(calcResults.SHP_WEIGHT)} readOnly className={frReadValueCls} />
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor={ids.frQtec} className={`${frLabelBaseCls} text-term-blue font-bold`}>Freight to QTEC WH</label>
            <input id={ids.frQtec} type="text" value={fmt(calcResults.FR_QTEC)} readOnly className={frReadValueCls} />
          </div>
        </div>
      </section>

      <section className="border border-term-blue rounded-md overflow-hidden shadow-sm" aria-labelledby="term-qlc-heading">
        <div className="bg-term-blue px-3 py-2">
          <h2 id="term-qlc-heading" className="text-base font-bold text-white tracking-wide">QTEC W/H Cost (QLC)</h2>
        </div>
        <div className="p-5 space-y-2 bg-white">
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
            <label htmlFor={ids.wireTT} className="text-xs text-left sm:text-left text-gray-700 whitespace-nowrap w-full sm:w-[160px]">Wire T/T (TT)</label>
            <div className="w-full sm:w-[160px]">
              <NumberInput
                id={ids.wireTT}
                value={formData.wireTT}
                onChange={(v) => updateFormData('wireTT', v)}
                disabled={isReadOnly}
                className={`w-full px-2 py-1.5 border border-gray-300 rounded text-sm bg-white text-right ${f}`}
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
            <label htmlFor={ids.customClear} className="text-xs text-left sm:text-left text-gray-700 whitespace-nowrap w-full sm:w-[160px]">Custom Clear</label>
            <div className="w-full sm:w-[160px]">
              <NumberInput
                id={ids.customClear}
                value={formData.customClear}
                onChange={(v) => updateFormData('customClear', v)}
                disabled={isReadOnly}
                className={`w-full px-2 py-1.5 border border-gray-300 rounded text-sm bg-white text-right ${f}`}
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
            <label htmlFor={ids.scc} className="text-xs text-left sm:text-left text-gray-700 whitespace-nowrap w-full sm:w-[160px]">Special Custom Clear (SCC)</label>
            <div className="w-full sm:w-[160px]">
              <NumberInput
                id={ids.scc}
                value={formData.scc}
                onChange={(v) => updateFormData('scc', v)}
                disabled={isReadOnly}
                className={`w-full px-2 py-1.5 border border-gray-300 rounded text-sm bg-white text-right ${f}`}
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
            <label htmlFor={ids.preQlc} className="text-xs text-left sm:text-left text-gray-700 whitespace-nowrap w-full sm:w-[160px]">Pre-QLC (THB)</label>
            <div className="w-full sm:w-[160px]">
              <input id={ids.preQlc} name="preQlc" type="text" value={fmt(calcResults.PRE_QLC)} readOnly className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm bg-gray-200 font-mono text-gray-900 text-right" />
            </div>
          </div>

          <div className="flex justify-start">
            <div className="w-full sm:w-auto text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded border border-gray-200 text-left mt-1">
              = OP1 + INS + FR + DT + ETC + ET + MT + TT + CC + SCC
            </div>
          </div>

          <div className="border-t border-gray-100 pt-2 space-y-1.5">
            <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-2 mb-2">
              <p className="text-xs text-left sm:text-left text-gray-700 whitespace-nowrap w-full sm:w-[160px] sm:pt-1">Stock Fee</p>
              <div className="w-full sm:w-[160px] grid grid-cols-4 sm:grid-cols-4 gap-1.5">
                {STOCK_FEE_OPTIONS.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => updateFormData('stockFeePercent', v)}
                    disabled={isReadOnly}
                    className={`h-8 px-2 rounded text-xs font-semibold transition-colors ${
                      formData.stockFeePercent === v
                        ? 'bg-term-blue text-white'
                        : isReadOnly
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {v}%
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
              <label htmlFor={ids.stockFeePercent} className="text-xs text-left sm:text-left text-gray-700 whitespace-nowrap w-full sm:w-[160px]">Stock Fee (SF) (%)</label>
              <div className="flex items-center gap-2 w-full sm:w-[230px] justify-start">
                <input
                  id={ids.stockFeePercent}
                  name="stockFeePercentDisplay"
                  type="text"
                  value={`${Number(formData.stockFeePercent || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`}
                  readOnly
                  className="w-[60px] flex-none px-2 py-1.5 border border-gray-300 rounded text-sm bg-gray-200 font-mono text-gray-900 text-right"
                />
                <input
                  id={ids.stockFeeAmount}
                  name="stockFeeAmountDisplay"
                  type="text"
                  value={fmt(calcResults.STK)}
                  readOnly
                  className="w-[200px] flex-1 min-w-0 px-4 py-1.5 border border-gray-300 rounded text-sm bg-gray-200 font-mono text-gray-900 text-right"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border border-term-blue rounded-md overflow-hidden shadow-sm flex-1 min-h-0 flex flex-col" aria-labelledby="term-remarks-heading">
        <div className="bg-term-blue px-3 py-2">
          <h2 id="term-remarks-heading" className="text-base font-bold text-white tracking-wide">Remarks</h2>
        </div>
        <div className="p-3 bg-white flex-1 min-h-0">
          <textarea
            id={ids.remark}
            value={formData.remark}
            onChange={(e) => updateFormData('remark', e.target.value)}
            disabled={isReadOnly}
            maxLength={254}
            aria-label="Remarks"
            placeholder="Enter remarks... (max 254 chars)"
            className={`w-full h-full border border-gray-300 rounded px-2 py-1.5 text-sm resize-none overflow-auto bg-white ${f}`}
          />
        </div>
      </section>
    </div>
  );
});
