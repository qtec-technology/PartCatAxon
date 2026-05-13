import * as React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';

const EMPTY_OPTION_VALUE = '__inline_select_empty__';
const DEFAULT_CLEAR_LABELS = new Set([
  '',
  'please select',
  '- please select -',
  '- select -',
  'select',
]);

export interface InlineSelectOption {
  value: string;
  label: string;
  subLabel?: React.ReactNode;
  disabled?: boolean;
}

interface InlineSelectProps {
  id?: string;
  name?: string;
  value?: string | number | null;
  onValueChange: (value: string) => void;
  options: InlineSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  allowClear?: boolean;
  clearLabel?: string;
  className?: string;
  contentClassName?: string;
  itemClassName?: string;
  ariaLabel?: string;
  size?: 'sm' | 'default';
}

export const InlineSelect = React.forwardRef<HTMLButtonElement, InlineSelectProps>(
  (
    {
      id,
      name,
      value,
      onValueChange,
      options,
      placeholder = 'Please select',
      disabled = false,
      allowClear = false,
      clearLabel,
      className,
      contentClassName,
      itemClassName,
      ariaLabel,
      size = 'default',
    },
    ref
  ) => {
    const normalizedValue = value === null || value === undefined ? '' : String(value);
    const generatedId = React.useId();
    const triggerId = String(id || generatedId);
    const triggerName = String(name || triggerId);
    const hasMatchingOption = React.useMemo(
      () => options.some((option) => String(option.value) === normalizedValue),
      [normalizedValue, options]
    );
    const displayOptions = React.useMemo(
      () => (
        normalizedValue && !hasMatchingOption
          ? [{ value: normalizedValue, label: normalizedValue }, ...options]
          : options
      ),
      [hasMatchingOption, normalizedValue, options]
    );
    const normalizedPlaceholder = String(placeholder || '').trim().toLowerCase();
    const normalizedClearLabel = String(clearLabel || '').trim().toLowerCase();
    const hasBuiltInClearOption = displayOptions.some((option) => {
      const optionValue = String(option.value || '').trim().toLowerCase();
      const optionLabel = String(option.label || '').trim().toLowerCase();

      if (optionValue === '' || optionValue === '_null' || optionValue === 'null') {
        return true;
      }

      if (DEFAULT_CLEAR_LABELS.has(optionLabel)) {
        return true;
      }

      if (normalizedPlaceholder && optionLabel === normalizedPlaceholder) {
        return true;
      }

      if (normalizedClearLabel && optionLabel === normalizedClearLabel) {
        return true;
      }

      return false;
    });

    return (
      <Select
        name={triggerName}
        value={normalizedValue}
        onValueChange={(nextValue) => onValueChange(nextValue === EMPTY_OPTION_VALUE ? '' : nextValue)}
        disabled={disabled}
      >
        <SelectTrigger
          ref={ref}
          id={triggerId}
          name={triggerName}
          size={size}
          aria-label={ariaLabel}
          className={className}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent side="bottom" avoidCollisions={false} className={contentClassName}>
          {allowClear && !hasBuiltInClearOption ? (
            <SelectItem value={EMPTY_OPTION_VALUE} className={itemClassName}>
              {clearLabel || placeholder}
            </SelectItem>
          ) : null}
          {displayOptions.map((option) => (
            <SelectItem
              key={`${option.value}-${option.label}`}
              value={option.value}
              subLabel={option.subLabel}
              disabled={option.disabled}
              className={itemClassName}
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }
);

InlineSelect.displayName = 'InlineSelect';
