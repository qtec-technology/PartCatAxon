import { useState, useEffect, type ChangeEvent, type InputHTMLAttributes } from 'react';
import { Info } from 'lucide-react';
import type { LineFieldKey, LineChange } from './BulkCostWorkspace';
import { formatMatchStatus, formatDisplayNumber, toEditableNumber } from './bulk-cost.format';

export interface ChangesTableProps {
  changes: LineChange[];
  onResetField: (lineKey: string, fieldKey: LineFieldKey) => void;
}

export function ChangesTable({ changes, onResetField }: ChangesTableProps) {
  if (changes.length === 0) {
    return (
      <div className="preview-empty changes-empty">
        <Info size={28} aria-hidden="true" />
        <p>No changes from Origin.</p>
        <small>Latest currently matches the saved/manual baseline.</small>
      </div>
    );
  }

  return (
    <div className="table-scroll changes-table-scroll">
      <table className="prototype-table changes-table">
        <thead>
          <tr>
            <th>No</th>
            <th>Match</th>
            <th>Field</th>
            <th>Origin</th>
            <th>Latest</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {changes.map((change) => (
            <tr key={`${change.lineKey}-${change.fieldKey}`}>
              <td>{change.no}</td>
              <td>{formatMatchStatus(change.itemCode)}</td>
              <td className="text-left-cell"><strong>{change.label}</strong></td>
              <td className="text-left-cell change-origin">{change.originValue || '-'}</td>
              <td className="text-left-cell change-latest">{change.latestValue || '-'}</td>
              <td>
                <button
                  type="button"
                  className="table-action-button compact"
                  onClick={() => onResetField(change.lineKey, change.fieldKey)}
                >
                  Reset
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export interface SummaryItemProps {
  label: string;
  value: string;
  warning?: string;
  className?: string;
}

export function SummaryItem({ label, value, warning, className }: SummaryItemProps) {
  return (
    <div className={className}>
      <span>{label}</span>
      <strong>{value}</strong>
      {warning && <small className="summary-warning">{warning}</small>}
    </div>
  );
}

export type FormattedNumberInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
  value: number | null | undefined;
  nullable?: boolean;
  focused?: boolean;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
};

export function FormattedNumberInput({
  value,
  nullable = false,
  focused,
  onBlur,
  onChange,
  onFocus,
  ...props
}: FormattedNumberInputProps) {
  const [internalFocused, setInternalFocused] = useState(false);
  const [draft, setDraft] = useState('');
  const isFocused = focused ?? internalFocused;

  useEffect(() => {
    if (!isFocused) setDraft(formatDisplayNumber(value, nullable));
  }, [isFocused, nullable, value]);

  return (
    <input
      {...props}
      inputMode="decimal"
      value={isFocused ? draft : formatDisplayNumber(value, nullable)}
      onBlur={(event) => {
        setInternalFocused(false);
        setDraft(formatDisplayNumber(value, nullable));
        onBlur?.(event);
      }}
      onChange={(event) => {
        setDraft(event.target.value);
        onChange(event);
      }}
      onFocus={(event) => {
        setInternalFocused(true);
        const editableValue = toEditableNumber(value);
        const input = event.currentTarget;
        setDraft(editableValue === '0' ? '' : editableValue);
        if (editableValue !== '0') {
          window.requestAnimationFrame(() => input.select());
        }
        onFocus?.(event);
      }}
    />
  );
}
