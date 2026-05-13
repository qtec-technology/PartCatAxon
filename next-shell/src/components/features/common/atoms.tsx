import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const MIN_SELECT_SPACE_BELOW_PX = 320;

const findScrollableParent = (element: HTMLElement | null): HTMLElement | null => {
  let parent = element?.parentElement || null;
  while (parent) {
    const style = window.getComputedStyle(parent);
    const canScrollY = /(auto|scroll)/.test(style.overflowY);
    if (canScrollY && parent.scrollHeight > parent.clientHeight) {
      return parent;
    }
    parent = parent.parentElement;
  }
  return null;
};

const ensureSelectSpaceBelow = (selectEl: HTMLSelectElement) => {
  if (typeof window === 'undefined') return;

  const rect = selectEl.getBoundingClientRect();
  const scrollParent = findScrollableParent(selectEl);

  if (scrollParent) {
    const parentRect = scrollParent.getBoundingClientRect();
    const spaceBelow = parentRect.bottom - rect.bottom;
    if (spaceBelow >= MIN_SELECT_SPACE_BELOW_PX) return;
    const delta = MIN_SELECT_SPACE_BELOW_PX - spaceBelow + 8;
    scrollParent.scrollTop += delta;
    return;
  }

  const viewportSpaceBelow = window.innerHeight - rect.bottom;
  if (viewportSpaceBelow >= MIN_SELECT_SPACE_BELOW_PX) return;
  const delta = MIN_SELECT_SPACE_BELOW_PX - viewportSpaceBelow + 8;
  window.scrollBy({ top: delta, behavior: 'auto' });
};

// COLORS
export const THEME = {
  blue: '#2264A0',
  green: '#5AA02A',
  red: '#C12B2B',
  orange: '#F58300',
  gray: '#8C8C8C',
  bgGray: '#F5F5F5',
};

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'success' | 'danger' | 'warning' | 'neutral' | 'ghost';
  size?: 'sm' | 'md';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'neutral', size = 'md', ...props }, ref) => {
    const variants = {
      primary: 'bg-[#2264A0] text-white hover:bg-[#1A4B78]',
      success: 'bg-[#5AA02A] text-white hover:bg-[#468020]',
      danger: 'bg-[#C12B2B] text-white hover:bg-[#9B2222]',
      warning: 'bg-[#F58300] text-white hover:bg-[#C96B00]',
      neutral: 'bg-[#8C8C8C] text-white hover:bg-[#707070]',
      ghost: 'bg-transparent text-[#2264A0] hover:bg-blue-50',
    };

    const sizes = {
      sm: 'px-2 py-1 text-xs',
      md: 'px-4 py-2 text-sm',
    };

    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center rounded transition-colors disabled:opacity-50 disabled:pointer-events-none font-medium gap-2',
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export const Badge = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <span className={cn('bg-[#2264A0] text-white px-3 py-1 rounded text-sm font-bold', className)}>
    {children}
  </span>
);

export const SectionHeader = ({ title }: { title: string }) => (
  <div className="bg-[#2264A0] text-white px-4 py-2 font-bold text-sm rounded-t-md">
    {title}
  </div>
);

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  required?: boolean;
  fullWidth?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, required, fullWidth, className, ...props }, ref) => {
    const generatedId = React.useId();
    const fieldId = String(props.id || generatedId);
    const fieldName = String(props.name || fieldId);

    return (
      <div className={cn('mb-3', fullWidth ? 'w-full' : '')}>
        {label && (
          <label htmlFor={fieldId} className="block text-xs font-bold text-gray-700 mb-1">
            {label}
            {required && <span className="text-[#C12B2B] ml-1">*</span>}
          </label>
        )}
        <input
          ref={ref}
          id={fieldId}
          name={fieldName}
          className={cn(
            'border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:border-[#2264A0] focus:ring-1 focus:ring-[#2264A0] disabled:bg-[#F5F5F5] disabled:text-gray-500',
            fullWidth ? 'w-full' : '',
            error ? 'border-[#C12B2B]' : '',
            className
          )}
          {...props}
        />
        {error && <p className="text-[#C12B2B] text-xs mt-1">{error}</p>}
      </div>
    );
  }
);
Input.displayName = 'Input';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  required?: boolean;
  options: Array<string | { value: string; label: string }>;
  placeholder?: string;
  showPlaceholderOption?: boolean;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, required, options, placeholder, showPlaceholderOption = true, className, onMouseDownCapture, onTouchStartCapture, ...props }, ref) => {
    const generatedId = React.useId();
    const fieldId = String(props.id || generatedId);
    const fieldName = String(props.name || fieldId);

    return (
      <div className="mb-3 w-full">
        {label && (
          <label htmlFor={fieldId} className="block text-xs font-bold text-gray-700 mb-1">
            {label}
            {required && <span className="text-[#C12B2B] ml-1">*</span>}
          </label>
        )}
        <select
          ref={ref}
          id={fieldId}
          name={fieldName}
          className={cn(
            'w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:border-[#2264A0] focus:ring-1 focus:ring-[#2264A0] disabled:bg-[#F5F5F5] disabled:text-gray-500',
            error ? 'border-[#C12B2B]' : '',
            className
          )}
          onMouseDownCapture={(event) => {
            ensureSelectSpaceBelow(event.currentTarget);
            onMouseDownCapture?.(event);
          }}
          onTouchStartCapture={(event) => {
            ensureSelectSpaceBelow(event.currentTarget);
            onTouchStartCapture?.(event);
          }}
          {...props}
        >
          {showPlaceholderOption && (
            <option value="" disabled hidden>
              {placeholder || '- Select -'}
            </option>
          )}
          {options.map((opt) => {
            const value = typeof opt === 'string' ? opt : opt.value;
            const label = typeof opt === 'string' ? opt : opt.label;
            return (
              <option key={value} value={value}>
                {label}
              </option>
            );
          })}
        </select>
        {error && <p className="text-[#C12B2B] text-xs mt-1">{error}</p>}
      </div>
    );
  }
);
Select.displayName = 'Select';

interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  required?: boolean;
}

export const TextArea = React.forwardRef<HTMLTextAreaElement, TextAreaProps>(
  ({ label, error, required, className, ...props }, ref) => {
    const generatedId = React.useId();
    const fieldId = String(props.id || generatedId);
    const fieldName = String(props.name || fieldId);

    return (
      <div className="mb-3 w-full">
        {label && (
          <label htmlFor={fieldId} className="block text-xs font-bold text-gray-700 mb-1">
            {label}
            {required && <span className="text-[#C12B2B] ml-1">*</span>}
          </label>
        )}
        <textarea
          ref={ref}
          id={fieldId}
          name={fieldName}
          className={cn(
            'w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:border-[#2264A0] focus:ring-1 focus:ring-[#2264A0] disabled:bg-[#F5F5F5] disabled:text-gray-500',
            error ? 'border-[#C12B2B]' : '',
            className
          )}
          {...props}
        />
        {error && <p className="text-[#C12B2B] text-xs mt-1">{error}</p>}
      </div>
    );
  }
);
TextArea.displayName = 'TextArea';

interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, className, ...props }, ref) => {
    const generatedId = React.useId();
    const fieldId = String(props.id || generatedId);
    const fieldName = String(props.name || fieldId);
    return (
      <label htmlFor={fieldId} className="flex items-center gap-2 cursor-pointer select-none text-xs text-gray-700 mb-1">
        <input
          ref={ref}
          id={fieldId}
          name={fieldName}
          type="checkbox"
          className={cn(
            'rounded border-gray-300 text-[#5AA02A] focus:ring-[#5AA02A] h-4 w-4',
            className
          )}
          {...props}
        />
        {label}
      </label>
    );
  }
);
Checkbox.displayName = 'Checkbox';
