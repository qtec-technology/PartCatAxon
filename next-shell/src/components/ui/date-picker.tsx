import * as React from "react"
import { format, parseISO, isValid } from "date-fns"
import { Calendar as CalendarIcon } from "lucide-react"

import { cn } from "./utils"
import { Button } from "./button"
import { Calendar } from "./calendar"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "./popover"

interface DatePickerProps {
    value?: string | null // YYYY-MM-DD or ISO string
    onChange: (date: string) => void
    disabled?: boolean
    className?: string
    placeholder?: string
    id?: string
    'aria-label'?: string
}

export function DatePicker({ value, onChange, disabled, className, placeholder = "Pick a date", id, 'aria-label': ariaLabel }: DatePickerProps) {
    const generatedId = React.useId();
    const buttonId = String(id || generatedId);
    const buttonName = buttonId;

    // Parse initial date safely
    const dateValue = React.useMemo(() => {
        if (!value) return undefined;
        const d = parseISO(value);
        return isValid(d) ? d : undefined;
    }, [value]);

    const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(dateValue);

    // Sync state with prop
    React.useEffect(() => {
        setSelectedDate(dateValue);
    }, [dateValue]);

    const handleSelect = (d: Date | undefined) => {
        setSelectedDate(d);
        if (d) {
            onChange(format(d, 'yyyy-MM-dd'));
        } else {
            onChange('');
        }
    };

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button
                    id={buttonId}
                    name={buttonName}
                    aria-label={ariaLabel}
                    variant={"outline"}
                    disabled={disabled}
                    className={cn(
                        "justify-start text-left font-normal bg-white border-gray-400 text-xs px-2 py-1 h-auto w-full",
                        !value && "text-muted-foreground",
                        "focus:border-[#2264A0] focus:ring-1 focus:ring-[#2264A0]",
                        className
                    )}
                >
                    <CalendarIcon className="mr-1.5 h-3 w-3 shrink-0 opacity-70 text-gray-600" />
                    {dateValue ? format(dateValue, "dd-MMM-yyyy") : <span>{placeholder}</span>}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={handleSelect}
                    initialFocus
                />
            </PopoverContent>
        </Popover>
    )
}
