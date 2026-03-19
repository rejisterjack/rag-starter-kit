"use client";

import * as React from "react";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Calendar as CalendarIcon, ChevronDown } from "lucide-react";

export type DateRangePreset =
  | "today"
  | "yesterday"
  | "last7days"
  | "last30days"
  | "thisMonth"
  | "lastMonth"
  | "custom";

export interface DateRange {
  from: Date;
  to: Date;
}

export interface DateRangePickerProps {
  value?: DateRange;
  onChange: (range: DateRange, preset: DateRangePreset) => void;
  presets?: DateRangePreset[];
  align?: "start" | "center" | "end";
  className?: string;
  disabled?: boolean;
  placeholder?: string;
}

const presetConfig: Record<
  DateRangePreset,
  { label: string; getRange: () => DateRange }
> = {
  today: {
    label: "Today",
    getRange: () => ({
      from: startOfDay(new Date()),
      to: endOfDay(new Date()),
    }),
  },
  yesterday: {
    label: "Yesterday",
    getRange: () => {
      const yesterday = subDays(new Date(), 1);
      return {
        from: startOfDay(yesterday),
        to: endOfDay(yesterday),
      };
    },
  },
  last7days: {
    label: "Last 7 days",
    getRange: () => ({
      from: startOfDay(subDays(new Date(), 6)),
      to: endOfDay(new Date()),
    }),
  },
  last30days: {
    label: "Last 30 days",
    getRange: () => ({
      from: startOfDay(subDays(new Date(), 29)),
      to: endOfDay(new Date()),
    }),
  },
  thisMonth: {
    label: "This month",
    getRange: () => {
      const now = new Date();
      return {
        from: startOfDay(new Date(now.getFullYear(), now.getMonth(), 1)),
        to: endOfDay(new Date()),
      };
    },
  },
  lastMonth: {
    label: "Last month",
    getRange: () => {
      const now = new Date();
      return {
        from: startOfDay(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
        to: endOfDay(new Date(now.getFullYear(), now.getMonth(), 0)),
      };
    },
  },
  custom: {
    label: "Custom range",
    getRange: () => ({
      from: startOfDay(subDays(new Date(), 6)),
      to: endOfDay(new Date()),
    }),
  },
};

const defaultPresets: DateRangePreset[] = [
  "today",
  "yesterday",
  "last7days",
  "last30days",
  "thisMonth",
  "lastMonth",
  "custom",
];

function formatDateRange(range: DateRange | undefined): string {
  if (!range || !range.from) return "";
  
  if (!range.to || range.from.getTime() === range.to.getTime()) {
    return format(range.from, "MMM d, yyyy");
  }

  if (range.from.getMonth() === range.to.getMonth() && 
      range.from.getFullYear() === range.to.getFullYear()) {
    return `${format(range.from, "MMM d")} - ${format(range.to, "d, yyyy")}`;
  }

  return `${format(range.from, "MMM d")} - ${format(range.to, "MMM d, yyyy")}`;
}

export function DateRangePicker({
  value,
  onChange,
  presets = defaultPresets,
  align = "start",
  className,
  disabled = false,
  placeholder = "Pick a date range",
}: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [selectedPreset, setSelectedPreset] = React.useState<DateRangePreset | null>(null);
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>(value);
  const [month, setMonth] = React.useState<Date>(value?.from || new Date());

  // Update internal state when value prop changes
  React.useEffect(() => {
    if (value) {
      setDateRange(value);
      setMonth(value.from);
    }
  }, [value]);

  const handlePresetSelect = (preset: DateRangePreset) => {
    if (preset === "custom") {
      setSelectedPreset(preset);
      return;
    }

    const range = presetConfig[preset].getRange();
    setDateRange(range);
    setSelectedPreset(preset);
    onChange(range, preset);
    setOpen(false);
  };

  const handleDateSelect = (range: { from?: Date; to?: Date } | undefined) => {
    if (!range) return;

    const newRange: DateRange = {
      from: range.from ? startOfDay(range.from) : (dateRange?.from || new Date()),
      to: range.to ? endOfDay(range.to) : (range.from ? endOfDay(range.from) : (dateRange?.to || new Date())),
    };

    setDateRange(newRange);

    // Only call onChange if both dates are selected
    if (range.from && range.to) {
      setSelectedPreset("custom");
      onChange(newRange, "custom");
    }
  };

  const displayValue = selectedPreset && selectedPreset !== "custom"
    ? presetConfig[selectedPreset].label
    : formatDateRange(dateRange) || placeholder;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal",
            !dateRange && "text-muted-foreground",
            className
          )}
          disabled={disabled}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          <span className="flex-1 truncate">{displayValue}</span>
          <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align={align}>
        <div className="flex">
          {/* Presets Sidebar */}
          <div className="border-r p-2 space-y-1 min-w-[140px]">
            {presets.map((preset) => (
              <Button
                key={preset}
                variant={selectedPreset === preset ? "secondary" : "ghost"}
                size="sm"
                className="w-full justify-start text-left"
                onClick={() => handlePresetSelect(preset)}
              >
                {presetConfig[preset].label}
              </Button>
            ))}
          </div>

          {/* Calendar */}
          <div className="p-3">
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={month}
              month={month}
              onMonthChange={setMonth}
              selected={{
                from: dateRange?.from,
                to: dateRange?.to,
              }}
              onSelect={handleDateSelect}
              numberOfMonths={2}
            />
          </div>
        </div>
        <div className="border-t p-3 flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {dateRange?.from && dateRange?.to && (
              <>
                {format(dateRange.from, "MMM d, yyyy")} - {format(dateRange.to, "MMM d, yyyy")}
              </>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setDateRange(undefined);
                setSelectedPreset(null);
              }}
            >
              Clear
            </Button>
            <Button
              size="sm"
              onClick={() => {
                if (dateRange?.from && dateRange?.to) {
                  onChange(dateRange, selectedPreset || "custom");
                  setOpen(false);
                }
              }}
              disabled={!dateRange?.from || !dateRange?.to}
            >
              Apply
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Hook for managing date range state
export function useDateRange(
  defaultPreset: DateRangePreset = "last7days"
): {
  range: DateRange;
  preset: DateRangePreset;
  setRange: (range: DateRange, preset: DateRangePreset) => void;
} {
  const [state, setState] = React.useState<{
    range: DateRange;
    preset: DateRangePreset;
  }>(() => ({
    range: presetConfig[defaultPreset].getRange(),
    preset: defaultPreset,
  }));

  const setRange = React.useCallback((range: DateRange, preset: DateRangePreset) => {
    setState({ range, preset });
  }, []);

  return {
    range: state.range,
    preset: state.preset,
    setRange,
  };
}

export default DateRangePicker;
