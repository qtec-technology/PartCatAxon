import React from 'react';

function numberFormat(num: number, digits = 2) {
    return num.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

interface NumberInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
    value: number;
    onChange: (val: number) => void;
    precision?: number;
    zeroAsInteger?: boolean;
}

export function NumberInput({
    value,
    onChange,
    precision = 2,
    zeroAsInteger,
    ...inputProps
}: NumberInputProps) {
    const generatedId = React.useId();
    const [isFocused, setIsFocused] = React.useState(false);
    const [localVal, setLocalVal] = React.useState('');
    const fieldId = String(inputProps.id || generatedId);
    const fieldName = String(inputProps.name || fieldId);

    React.useEffect(() => {
        if (!isFocused) {
            if (zeroAsInteger && value === 0) {
                setLocalVal('0');
            } else {
                setLocalVal(numberFormat(value, precision));
            }
        }
    }, [value, isFocused, precision, zeroAsInteger]);

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
        setIsFocused(true);
        setLocalVal(value === 0 ? '' : value.toString());
        e.target.select();
    };

    const handleBlur = () => {
        setIsFocused(false);
        const parsed = parseFloat(localVal.replace(/,/g, ''));
        if (!isNaN(parsed)) {
            onChange(parsed);
            setLocalVal(numberFormat(parsed, precision));
        } else {
            onChange(0);
            setLocalVal(zeroAsInteger ? '0' : numberFormat(0, precision));
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const v = e.target.value;
        const regex = precision === 0 ? /^\d*$/ : /^\d*\.?\d*$/;
        if (regex.test(v)) {
            setLocalVal(v);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const form = e.currentTarget.closest('form') || document.body;
            const inputs = Array.from(form.querySelectorAll('input:not([disabled]), select:not([disabled]), textarea:not([disabled])')) as HTMLElement[];
            const index = inputs.indexOf(e.currentTarget);
            if (index !== -1 && index < inputs.length - 1) {
                inputs[index + 1].focus();
            }
        }
    };

    return <input
        type="text"
        id={fieldId}
        name={fieldName}
        value={localVal}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        {...inputProps}
    />;
}
