import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { DatePicker } from '../../ui/date-picker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { InlineSelect } from '../../common/InlineSelect';
import { referenceFileApi } from '../../../services/reference-files.api';
import type {
  TermContactOption,
  TermFormData,
  TermLocationOption,
  TermSupplierOption,
  UpdateTermFormData,
} from '../../../types/term_form.types';

interface TermInfoRowProps {
  itemCode: string;
  itemDesc: string;
  formData: TermFormData;
  updateFormData: UpdateTermFormData;
  isReadOnly?: boolean;
  suppliers: TermSupplierOption[];
  contacts: TermContactOption[];
  orderTerms: string[];
  locations: TermLocationOption[];
  purchaseSubLocations: string[];
  salesSubLocations: string[];
  onSuppOrderCodeCommit?: () => Promise<void> | void;
  onSupplierChange?: (supplierCode: string) => void;
}

const ensureOption = (list: string[], value: string) => {
  const normalized = String(value || '').trim();
  if (!normalized) return list;
  return list.includes(normalized) ? list : [normalized, ...list];
};

const ensureContactOption = (list: TermContactOption[], code: string, name: string): TermContactOption[] => {
  const normalizedCode = String(code || '').trim();
  if (!normalizedCode) return list;
  return list.some((contact) => contact.code === normalizedCode)
    ? list
    : [{ code: normalizedCode, name: String(name || '').trim() || normalizedCode, active: 'Y' }, ...list];
};

export function TermInfoRow({
  itemCode,
  itemDesc,
  formData,
  updateFormData,
  isReadOnly,
  suppliers,
  contacts,
  orderTerms,
  locations,
  purchaseSubLocations,
  salesSubLocations,
  onSuppOrderCodeCommit,
  onSupplierChange,
}: TermInfoRowProps) {
  const idBase = useId();
  const supplierPickerRef = useRef<HTMLDivElement | null>(null);
  const supplierOptionMouseDownRef = useRef(false);
  const [supplierSearch, setSupplierSearch] = useState('');
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);

  const ids = useMemo(
    () => ({
      itemCode: `${idBase}-itemCode`,
      itemDesc: `${idBase}-itemDesc`,
      supplierCode: `${idBase}-supplierCode`,
      supplierSearch: `${idBase}-supplierSearch`,
      supplierListbox: `${idBase}-supplierListbox`,
      supplierName: `${idBase}-supplierName`,
      contactPerson: `${idBase}-contactPerson`,
      contractNo: `${idBase}-contractNo`,
      mfgPartNo: `${idBase}-mfgPartNo`,
      suppOrderCode: `${idBase}-suppOrderCode`,
      active: `${idBase}-active`,
      validFrom: `${idBase}-validFrom`,
      validTo: `${idBase}-validTo`,
      purchaseTerm: `${idBase}-purchaseTerm`,
      purchaseLocation: `${idBase}-purchaseLocation`,
      purchaseSubLocation: `${idBase}-purchaseSubLocation`,
      salesTerm: `${idBase}-salesTerm`,
      salesSubLocation: `${idBase}-salesSubLocation`,
    }),
    [idBase]
  );

  const supplierOptions = useMemo(() => {
    const exists = suppliers.some((supplier) => supplier.code === formData.supplier);
    if (!formData.supplier || exists) return suppliers;

    return [{ code: formData.supplier, name: formData.supplierName || '' }, ...suppliers];
  }, [formData.supplier, formData.supplierName, suppliers]);

  const contactOptions = useMemo(
    () => ensureContactOption(contacts, formData.contactPerson || '', formData.contactPersonName || ''),
    [contacts, formData.contactPerson, formData.contactPersonName]
  );
  const purchaseTermOptions = useMemo(
    () => ensureOption(orderTerms, formData.purchaseTerm || ''),
    [formData.purchaseTerm, orderTerms]
  );
  const salesTermOptions = useMemo(
    () => ensureOption(orderTerms, formData.salesTerm || ''),
    [formData.salesTerm, orderTerms]
  );

  const locationOptions = useMemo(() => {
    const selectedLocationCode = String(formData.purchaseTermLocation || '').trim();
    if (!selectedLocationCode) return locations;

    const exists = locations.some((location) => location.code === selectedLocationCode);
    if (exists) return locations;

    return [
      {
        code: selectedLocationCode,
        name: String(formData.purchaseTermLocationName || '').trim() || selectedLocationCode,
        priority: 0,
        zoneName: '',
        zoneRate: Number(formData.zoneRate || 0),
      },
      ...locations,
    ];
  }, [formData.purchaseTermLocation, formData.purchaseTermLocationName, formData.zoneRate, locations]);

  const purchaseSubLocationOptions = useMemo(
    () => ensureOption(purchaseSubLocations, formData.purchaseSubLocation || ''),
    [formData.purchaseSubLocation, purchaseSubLocations]
  );
  const salesSubLocationOptions = useMemo(
    () => ensureOption(salesSubLocations, formData.salesSubLocation || ''),
    [formData.salesSubLocation, salesSubLocations]
  );

  const selectedSupplier = useMemo(
    () => supplierOptions.find((supplier) => supplier.code === formData.supplier),
    [formData.supplier, supplierOptions]
  );

  useEffect(() => {
    setSupplierSearch(selectedSupplier?.name || selectedSupplier?.code || '');
  }, [selectedSupplier?.code, selectedSupplier?.name]);

  useEffect(() => {
    const handleDocumentPointerDown = (event: PointerEvent) => {
      if (!supplierPickerRef.current) return;
      if (!supplierPickerRef.current.contains(event.target as Node)) {
        setShowSupplierDropdown(false);
      }
    };

    document.addEventListener('pointerdown', handleDocumentPointerDown);
    return () => {
      document.removeEventListener('pointerdown', handleDocumentPointerDown);
    };
  }, []);

  const supplierSearchQuery = supplierSearch.trim().toLowerCase();
  const filteredSupplierOptions = useMemo(
    () =>
      supplierSearchQuery
        ? supplierOptions.filter((supplier) => {
            const supplierName = String(supplier.name || '').trim().toLowerCase();
            const supplierCode = String(supplier.code || '').trim().toLowerCase();
            return supplierName.startsWith(supplierSearchQuery) || supplierCode.startsWith(supplierSearchQuery);
          })
        : supplierOptions,
    [supplierOptions, supplierSearchQuery]
  );

  const commitSupplier = useCallback(
    (supplierCode: string) => {
      updateFormData('supplier', supplierCode);
      onSupplierChange?.(supplierCode);

      const matched = supplierOptions.find((supplier) => supplier.code === supplierCode);
      setSupplierSearch(matched?.name || matched?.code || '');
      setShowSupplierDropdown(false);
    },
    [onSupplierChange, supplierOptions, updateFormData]
  );

  const fmtZoneRate = (value: number) =>
    Number(value || 0).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    });

  const f = 'focus:outline-none focus:border-term-blue focus:ring-1 focus:ring-term-blue disabled:bg-white disabled:text-gray-500 enabled:border-gray-500';
  const inputCls = `w-full px-2 py-1 border border-gray-300 rounded text-sm bg-white ${f}`;
  const readOnlyCls = 'w-full px-2 py-1 bg-gray-200 border border-gray-300 rounded text-sm text-gray-900';
  const selectCls = `w-full px-2 py-1 border border-gray-300 rounded text-sm bg-white ${f}`;
  const inlineSelectCls = `${selectCls} disabled:opacity-100 disabled:bg-gray-200 disabled:text-gray-900`;
  const labelCls = 'text-xs text-gray-600 whitespace-nowrap text-right';

  return (
    <section className="bg-white px-6 py-4 border-b border-gray-200 shadow-sm mb-4" aria-labelledby={`${idBase}-term-info-heading`}>
      <h2 id={`${idBase}-term-info-heading`} className="sr-only">Term information</h2>
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        <div className="lg:col-span-3 space-y-3">
          <div className="grid items-center gap-3" style={{ gridTemplateColumns: '100px 120px 1fr' }}>
            <label htmlFor={ids.itemCode} className={labelCls}>Item Code</label>
            <input id={ids.itemCode} type="text" value={itemCode} readOnly className={`${readOnlyCls} font-mono font-bold text-gray-800`} />
            <input id={ids.itemDesc} type="text" value={itemDesc} readOnly className={readOnlyCls} aria-label="Item description" />
          </div>

          <div className="grid items-center gap-3" style={{ gridTemplateColumns: '100px 120px 1fr' }}>
            <label htmlFor={ids.supplierCode} className={labelCls}>Supplier</label>
            <input id={ids.supplierCode} type="text" value={formData.supplier || ''} readOnly className={`${readOnlyCls} font-mono`} />
            <div className="relative" ref={supplierPickerRef}>
              <input
                id={ids.supplierSearch}
                type="text"
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={showSupplierDropdown && !isReadOnly}
                aria-controls={ids.supplierListbox}
                value={supplierSearch}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  setSupplierSearch(nextValue);
                  setShowSupplierDropdown(true);

                  if (!nextValue.trim() && formData.supplier) {
                    updateFormData('supplier', '');
                    onSupplierChange?.('');
                  }
                }}
                onFocus={() => {
                  if (!isReadOnly) setShowSupplierDropdown(true);
                }}
                onBlur={() => {
                  window.setTimeout(() => {
                    if (supplierOptionMouseDownRef.current) {
                      supplierOptionMouseDownRef.current = false;
                      return;
                    }

                    setShowSupplierDropdown(false);

                    const typed = supplierSearch.trim().toLowerCase();
                    if (!typed) {
                      setSupplierSearch('');
                      return;
                    }

                    const exact = supplierOptions.find((supplier) => {
                      const supplierName = String(supplier.name || '').trim().toLowerCase();
                      const supplierCode = String(supplier.code || '').trim().toLowerCase();
                      return supplierName === typed || supplierCode === typed;
                    });

                    if (exact) {
                      commitSupplier(exact.code);
                      return;
                    }

                    setSupplierSearch(selectedSupplier?.name || selectedSupplier?.code || '');
                  }, 0);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    const candidate = filteredSupplierOptions[0];
                    if (candidate) {
                      commitSupplier(candidate.code);
                    }
                    return;
                  }

                  if (event.key === 'Escape') {
                    event.preventDefault();
                    setShowSupplierDropdown(false);
                    setSupplierSearch(selectedSupplier?.name || selectedSupplier?.code || '');
                  }
                }}
                disabled={isReadOnly}
                placeholder="- Please Select -"
                className={selectCls}
              />

              {showSupplierDropdown && !isReadOnly && (
                <div
                  id={ids.supplierListbox}
                  role="listbox"
                  className="absolute z-50 mt-1 w-full max-h-[220px] overflow-y-auto rounded border border-[#A0C0E0] bg-white shadow-lg"
                >
                  {filteredSupplierOptions.length > 0 ? (
                    filteredSupplierOptions.map((supplier) => (
                      <button
                        type="button"
                        role="option"
                        aria-selected={supplier.code === formData.supplier}
                        key={supplier.code}
                        className="block w-full px-2 py-1.5 text-left text-sm text-gray-800 hover:bg-[#E8F0F8]"
                        onMouseDown={(event) => {
                          event.preventDefault();
                          supplierOptionMouseDownRef.current = true;
                          commitSupplier(supplier.code);
                        }}
                      >
                        {supplier.name || supplier.code}
                      </button>
                    ))
                  ) : (
                    <div className="px-2 py-2 text-xs text-gray-400 text-center">No supplier found</div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="grid items-center gap-3" style={{ gridTemplateColumns: '100px 1fr' }}>
            <div />
            <span id={ids.supplierName} className="w-full px-2 py-1 border border-gray-300 rounded text-sm bg-gray-200 text-gray-900 inline-block">
              {selectedSupplier?.name || '\u00A0'}
            </span>
          </div>

          <div className="grid items-center gap-3" style={{ gridTemplateColumns: '100px 1fr 100px 1fr' }}>
            <label htmlFor={ids.contactPerson} className={labelCls}>Contact Person</label>
            <InlineSelect
              id={ids.contactPerson}
              value={formData.contactPerson}
              onValueChange={(nextCode) => {
                const nextContact = contactOptions.find((contact) => contact.code === nextCode);
                updateFormData('contactPerson', nextCode);
                updateFormData('contactPersonName', nextContact?.name || '');
              }}
              disabled={isReadOnly}
              placeholder="- Please Select -"
              allowClear
              size="sm"
              className={inlineSelectCls}
              options={contactOptions.map((contact) => ({ value: contact.code, label: contact.name }))}
            />
            <label htmlFor={ids.contractNo} className={labelCls}>Contract No</label>
            <input id={ids.contractNo} type="text" value={formData.contractNo} onChange={(event) => updateFormData('contractNo', event.target.value)} disabled={isReadOnly} className={inputCls} />
          </div>

          <div className="grid items-center gap-3" style={{ gridTemplateColumns: '100px 1fr 100px 1fr' }}>
            <label htmlFor={ids.mfgPartNo} className={labelCls}>MFG Part No</label>
            <input id={ids.mfgPartNo} type="text" value={formData.mfgPartNo} readOnly className={readOnlyCls} />
            <label htmlFor={ids.suppOrderCode} className={labelCls}>Supp Order Code</label>
            <input
              id={ids.suppOrderCode}
              type="text"
              value={formData.suppOrderCode}
              onChange={(event) => updateFormData('suppOrderCode', event.target.value)}
              onBlur={() => {
                if (isReadOnly) return;
                void onSuppOrderCodeCommit?.();
              }}
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return;
                event.preventDefault();
                (event.currentTarget as HTMLInputElement).blur();
              }}
              disabled={isReadOnly}
              className={inputCls}
            />
          </div>
        </div>

        <div className="lg:col-span-2 border-t lg:border-t-0 pt-4 lg:pt-0 lg:border-l border-gray-100 lg:pl-8 space-y-4">
          <div className="flex items-center justify-between bg-gray-50 p-2 rounded-lg border border-gray-100 flex-wrap gap-2">
            <label htmlFor={ids.active} className={`flex items-center gap-2 text-xs font-bold text-gray-700 whitespace-nowrap select-none ${!isReadOnly ? 'cursor-pointer' : ''}`}>
              <div className="relative">
                <input
                  id={ids.active}
                  type="checkbox"
                  checked={formData.active ?? true}
                  onChange={(event) => updateFormData('active', event.target.checked)}
                  disabled={isReadOnly}
                  className="peer sr-only"
                />
                <div className="w-9 h-5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-term-green" />
              </div>
              ACTIVE
            </label>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Valid From</span>
              <div className="w-40">
                <DatePicker
                  id={ids.validFrom}
                  value={formData.validFrom}
                  onChange={(date: string) => updateFormData('validFrom', date)}
                  placeholder="Valid From"
                  disabled={isReadOnly}
                  className={isReadOnly ? 'disabled:opacity-100 disabled:bg-gray-200 disabled:text-gray-900' : ''}
                />
              </div>
              <div className="w-8 shrink-0 text-center">
                <span className="text-xs text-gray-500">To</span>
              </div>
              <div className="w-40">
                <DatePicker
                  id={ids.validTo}
                  value={formData.validTo}
                  onChange={(date: string) => updateFormData('validTo', date)}
                  placeholder="Valid To"
                  disabled={isReadOnly}
                  className={isReadOnly ? 'disabled:opacity-100 disabled:bg-gray-200 disabled:text-gray-900' : ''}
                />
              </div>
            </div>
          </div>

          <div className="p-3 bg-blue-50/50 rounded-lg border border-blue-100/50 space-y-3">
            <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
              <div className="min-w-0 space-y-1.5">
                <span className="text-[12px] uppercase font-bold text-gray-500 tracking-wider">Purchase Term</span>
                <div className="grid items-center gap-1.5" style={{ gridTemplateColumns: '80px minmax(0, 1fr)' }}>
                  <label htmlFor={ids.purchaseTerm} className="text-[11px] text-gray-600 text-right">Purchase Term</label>
                  <InlineSelect
                    id={ids.purchaseTerm}
                    value={formData.purchaseTerm || ''}
                    onValueChange={(nextValue) => updateFormData('purchaseTerm', nextValue)}
                    disabled={isReadOnly}
                    placeholder="Please select"
                    allowClear
                    size="sm"
                    className={`${inlineSelectCls} min-w-0 h-[30px] py-1`}
                    options={purchaseTermOptions.map((term) => ({ value: term, label: term }))}
                  />

                  <span className="text-[11px] text-gray-600 text-right">Term Location</span>
                  <Select
                    value={formData.purchaseTermLocation || ''}
                    onValueChange={(locationCode) => {
                      const selectedLocation = locationOptions.find((row) => row.code === locationCode);
                      updateFormData('purchaseTermLocation', locationCode);
                      updateFormData('purchaseTermLocationName', selectedLocation?.name || '');
                      updateFormData('zoneRate', Number(selectedLocation?.zoneRate ?? 0));
                    }}
                    disabled={isReadOnly}
                  >
                    <SelectTrigger
                      aria-label="Purchase term location"
                      size="sm"
                      className={`${selectCls} min-w-0 h-[30px] py-1 data-[size=sm]:h-[30px] font-normal disabled:opacity-100 disabled:bg-gray-200 disabled:text-gray-900`}
                    >
                      <SelectValue placeholder="Please select" className="text-sm font-normal" />
                    </SelectTrigger>
                    <SelectContent side="bottom" avoidCollisions={false}>
                      {locationOptions.map((location) => (
                        <SelectItem
                          key={location.code}
                          value={location.code}
                          subLabel={`${location.zoneName || '-'} | ${fmtZoneRate(location.zoneRate)}`}
                        >
                          {location.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <label htmlFor={ids.purchaseSubLocation} className="text-[11px] text-gray-600 text-right">Sub Location</label>
                  <InlineSelect
                    id={ids.purchaseSubLocation}
                    value={formData.purchaseSubLocation || ''}
                    onValueChange={(nextValue) => updateFormData('purchaseSubLocation', nextValue)}
                    disabled={isReadOnly}
                    placeholder="Please select"
                    allowClear
                    size="sm"
                    className={`${inlineSelectCls} min-w-0 h-[30px] py-1`}
                    options={purchaseSubLocationOptions.map((subLocation) => ({ value: subLocation, label: subLocation }))}
                  />
                </div>
              </div>

              <div className="min-w-0 space-y-1.5">
                <span className="text-[12px] uppercase font-bold text-gray-500 tracking-wider">Sales Term</span>
                <div className="grid items-center gap-1.5" style={{ gridTemplateColumns: '80px minmax(0, 1fr)' }}>
                  <label htmlFor={ids.salesTerm} className="text-[11px] text-gray-600 text-right">Sales Term</label>
                  <InlineSelect
                    id={ids.salesTerm}
                    value={formData.salesTerm || ''}
                    onValueChange={(nextValue) => updateFormData('salesTerm', nextValue)}
                    disabled={isReadOnly}
                    placeholder="Please select"
                    allowClear
                    size="sm"
                    className={`${inlineSelectCls} min-w-0 h-[30px] py-1`}
                    options={salesTermOptions.map((term) => ({ value: term, label: term }))}
                  />

                  <label htmlFor={ids.salesSubLocation} className="text-[11px] text-gray-600 text-right">Sub Location</label>
                  <InlineSelect
                    id={ids.salesSubLocation}
                    value={formData.salesSubLocation || ''}
                    onValueChange={(nextValue) => updateFormData('salesSubLocation', nextValue)}
                    disabled={isReadOnly}
                    placeholder="Please select"
                    allowClear
                    size="sm"
                    className={`${inlineSelectCls} min-w-0 h-[30px] py-1`}
                    options={salesSubLocationOptions.map((subLocation) => ({ value: subLocation, label: subLocation }))}
                  />
                </div>

                <div className="mt-2 flex items-center justify-between gap-2 border-t border-blue-100 pt-2">
                  <a
                    href={referenceFileApi.getUrl('incoterms-2020-pdf')}
                    target="_blank"
                    rel="noreferrer"
                    className="min-w-0 flex-1 truncate text-xs font-medium text-term-blue hover:underline inline-flex items-center gap-1"
                    title="Incoterms 2020 (PDF)"
                  >
                    <ExternalLink className="h-3 w-3 shrink-0" />
                    {formData.incoterm || 'Incoterms 2020 (PDF)'}
                  </a>
                  <a
                    href={referenceFileApi.getUrl('incoterms-chart')}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 rounded border border-term-blue bg-white px-2 py-0.5 text-[10px] text-term-blue hover:bg-blue-50"
                    title="CHART"
                  >
                    CHART
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
