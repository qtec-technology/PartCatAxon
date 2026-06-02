import { useState, useEffect, useCallback, useMemo, useRef, type ReactNode, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronDown,
  Edit3,
  FileText,
  Trash2,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';

import type { AllocationLineSource, DocumentFees } from './bulk-cost.types';
import { formatShipMode } from './bulk-cost.types';
import {
  DOC_FEE_FIELDS,
  getDocFeeColumnKey,
  canEditLineColumnInPreset,
} from './bulk-cost.columns';
import {
  fmt,
  fmtPlain,
  fmtNullablePlain,
  formatMatchStatus,
} from './bulk-cost.format';
import type { LookupOption, CurrencyLookupOption, LocationLookupOption } from '../../services/lookup.api';
import { FormattedNumberInput } from './bulk-cost.changes-panel';
import type {
  ResizableTableSizing,
  EditableLineNullableNumberField,
  EditableLineNumberField,
  EditableLineTextField,
  LineFieldKey,
} from './BulkCostWorkspace';
import {
  ensureCurrencyLookupOption,
  ensureLookupOption,
  ensureLocationLookupOption,
  locationOptionLabel,
  ensureSelectSpaceBelow,
  getChargeableWeightPerEach,
  formatYesNo,
} from './BulkCostWorkspace';

function hasChanged(changedCellKeys: Set<string>, lineKey: string, fieldKey: LineFieldKey): boolean {
  return changedCellKeys.has(`${lineKey}:${fieldKey}`);
}

function cellChangedClass(changed: boolean, className = ''): string {
  return `${className} ${changed ? 'line-cell-modified' : ''}`.trim();
}

export interface ResizableHeaderProps {
  columnKey: string;
  label: string;
  sizing: ResizableTableSizing;
  rowSpan?: number;
  className?: string;
  stickyLeft?: number;
}

export function ResizableHeader({
  columnKey,
  label,
  sizing,
  rowSpan,
  className,
  stickyLeft,
}: ResizableHeaderProps) {
  return (
    <th
      className={`resizable-table-header ${className || ''} ${stickyLeft !== undefined ? 'sticky-col' : ''}`}
      rowSpan={rowSpan}
      style={stickyLeft !== undefined ? { position: 'sticky', left: stickyLeft, zIndex: 10 } : undefined}
      {...sizing.getCellProps(columnKey)}
    >
      <span>{label}</span>
      {sizing.renderResizeHandle(columnKey)}
    </th>
  );
}

export interface ModalLookupInputProps {
  label: string;
  value: string;
  options: LookupOption[];
  disabled?: boolean;
  onChange: (value: string) => void;
}

export function ModalLookupInput({
  label,
  value,
  options,
  disabled,
  onChange,
}: ModalLookupInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  // Find selected option based on value code
  const selectedOption = useMemo(() => {
    return options.find((opt) => opt.value === value);
  }, [options, value]);

  // The draft text is what the user sees and types
  const [searchQuery, setSearchQuery] = useState('');

  const [dropdownRect, setDropdownRect] = useState<{ left: number; top: number; width: number; maxHeight: number } | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Sync searchQuery when value or selectedOption changes, but only if not currently focused
  useEffect(() => {
    if (!isFocused) {
      setSearchQuery(selectedOption ? selectedOption.label : (value || ''));
    }
  }, [value, selectedOption, isFocused]);

  const updateDropdownPosition = useCallback(() => {
    if (typeof window === 'undefined') return;
    const el = inputRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const top = rect.bottom + window.scrollY + 4;
    const left = rect.left + window.scrollX;
    const availableBelow = Math.max(120, window.innerHeight - rect.bottom - 12);
    setDropdownRect({
      left,
      top,
      width: rect.width,
      maxHeight: Math.min(180, availableBelow),
    });
  }, []);

  useEffect(() => {
    if (!isOpen) return undefined;
    updateDropdownPosition();
    window.addEventListener('resize', updateDropdownPosition);
    window.addEventListener('scroll', updateDropdownPosition, true);
    return () => {
      window.removeEventListener('resize', updateDropdownPosition);
      window.removeEventListener('scroll', updateDropdownPosition, true);
    };
  }, [isOpen, updateDropdownPosition]);

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return options;
    return options.filter((opt) =>
      (opt.label || '').toLowerCase().includes(q) ||
      (opt.value || '').toLowerCase().includes(q)
    );
  }, [options, searchQuery]);

  return (
    <div className="line-edit-modal-field">
      <label>{label}</label>
      <div className="searchable-lookup-container w-full relative flex items-center">
        <input
          ref={inputRef}
          type="text"
          className="line-edit-modal-input w-full"
          style={{ paddingRight: '24px' }}
          value={searchQuery}
          disabled={disabled}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            onChange(e.target.value);
            updateDropdownPosition();
            setIsOpen(true);
          }}
          onFocus={(e) => {
            setIsFocused(true);
            const currentText = selectedOption ? selectedOption.label : (value || '');
            setSearchQuery(currentText);
            updateDropdownPosition();
            setIsOpen(true);

            const input = e.currentTarget;
            window.requestAnimationFrame(() => input.select());
          }}
          onBlur={() => {
            setTimeout(() => {
              setIsFocused(false);
              setIsOpen(false);
            }, 200);
          }}
        />
        <button
          type="button"
          tabIndex={-1}
          style={{
            position: 'absolute',
            right: '8px',
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '2px',
            display: 'flex',
            alignItems: 'center',
            color: '#9ca3af',
          }}
          onMouseDown={(e) => {
            e.preventDefault();
            if (isOpen) {
              setIsOpen(false);
            } else {
              inputRef.current?.focus();
            }
          }}
        >
          <ChevronDown size={14} />
        </button>
        {isOpen && !disabled && dropdownRect && typeof document !== 'undefined' && createPortal(
          <div
            className="searchable-lookup-dropdown searchable-lookup-dropdown--portal"
            style={{
              position: 'absolute',
              left: dropdownRect.left,
              top: dropdownRect.top,
              width: dropdownRect.width,
              maxHeight: dropdownRect.maxHeight,
            }}
          >
            {filtered.length === 0 ? (
              <div className="searchable-lookup-no-results">No matches found</div>
            ) : (
              filtered.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`searchable-lookup-option w-full ${
                    option.value === value ? 'searchable-lookup-option--selected' : ''
                  }`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onChange(option.value);
                    setSearchQuery(option.label);
                    setIsFocused(false);
                    setIsOpen(false);
                  }}
                >
                  {option.label}
                </button>
              ))
            )}
          </div>,
          document.body
        )}
      </div>
    </div>
  );
}

export interface SourceLineCellProps {
  allocatedCosts: { pkhEa: number; socEa: number; frEa: number; ccEa: number; ttEa: number; op1Fcy: number; exRate: number; op1Thb: number; insAmount: number; cifQTEC?: number; preQLC?: number; qlc?: number; totalQLC?: number; roundUp?: number } | null;
  brandOptions: LookupOption[];
  changedCellKeys: Set<string>;
  checked: boolean;
  columnKey: string;
  countryOptions: LookupOption[];
  currencyOptions: CurrencyLookupOption[];
  editable: boolean;
  itemCategoryOptions: LookupOption[];
  itemGroupOptions: LookupOption[];
  locationOptions: LocationLookupOption[];
  line: AllocationLineSource;
  missingWeight: boolean;
  orderTermOptions: string[];
  permitTypeOptions: LookupOption[];
  shipModeOptions: Array<{ value: number; label: string }>;
  stickyLast: boolean;
  stickyLeft?: number;
  subLocationOptions: string[];
  salesSubLocationOptions: string[];
  tableSizing: ResizableTableSizing;
  uomOptions: Array<{ value: string; label: string }>;
  onDocFeeChange: (lineKey: string, key: keyof DocumentFees, raw: string) => void;
  onDocFeeBasisChange: (lineKey: string, key: keyof DocumentFees, basis: 'PER_EACH' | 'BY_LOT_BATCH') => void;
  onNullableNumberChange: (lineKey: string, key: EditableLineNullableNumberField, raw: string) => void;
  onNumberChange: (lineKey: string, key: EditableLineNumberField, raw: string) => void;
  onTextChange: (lineKey: string, key: EditableLineTextField, value: string) => void;
  onToggleLine: (lineKey: string) => void;
  onDeleteLine: (lineKey: string) => void;
  onEditLine?: (lineKey: string) => void;
  onOpenRegistrationDrawer?: (lineKey: string) => void;
}

export function SourceLineCell({
  allocatedCosts,
  brandOptions,
  changedCellKeys,
  checked,
  columnKey,
  countryOptions,
  currencyOptions,
  editable,
  itemCategoryOptions,
  itemGroupOptions,
  locationOptions,
  line,
  missingWeight,
  orderTermOptions,
  permitTypeOptions,
  shipModeOptions,
  stickyLast,
  stickyLeft,
  subLocationOptions,
  salesSubLocationOptions,
  tableSizing,
  uomOptions,
  onDeleteLine,
  onDocFeeChange,
  onDocFeeBasisChange,
  onNullableNumberChange,
  onNumberChange,
  onTextChange,
  onToggleLine,
  onEditLine,
  onOpenRegistrationDrawer,
}: SourceLineCellProps) {
  const stickyClass = stickyLeft !== undefined ? `sticky-col ${stickyLast ? 'sticky-col-last' : ''}` : '';
  const stickyStyle = stickyLeft !== undefined ? { position: 'sticky' as const, left: stickyLeft, zIndex: 2 } : undefined;

  const docFeeField = DOC_FEE_FIELDS.find((field) => getDocFeeColumnKey(field.key) === columnKey);
  if (docFeeField) {
    return (
      <td {...tableSizing.getCellProps(columnKey)}>
        <LineDocFeeCell
          changed={hasChanged(changedCellKeys, line.lineKey, `docFee.${docFeeField.key}`)}
          editable={editable}
          field={docFeeField}
          line={line}
          onChange={(value) => onDocFeeChange(line.lineKey, docFeeField.key, value)}
          onBasisChange={(basis) => onDocFeeBasisChange(line.lineKey, docFeeField.key, basis)}
        />
      </td>
    );
  }

  switch (columnKey) {
    case 'select':
      return (
        <td {...tableSizing.getCellProps('select')} className={`center-cell ${stickyClass}`} style={stickyStyle}>
          <input
            id={`bulk-line-${line.lineKey}`}
            name={`bulkLine.${line.lineKey}.selected`}
            type="checkbox"
            checked={checked}
            onChange={() => onToggleLine(line.lineKey)}
          />
        </td>
      );
    case 'delete':
      return (
        <td {...tableSizing.getCellProps('delete')} className={cellChangedClass(false, `center-cell ${stickyClass}`)} style={stickyStyle}>
          <div className="flex items-center justify-center gap-1.5">
            {onEditLine && (
              <button
                type="button"
                className="line-edit-btn"
                aria-label="Edit line details"
                onClick={() => onEditLine(line.lineKey)}
                title="Edit line details"
              >
                <Edit3 size={13} aria-hidden="true" />
              </button>
            )}
            {onOpenRegistrationDrawer && (
              <button
                type="button"
                className="line-edit-btn line-register-btn text-emerald-600 hover:text-emerald-700"
                aria-label="Item details"
                onClick={() => onOpenRegistrationDrawer(line.lineKey)}
                title="Item details"
              >
                <FileText size={13} aria-hidden="true" />
              </button>
            )}
            {editable && (
              <button
                type="button"
                className="line-delete-btn"
                aria-label="Delete line"
                onClick={() => onDeleteLine(line.lineKey)}
                title="Delete line"
              >
                <Trash2 size={13} aria-hidden="true" />
              </button>
            )}
          </div>
        </td>
      );
    case 'no':
      return <td {...tableSizing.getCellProps('no')} className={`center-cell ${stickyClass}`.trim()} style={stickyStyle}>{line.no}</td>;
    case 'itemGroup':
      return <LineItemGroupCell changed={hasChanged(changedCellKeys, line.lineKey, 'itemGroup')} editable={editable} itemGroupOptions={itemGroupOptions} line={line} tableSizing={tableSizing} onChange={(value) => onTextChange(line.lineKey, 'itemGroup', value)} />;
    case 'itemCategory':
      return <LineLookupTextCell changed={hasChanged(changedCellKeys, line.lineKey, 'itemCategory')} columnKey="itemCategory" editable={editable} line={line} options={ensureLookupOption(itemCategoryOptions, line.itemCategory)} tableSizing={tableSizing} value={line.itemCategory} onChange={(value) => onTextChange(line.lineKey, 'itemCategory', value)} />;
    case 'customerStockCode':
      return <LineTextCell changed={hasChanged(changedCellKeys, line.lineKey, 'customerStockCode')} columnKey="customerStockCode" editable={editable} line={line} tableSizing={tableSizing} value={line.customerStockCode} onChange={(value) => onTextChange(line.lineKey, 'customerStockCode', value)} />;
    case 'matchStatus':
      return <td {...tableSizing.getCellProps('matchStatus')} className="center-cell">{formatMatchStatus(line.itemCode)}</td>;
    case 'description':
      return <LineTextCell changed={hasChanged(changedCellKeys, line.lineKey, 'sapDescription')} className={`text-left-cell ${stickyClass}`.trim()} columnKey="description" editable={editable} line={line} stickyStyle={stickyStyle} tableSizing={tableSizing} value={line.sapDescription} onChange={(value) => onTextChange(line.lineKey, 'sapDescription', value)} />;
    case 'manufacturer':
      return <LineLookupTextCell changed={hasChanged(changedCellKeys, line.lineKey, 'manufacturer')} columnKey="manufacturer" editable={editable} line={line} options={brandOptions} tableSizing={tableSizing} value={line.manufacturer} onChange={(value) => onTextChange(line.lineKey, 'manufacturer', value)} />;
    case 'mfgPartNumber':
      return <LineTextCell changed={hasChanged(changedCellKeys, line.lineKey, 'mfgPartNumber')} columnKey="mfgPartNumber" editable={editable} line={line} tableSizing={tableSizing} value={line.mfgPartNumber} onChange={(value) => onTextChange(line.lineKey, 'mfgPartNumber', value)} />;
    case 'supplierOrderCode':
      return <LineTextCell changed={hasChanged(changedCellKeys, line.lineKey, 'supplierOrderCode')} columnKey="supplierOrderCode" editable={editable} line={line} tableSizing={tableSizing} value={line.supplierOrderCode} onChange={(value) => onTextChange(line.lineKey, 'supplierOrderCode', value)} />;
    case 'qty':
      return <LineNumberCell changed={hasChanged(changedCellKeys, line.lineKey, 'qty')} columnKey="qty" editable={editable} line={line} tableSizing={tableSizing} tdClassName="center-cell" value={line.qty} onChange={(value) => onNumberChange(line.lineKey, 'qty', value)} />;
    case 'uom':
      return <LineUomCell changed={hasChanged(changedCellKeys, line.lineKey, 'uom')} columnKey="uom" editable={editable} line={line} options={uomOptions} tableSizing={tableSizing} value={line.uom} onChange={(value) => onTextChange(line.lineKey, 'uom', value)} />;
    case 'unitPrice':
      return <LineNumberCell changed={hasChanged(changedCellKeys, line.lineKey, 'unitPrice')} columnKey="unitPrice" editable={editable} line={line} tableSizing={tableSizing} tdClassName="numeric-cell" value={line.unitPrice} onChange={(value) => onNumberChange(line.lineKey, 'unitPrice', value)} />;
    case 'amount':
      return <td {...tableSizing.getCellProps('amount')} className={cellChangedClass(hasChanged(changedCellKeys, line.lineKey, 'amount'), 'numeric-cell')}>{fmt(line.amount)}</td>;
    case 'currency':
      return <LineCurrencyCell changed={hasChanged(changedCellKeys, line.lineKey, 'currency')} currencyOptions={currencyOptions} editable={editable} line={line} tableSizing={tableSizing} onChange={(value) => onTextChange(line.lineKey, 'currency', value)} />;
    case 'hsCode':
      return <LineTextCell changed={hasChanged(changedCellKeys, line.lineKey, 'hsCode')} columnKey="hsCode" editable={editable} line={line} tableSizing={tableSizing} value={line.hsCode} onChange={(value) => onTextChange(line.lineKey, 'hsCode', value)} />;
    case 'countryOfOrigin':
      return <LineLookupTextCell changed={hasChanged(changedCellKeys, line.lineKey, 'countryOfOrigin')} columnKey="countryOfOrigin" editable={editable} line={line} options={countryOptions} tableSizing={tableSizing} value={line.countryOfOrigin} onChange={(value) => onTextChange(line.lineKey, 'countryOfOrigin', value)} />;
    case 'leadTime':
      return <LineTextCell changed={hasChanged(changedCellKeys, line.lineKey, 'deliveryLeadTime')} columnKey="leadTime" editable={editable} line={line} tableSizing={tableSizing} value={line.deliveryLeadTime} onChange={(value) => onTextChange(line.lineKey, 'deliveryLeadTime', value)} />;
    case 'orderTerm':
      return <LineSelectTextCell changed={hasChanged(changedCellKeys, line.lineKey, 'orderTerm')} columnKey="orderTerm" editable={editable} line={line} options={orderTermOptions.map((term) => ({ value: term, label: term }))} tableSizing={tableSizing} value={line.orderTerm} onChange={(value) => onTextChange(line.lineKey, 'orderTerm', value)} />;
    case 'location':
      return <LineLocationCell changed={hasChanged(changedCellKeys, line.lineKey, 'location')} editable={editable} line={line} locationOptions={locationOptions} tableSizing={tableSizing} onChange={(value) => onTextChange(line.lineKey, 'location', value)} />;
    case 'subLocation':
      return <LineSelectTextCell changed={hasChanged(changedCellKeys, line.lineKey, 'subLocation')} columnKey="subLocation" editable={editable} line={line} options={subLocationOptions.map((subLocation) => ({ value: subLocation, label: subLocation }))} tableSizing={tableSizing} value={line.subLocation} onChange={(value) => onTextChange(line.lineKey, 'subLocation', value)} />;
    case 'salesTerm':
      return <LineSelectTextCell changed={hasChanged(changedCellKeys, line.lineKey, 'salesTerm')} columnKey="salesTerm" editable={editable} line={line} options={orderTermOptions.map((term) => ({ value: term, label: term }))} tableSizing={tableSizing} value={line.salesTerm || ''} onChange={(value) => onTextChange(line.lineKey, 'salesTerm', value)} />;
    case 'salesSubLocation':
      return <LineSelectTextCell changed={hasChanged(changedCellKeys, line.lineKey, 'salesSubLocation')} columnKey="salesSubLocation" editable={editable} line={line} options={salesSubLocationOptions.map((subLocation) => ({ value: subLocation, label: subLocation }))} tableSizing={tableSizing} value={line.salesSubLocation || ''} onChange={(value) => onTextChange(line.lineKey, 'salesSubLocation', value)} />;
    case 'shipMode':
      return (
        <td {...tableSizing.getCellProps('shipMode')} className={cellChangedClass(hasChanged(changedCellKeys, line.lineKey, 'shipModeNo'), 'center-cell')}>
          {editable ? (
            <select
              id={`latest-${line.lineKey}-shipMode`}
              name={`latest.${line.lineKey}.shipModeNo`}
              className="line-edit-input"
              value={line.shipModeNo}
              onMouseDownCapture={(e) => ensureSelectSpaceBelow(e.currentTarget)}
              onChange={(e) => onNumberChange(line.lineKey, 'shipModeNo', e.target.value)}
            >
              {shipModeOptions.map((mode) => (
                <option key={mode.value} value={mode.value}>{mode.label}</option>
              ))}
            </select>
          ) : (
            <span>{formatShipMode(line.shipModeNo)}</span>
          )}
        </td>
      );
    case 'importPermit':
      return <LineYesNoCell changed={hasChanged(changedCellKeys, line.lineKey, 'importPermit')} columnKey="importPermit" editable={editable} line={line} tableSizing={tableSizing} value={line.importPermit} onChange={(value) => onTextChange(line.lineKey, 'importPermit', value)} />;
    case 'permitType':
      return <LineLookupTextCell changed={hasChanged(changedCellKeys, line.lineKey, 'permitType')} columnKey="permitType" editable={editable} line={line} options={ensureLookupOption(permitTypeOptions, line.permitType)} tableSizing={tableSizing} value={line.permitType} onChange={(value) => onTextChange(line.lineKey, 'permitType', value)} />;
    case 'shelfLife':
      return <LineYesNoCell changed={hasChanged(changedCellKeys, line.lineKey, 'shelfLifeRequire')} columnKey="shelfLife" editable={editable} line={line} tableSizing={tableSizing} value={line.shelfLifeRequire} onChange={(value) => onTextChange(line.lineKey, 'shelfLifeRequire', value)} />;
    case 'itemWeight':
      return <LineNullableNumberCell changed={hasChanged(changedCellKeys, line.lineKey, 'itemWeightPerEach')} columnKey="itemWeight" editable={editable} line={line} tableSizing={tableSizing} tdClassName="numeric-cell" value={line.itemWeightPerEach} onChange={(value) => onNullableNumberChange(line.lineKey, 'itemWeightPerEach', value)} />;
    case 'dimWeight':
      return <LineNullableNumberCell changed={hasChanged(changedCellKeys, line.lineKey, 'dimensionWeightPerEach')} columnKey="dimWeight" editable={editable} line={line} tableSizing={tableSizing} tdClassName="numeric-cell" value={line.dimensionWeightPerEach} onChange={(value) => onNullableNumberChange(line.lineKey, 'dimensionWeightPerEach', value)} />;
    case 'chargeableWeight':
      return <td {...tableSizing.getCellProps('chargeableWeight')} className="numeric-cell">{fmt(getChargeableWeightPerEach(line))}</td>;
    case 'shipWeight':
      return <LineNullableNumberCell changed={hasChanged(changedCellKeys, line.lineKey, 'shippingWeightPerEach')} columnKey="shipWeight" editable={editable} line={line} tableSizing={tableSizing} tdClassName="numeric-cell" value={line.shippingWeightPerEach} onChange={(value) => onNullableNumberChange(line.lineKey, 'shippingWeightPerEach', value)} />;
    case 'freightRate':
      return <LineNullableNumberCell changed={hasChanged(changedCellKeys, line.lineKey, 'freightRate')} columnKey="freightRate" editable={editable} line={line} tableSizing={tableSizing} tdClassName="numeric-cell" value={line.freightRate} onChange={(value) => onNullableNumberChange(line.lineKey, 'freightRate', value)} />;
    case 'dimUnit':
      return (
        <td {...tableSizing.getCellProps('dimUnit')} className={cellChangedClass(hasChanged(changedCellKeys, line.lineKey, 'dimUnit'), 'center-cell')}>
          {editable ? (
            <select
              id={`latest-${line.lineKey}-dimUnit`}
              name={`latest.${line.lineKey}.dimUnit`}
              className="line-edit-input"
              value={line.dimUnit}
              onMouseDownCapture={(e) => ensureSelectSpaceBelow(e.currentTarget)}
              onChange={(e) => onNumberChange(line.lineKey, 'dimUnit', e.target.value)}
            >
              <option value={1}>CM</option>
              <option value={2}>INCH</option>
            </select>
          ) : (
            <span>{line.dimUnit === 2 ? 'INCH' : 'CM'}</span>
          )}
        </td>
      );
    case 'length':
      return <LineNumberCell changed={hasChanged(changedCellKeys, line.lineKey, 'length')} columnKey="length" editable={editable} line={line} tableSizing={tableSizing} tdClassName="numeric-cell" value={line.length} onChange={(value) => onNumberChange(line.lineKey, 'length', value)} />;
    case 'width':
      return <LineNumberCell changed={hasChanged(changedCellKeys, line.lineKey, 'width')} columnKey="width" editable={editable} line={line} tableSizing={tableSizing} tdClassName="numeric-cell" value={line.width} onChange={(value) => onNumberChange(line.lineKey, 'width', value)} />;
    case 'height':
      return <LineNumberCell changed={hasChanged(changedCellKeys, line.lineKey, 'height')} columnKey="height" editable={editable} line={line} tableSizing={tableSizing} tdClassName="numeric-cell" value={line.height} onChange={(value) => onNumberChange(line.lineKey, 'height', value)} />;
    case 'importDuty':
      return <LineNumberCell changed={hasChanged(changedCellKeys, line.lineKey, 'importDutyPercent')} columnKey="importDuty" editable={editable} line={line} tableSizing={tableSizing} tdClassName="numeric-cell" value={line.importDutyPercent} onChange={(value) => onNumberChange(line.lineKey, 'importDutyPercent', value)} />;
    case 'moq':
      return <LineTextCell changed={hasChanged(changedCellKeys, line.lineKey, 'moq')} columnKey="moq" editable={editable} line={line} tableSizing={tableSizing} value={line.moq || ''} onChange={(value) => onTextChange(line.lineKey, 'moq', value)} />;
    case 'insPercent':
      return <LineNumberCell changed={hasChanged(changedCellKeys, line.lineKey, 'insPercent')} columnKey="insPercent" editable={editable} line={line} tableSizing={tableSizing} tdClassName="numeric-cell" value={line.insPercent} onChange={(value) => onNumberChange(line.lineKey, 'insPercent', value)} />;
    case 'stkPercent':
      return <LineNumberCell changed={hasChanged(changedCellKeys, line.lineKey, 'stkPercent')} columnKey="stkPercent" editable={editable} line={line} tableSizing={tableSizing} tdClassName="numeric-cell" value={line.stkPercent} onChange={(value) => onNumberChange(line.lineKey, 'stkPercent', value)} />;
    case 'zoneRate':
      return <LineNumberCell changed={hasChanged(changedCellKeys, line.lineKey, 'zoneRate')} columnKey="zoneRate" editable={editable} line={line} tableSizing={tableSizing} tdClassName="numeric-cell" value={line.zoneRate} onChange={(value) => onNumberChange(line.lineKey, 'zoneRate', value)} />;
    case 'etPercent':
      return <LineNumberCell changed={hasChanged(changedCellKeys, line.lineKey, 'etPercent')} columnKey="etPercent" editable={editable} line={line} tableSizing={tableSizing} tdClassName="numeric-cell" value={line.etPercent} onChange={(value) => onNumberChange(line.lineKey, 'etPercent', value)} />;
    case 'miscTax':
      return <LineNumberCell changed={hasChanged(changedCellKeys, line.lineKey, 'miscTax')} columnKey="miscTax" editable={editable} line={line} tableSizing={tableSizing} tdClassName="numeric-cell" value={line.miscTax} onChange={(value) => onNumberChange(line.lineKey, 'miscTax', value)} />;
    case 'scc':
      return <LineNumberCell changed={hasChanged(changedCellKeys, line.lineKey, 'scc')} columnKey="scc" editable={editable} line={line} tableSizing={tableSizing} tdClassName="numeric-cell" value={line.scc} onChange={(value) => onNumberChange(line.lineKey, 'scc', value)} />;
    case 'spkPercent':
      return <LineNumberCell changed={hasChanged(changedCellKeys, line.lineKey, 'spkPercent')} columnKey="spkPercent" editable={editable} line={line} tableSizing={tableSizing} tdClassName="numeric-cell" value={line.spkPercent} onChange={(value) => onNumberChange(line.lineKey, 'spkPercent', value)} />;
    case 'qocRate':
      return <LineNumberCell changed={hasChanged(changedCellKeys, line.lineKey, 'qocRate')} columnKey="qocRate" editable={editable} line={line} tableSizing={tableSizing} tdClassName="numeric-cell" value={line.qocRate} onChange={(value) => onNumberChange(line.lineKey, 'qocRate', value)} />;
    case 'markupPercent':
      return <LineNumberCell changed={hasChanged(changedCellKeys, line.lineKey, 'markupPercent')} columnKey="markupPercent" editable={editable} line={line} tableSizing={tableSizing} tdClassName="numeric-cell" value={line.markupPercent} onChange={(value) => onNumberChange(line.lineKey, 'markupPercent', value)} />;
    case 'purchaseUOM':
      return <LineUomCell changed={hasChanged(changedCellKeys, line.lineKey, 'purchaseUOM')} columnKey="purchaseUOM" editable={editable} line={line} options={uomOptions} tableSizing={tableSizing} value={line.purchaseUOM} onChange={(value) => onTextChange(line.lineKey, 'purchaseUOM', value)} />;
    case 'stockConversion':
      return <LineNumberCell changed={hasChanged(changedCellKeys, line.lineKey, 'stockConversion')} columnKey="stockConversion" editable={editable} line={line} tableSizing={tableSizing} tdClassName="numeric-cell" value={line.stockConversion} onChange={(value) => onNumberChange(line.lineKey, 'stockConversion', value)} />;
    case 'saleUOM':
      return <LineUomCell changed={hasChanged(changedCellKeys, line.lineKey, 'saleUOM')} columnKey="saleUOM" editable={editable} line={line} options={uomOptions} tableSizing={tableSizing} value={line.saleUOM} onChange={(value) => onTextChange(line.lineKey, 'saleUOM', value)} />;
    case 'saleConversion':
      return <LineNumberCell changed={hasChanged(changedCellKeys, line.lineKey, 'saleConversion')} columnKey="saleConversion" editable={editable} line={line} tableSizing={tableSizing} tdClassName="numeric-cell" value={line.saleConversion} onChange={(value) => onNumberChange(line.lineKey, 'saleConversion', value)} />;
    case 'pkhEa':
      return <td {...tableSizing.getCellProps('pkhEa')} className="numeric-cell alloc-readonly">{allocatedCosts ? fmt(allocatedCosts.pkhEa) : '—'}</td>;
    case 'socEa':
      return <td {...tableSizing.getCellProps('socEa')} className="numeric-cell alloc-readonly">{allocatedCosts ? fmt(allocatedCosts.socEa) : '—'}</td>;
    case 'frEa':
      return <td {...tableSizing.getCellProps('frEa')} className="numeric-cell alloc-readonly">{allocatedCosts ? fmt(allocatedCosts.frEa) : '—'}</td>;
    case 'ccEa':
      return <td {...tableSizing.getCellProps('ccEa')} className="numeric-cell alloc-readonly">{allocatedCosts ? fmt(allocatedCosts.ccEa) : '—'}</td>;
    case 'ttEa':
      return <td {...tableSizing.getCellProps('ttEa')} className="numeric-cell alloc-readonly">{allocatedCosts ? fmt(allocatedCosts.ttEa) : '—'}</td>;
    case 'docFeeTotal': {
      const docTotal = line.docFee.coc + line.docFee.millCert + line.docFee.testCert + line.docFee.coa + line.docFee.coo + line.docFee.anyOther;
      return <td {...tableSizing.getCellProps('docFeeTotal')} className="numeric-cell alloc-readonly">{fmt(docTotal)}</td>;
    }
    case 'op1Fcy':
      return <td {...tableSizing.getCellProps('op1Fcy')} className="numeric-cell alloc-readonly">{allocatedCosts ? fmt(allocatedCosts.op1Fcy) : '—'}</td>;
    case 'exRateCol':
      return <td {...tableSizing.getCellProps('exRateCol')} className="numeric-cell alloc-readonly">{allocatedCosts ? fmt(allocatedCosts.exRate) : '—'}</td>;
    case 'op1Thb':
      return <td {...tableSizing.getCellProps('op1Thb')} className="numeric-cell alloc-readonly">{allocatedCosts ? fmt(allocatedCosts.op1Thb) : '—'}</td>;
    case 'insAmount':
      return <td {...tableSizing.getCellProps('insAmount')} className="numeric-cell alloc-readonly">{allocatedCosts ? fmt(allocatedCosts.insAmount) : '—'}</td>;
    case 'cifQTEC':
      return <td {...tableSizing.getCellProps('cifQTEC')} className="numeric-cell alloc-readonly">{allocatedCosts && allocatedCosts.cifQTEC !== undefined ? fmt(allocatedCosts.cifQTEC) : '—'}</td>;
    case 'preQLC':
      return <td {...tableSizing.getCellProps('preQLC')} className="numeric-cell alloc-readonly">{allocatedCosts && allocatedCosts.preQLC !== undefined ? fmt(allocatedCosts.preQLC) : '—'}</td>;
    case 'qlc':
      return <td {...tableSizing.getCellProps('qlc')} className="numeric-cell alloc-readonly">{allocatedCosts && allocatedCosts.qlc !== undefined ? fmt(allocatedCosts.qlc) : '—'}</td>;
    case 'totalQLC':
      return <td {...tableSizing.getCellProps('totalQLC')} className="numeric-cell alloc-readonly">{allocatedCosts && allocatedCosts.totalQLC !== undefined ? fmt(allocatedCosts.totalQLC) : '—'}</td>;
    case 'roundUp':
      return <td {...tableSizing.getCellProps('roundUp')} className="numeric-cell alloc-readonly font-semibold text-slate-900">{allocatedCosts && allocatedCosts.roundUp !== undefined ? fmt(allocatedCosts.roundUp) : '—'}</td>;
    case 'eccn':
      return <td {...tableSizing.getCellProps('eccn')}>{line.eccn || '—'}</td>;
    case 'unspsc':
      return <td {...tableSizing.getCellProps('unspsc')}>{line.unspsc || '—'}</td>;
    case 'eProcurementCode':
      return <td {...tableSizing.getCellProps('eProcurementCode')}>{line.eProcurementCode || '—'}</td>;
    case 'sdsRequired':
      return <td {...tableSizing.getCellProps('sdsRequired')} className="center-cell">{line.sdsRequired || 'No'}</td>;
    case 'certificateRequired':
      return <td {...tableSizing.getCellProps('certificateRequired')} className="center-cell">{line.certificateRequired || 'No'}</td>;
    case 'status':
      return (
        <td {...tableSizing.getCellProps('status')} className="center-cell">
          {missingWeight ? (
            <span className="table-warning">
              <AlertTriangle size={14} aria-hidden="true" />
              No weight
            </span>
          ) : (
            <span className="table-ok">
              <CheckCircle2 size={14} aria-hidden="true" />
              Ready
            </span>
          )}
        </td>
      );
    default:
      return <td {...tableSizing.getCellProps(columnKey)}>-</td>;
  }
}

export interface LineItemGroupCellProps {
  changed: boolean;
  editable: boolean;
  itemGroupOptions: LookupOption[];
  line: AllocationLineSource;
  tableSizing: ResizableTableSizing;
  onChange: (value: string) => void;
}

export function LineItemGroupCell({
  changed,
  editable,
  itemGroupOptions,
  line,
  tableSizing,
  onChange,
}: LineItemGroupCellProps) {
  const options = itemGroupOptions.some((option) => option.value === line.itemGroup)
    ? itemGroupOptions
    : [{ value: line.itemGroup, label: formatItemGroup(line.itemGroup) }, ...itemGroupOptions];
  const displayLabel = options.find((option) => option.value === line.itemGroup)?.label || formatItemGroup(line.itemGroup);

  return (
    <td {...tableSizing.getCellProps('itemGroup')} className={cellChangedClass(changed, 'center-cell')}>
      {editable ? (
        <select
          id={`latest-${line.lineKey}-itemGroup`}
          name={`latest.${line.lineKey}.itemGroup`}
          className="line-edit-input"
          value={line.itemGroup}
          onMouseDownCapture={(e) => ensureSelectSpaceBelow(e.currentTarget)}
          onChange={(event) => onChange(event.target.value)}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : (
        <span>{displayLabel || '-'}</span>
      )}
    </td>
  );
}

function formatItemGroup(value: string): string {
  // Return the raw value as fallback if label is not found
  return value;
}

export interface LineUomCellProps {
  changed: boolean;
  columnKey: string;
  editable: boolean;
  line: AllocationLineSource;
  options: Array<{ value: string; label: string }>;
  tableSizing: ResizableTableSizing;
  value: string;
  onChange: (value: string) => void;
}

export function LineUomCell({
  changed,
  columnKey,
  editable,
  line,
  options,
  tableSizing,
  value,
  onChange,
}: LineUomCellProps) {
  const selectOptions = options.some((option) => option.value === value)
    ? options
    : [{ value, label: value || '-' }, ...options];

  return (
    <td {...tableSizing.getCellProps(columnKey)} className={cellChangedClass(changed, 'center-cell')}>
      {editable && options.length > 0 ? (
        <select
          id={`latest-${line.lineKey}-${columnKey}`}
          name={`latest.${line.lineKey}.${columnKey}`}
          className="line-edit-input"
          value={value}
          onMouseDownCapture={(e) => ensureSelectSpaceBelow(e.currentTarget)}
          onChange={(event) => onChange(event.target.value)}
        >
          {selectOptions.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      ) : (
        <span>{options.find((opt) => opt.value === value)?.label || value || '-'}</span>
      )}
    </td>
  );
}

export interface LineSelectTextCellProps {
  changed: boolean;
  columnKey: string;
  editable: boolean;
  line: AllocationLineSource;
  options: Array<{ value: string; label: string }>;
  tableSizing: ResizableTableSizing;
  value: string;
  onChange: (value: string) => void;
}

export function LineSelectTextCell({
  changed,
  columnKey,
  editable,
  line,
  options,
  tableSizing,
  value,
  onChange,
}: LineSelectTextCellProps) {
  const selectOptions = options.some((option) => option.value === value)
    ? options
    : [{ value, label: value || '-' }, ...options];

  return (
    <td {...tableSizing.getCellProps(columnKey)} className={cellChangedClass(changed, 'center-cell')}>
      {editable && selectOptions.length > 0 ? (
        <select
          id={`latest-${line.lineKey}-${columnKey}`}
          name={`latest.${line.lineKey}.${columnKey}`}
          className="line-edit-input"
          value={value}
          onMouseDownCapture={(event) => ensureSelectSpaceBelow(event.currentTarget)}
          onChange={(event) => onChange(event.target.value)}
        >
          {selectOptions.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      ) : (
        <span>{value || '-'}</span>
      )}
    </td>
  );
}

export interface LineLocationCellProps {
  changed: boolean;
  editable: boolean;
  line: AllocationLineSource;
  locationOptions: LocationLookupOption[];
  tableSizing: ResizableTableSizing;
  onChange: (value: string) => void;
}

export function LineLocationCell({
  changed,
  editable,
  line,
  locationOptions,
  tableSizing,
  onChange,
}: LineLocationCellProps) {
  const options = ensureLocationLookupOption(locationOptions, line.location);
  const selected = options.find((option) => option.code === line.location || option.name === line.location);

  return (
    <td {...tableSizing.getCellProps('location')} className={cellChangedClass(changed, 'center-cell')}>
      {editable ? (
        <select
          id={`latest-${line.lineKey}-location`}
          name={`latest.${line.lineKey}.location`}
          className="line-edit-input"
          value={selected?.code || line.location}
          onMouseDownCapture={(event) => ensureSelectSpaceBelow(event.currentTarget)}
          onChange={(event) => onChange(event.target.value)}
        >
          {options.map((option) => (
            <option key={option.code} value={option.code}>{locationOptionLabel(option)}</option>
          ))}
        </select>
      ) : (
        <span>{selected ? locationOptionLabel(selected) : line.location || '-'}</span>
      )}
    </td>
  );
}

export interface LineLookupTextCellProps {
  changed: boolean;
  columnKey: string;
  editable: boolean;
  line: AllocationLineSource;
  options: LookupOption[];
  tableSizing: ResizableTableSizing;
  value: string;
  onChange: (value: string) => void;
}

export function LineLookupTextCell({
  changed,
  columnKey,
  editable,
  line,
  options,
  tableSizing,
  value,
  onChange,
}: LineLookupTextCellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value || '');
  const [dropdownRect, setDropdownRect] = useState<{ left: number; top: number; width: number; maxHeight: number } | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setInputValue(value || '');
  }, [value]);

  const updateDropdownPosition = useCallback(() => {
    if (typeof window === 'undefined') return;
    const el = inputRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const top = rect.bottom + 4;
    const availableBelow = Math.max(120, window.innerHeight - top - 12);
    setDropdownRect({
      left: rect.left,
      top,
      width: rect.width,
      maxHeight: Math.min(240, availableBelow),
    });
  }, []);

  useEffect(() => {
    if (!isOpen) return undefined;
    updateDropdownPosition();
    window.addEventListener('resize', updateDropdownPosition);
    window.addEventListener('scroll', updateDropdownPosition, true);
    return () => {
      window.removeEventListener('resize', updateDropdownPosition);
      window.removeEventListener('scroll', updateDropdownPosition, true);
    };
  }, [isOpen, updateDropdownPosition]);

  const filtered = useMemo(() => {
    const q = inputValue.toLowerCase().trim();
    if (!q) return options;
    return options.filter((opt) =>
      (opt.label || '').toLowerCase().includes(q) ||
      (opt.value || '').toLowerCase().includes(q)
    );
  }, [options, inputValue]);

  if (!editable) {
    return <LineTextCell changed={changed} columnKey={columnKey} editable={editable} line={line} tableSizing={tableSizing} value={value} onChange={onChange} />;
  }

  return (
    <td {...tableSizing.getCellProps(columnKey)} className={cellChangedClass(changed, 'center-cell relative')}>
      <div className="searchable-lookup-container w-full relative flex items-center">
        <input
          ref={inputRef}
          id={`latest-${line.lineKey}-${columnKey}`}
          name={`latest.${line.lineKey}.${columnKey}`}
          type="text"
          className="line-edit-input w-full"
          style={{ paddingRight: '22px' }}
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            onChange(e.target.value);
            updateDropdownPosition();
            setIsOpen(true);
          }}
          onFocus={(e) => {
            ensureSelectSpaceBelow(e.currentTarget);
            updateDropdownPosition();
            setIsOpen(true);
          }}
          onBlur={() => {
            setTimeout(() => setIsOpen(false), 200);
          }}
        />
        <button
          type="button"
          tabIndex={-1}
          style={{
            position: 'absolute',
            right: '4px',
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '2px',
            display: 'flex',
            alignItems: 'center',
            color: '#9ca3af',
          }}
          onMouseDown={(e) => {
            e.preventDefault();
            if (isOpen) {
              setIsOpen(false);
            } else {
              inputRef.current?.focus();
            }
          }}
        >
          <ChevronDown size={12} />
        </button>
        {isOpen && dropdownRect && typeof document !== 'undefined' && createPortal(
          <div
            className="searchable-lookup-dropdown searchable-lookup-dropdown--portal"
            style={{
              left: dropdownRect.left,
              top: dropdownRect.top,
              width: dropdownRect.width,
              maxHeight: dropdownRect.maxHeight,
            }}
          >
            {filtered.map((opt) => (
              <div
                key={opt.value}
                className={`searchable-lookup-option ${value === opt.value ? 'searchable-lookup-option--selected' : ''}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  setInputValue(opt.label || opt.value);
                  onChange(opt.value);
                  setIsOpen(false);
                }}
              >
                {opt.label || opt.value}
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="searchable-lookup-no-results">
                No match found
              </div>
            )}
          </div>,
          document.body,
        )}
      </div>
    </td>
  );
}

export interface LineCurrencyCellProps {
  changed: boolean;
  currencyOptions: CurrencyLookupOption[];
  editable: boolean;
  line: AllocationLineSource;
  tableSizing: ResizableTableSizing;
  onChange: (value: string) => void;
}

export function LineCurrencyCell({
  changed,
  currencyOptions,
  editable,
  line,
  tableSizing,
  onChange,
}: LineCurrencyCellProps) {
  const options = [
    { code: '', name: '-', exRate: 0 },
    ...ensureCurrencyLookupOption(currencyOptions, line.currency, 0),
  ];
  return (
    <td {...tableSizing.getCellProps('currency')} className={cellChangedClass(changed, 'center-cell')}>
      {editable ? (
        <select
          id={`latest-${line.lineKey}-currency`}
          name={`latest.${line.lineKey}.currency`}
          className="line-edit-input"
          value={line.currency}
          onMouseDownCapture={(e) => ensureSelectSpaceBelow(e.currentTarget)}
          onChange={(event) => onChange(event.target.value)}
        >
          {options.map((option) => (
            <option key={option.code} value={option.code}>
              {option.code || option.name}
            </option>
          ))}
        </select>
      ) : (
        <span>{line.currency || '-'}</span>
      )}
    </td>
  );
}

export interface LineTextCellProps {
  changed: boolean;
  className?: string;
  columnKey: string;
  editable: boolean;
  line: AllocationLineSource;
  stickyStyle?: CSSProperties;
  tableSizing: ResizableTableSizing;
  value: string;
  onChange: (value: string) => void;
}

export function LineTextCell({
  changed,
  className,
  columnKey,
  editable,
  line,
  stickyStyle,
  tableSizing,
  value,
  onChange,
}: LineTextCellProps) {
  return (
    <td {...tableSizing.getCellProps(columnKey)} className={cellChangedClass(changed, className)} style={stickyStyle}>
      {editable ? (
        <input
          id={`latest-${line.lineKey}-${columnKey}`}
          name={`latest.${line.lineKey}.${columnKey}`}
          className="line-edit-input"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <span>{value || '-'}</span>
      )}
    </td>
  );
}

export interface LineYesNoCellProps {
  changed: boolean;
  columnKey: string;
  editable: boolean;
  line: AllocationLineSource;
  tableSizing: ResizableTableSizing;
  value: string;
  onChange: (value: string) => void;
}

export function LineYesNoCell({
  changed,
  columnKey,
  editable,
  line,
  tableSizing,
  value,
  onChange,
}: LineYesNoCellProps) {
  const normalizedValue = formatYesNo(value);

  return (
    <td {...tableSizing.getCellProps(columnKey)} className={cellChangedClass(changed, 'center-cell')}>
      {editable ? (
        <input
          type="checkbox"
          id={`latest-${line.lineKey}-${columnKey}`}
          name={`latest.${line.lineKey}.${columnKey}`}
          checked={normalizedValue === 'Yes'}
          onChange={(event) => onChange(event.target.checked ? 'Yes' : 'No')}
          style={{ width: '16px', height: '16px', cursor: 'pointer', verticalAlign: 'middle' }}
        />
      ) : (
        <input
          type="checkbox"
          checked={normalizedValue === 'Yes'}
          disabled
          style={{ width: '16px', height: '16px', verticalAlign: 'middle', opacity: 0.7 }}
        />
      )}
    </td>
  );
}

export interface LineNumberCellProps {
  changed: boolean;
  columnKey: string;
  editable: boolean;
  line: AllocationLineSource;
  tableSizing: ResizableTableSizing;
  tdClassName?: string;
  value: number;
  onChange: (value: string) => void;
}

export function LineNumberCell({
  changed,
  columnKey,
  editable,
  line,
  tableSizing,
  tdClassName,
  value,
  onChange,
}: LineNumberCellProps) {
  return (
    <td {...tableSizing.getCellProps(columnKey)} className={cellChangedClass(changed, tdClassName)}>
      {editable ? (
        <FormattedNumberInput
          id={`latest-${line.lineKey}-${columnKey}`}
          name={`latest.${line.lineKey}.${columnKey}`}
          className="line-edit-input numeric"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <span>{fmtPlain(value) || '-'}</span>
      )}
    </td>
  );
}

export interface LineNullableNumberCellProps {
  changed: boolean;
  columnKey: string;
  editable: boolean;
  line: AllocationLineSource;
  tableSizing: ResizableTableSizing;
  tdClassName?: string;
  value: number | null;
  onChange: (value: string) => void;
}

export function LineNullableNumberCell({
  changed,
  columnKey,
  editable,
  line,
  tableSizing,
  tdClassName,
  value,
  onChange,
}: LineNullableNumberCellProps) {
  return (
    <td {...tableSizing.getCellProps(columnKey)} className={cellChangedClass(changed, tdClassName)}>
      {editable ? (
        <FormattedNumberInput
          id={`latest-${line.lineKey}-${columnKey}`}
          name={`latest.${line.lineKey}.${columnKey}`}
          className="line-edit-input numeric"
          nullable
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <span>{fmtNullablePlain(value) || '-'}</span>
      )}
    </td>
  );
}

export interface LineDocFeeCellProps {
  changed: boolean;
  editable: boolean;
  field: { key: keyof DocumentFees; label: string };
  line: AllocationLineSource;
  onChange: (value: string) => void;
  onBasisChange: (basis: 'PER_EACH' | 'BY_LOT_BATCH') => void;
}

export function LineDocFeeCell({
  changed,
  editable,
  field,
  line,
  onChange,
  onBasisChange,
}: LineDocFeeCellProps) {
  const value = line.docFee[field.key];
  const basis = line.docFeeBasis?.[field.key] ?? 'PER_EACH';
  const isByLot = basis === 'BY_LOT_BATCH';

  if (!editable) {
    return (
      <span className={changed ? 'line-readonly-modified' : ''}>
        {fmtPlain(value) || '-'}
        {isByLot && value !== 0 && <span className="doc-fee-by-lot-badge"> By Lot</span>}
      </span>
    );
  }

  return (
    <div className="doc-fee-cell-wrap">
      <FormattedNumberInput
        id={`bulk-line-${line.lineKey}-${field.key}`}
        name={`bulkLine.${line.lineKey}.docFee.${field.key}`}
        className={`doc-fee-input ${changed ? 'line-input-modified' : ''}`}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label={`${field.label} fee for ${line.itemCode || line.supplierOrderCode}`}
        title={!isByLot ? 'Per Each: enter amount per 1 unit (divide total by qty if supplier quotes a lump sum)' : 'By Lot/Batch: enter total lump-sum amount for the whole shipment'}
      />
      <div className="doc-fee-basis-toggle" role="group" aria-label={`${field.label} basis`}>
        <button
          type="button"
          className={`doc-fee-basis-btn${!isByLot ? ' active' : ''}`}
          onClick={() => onBasisChange('PER_EACH')}
          title="Per Each — included in OP1"
        >
          /Ea
        </button>
        <button
          type="button"
          className={`doc-fee-basis-btn${isByLot ? ' active by-lot' : ''}`}
          onClick={() => onBasisChange('BY_LOT_BATCH')}
          title="By Lot / Batch — separate service line"
        >
          Lot
        </button>
      </div>
    </div>
  );
}
