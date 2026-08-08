'use client';

import { useState } from 'react';
import {
  format,
  subDays,
  subMonths,
  subYears,
  startOfMonth,
  startOfYear,
  endOfDay,
  endOfMonth,
  endOfYear,
} from 'date-fns';

export interface DateRange {
  startDate: Date | null;
  endDate: Date | null;
}

interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  onCompareChange?: (enabled: boolean) => void;
  compareEnabled?: boolean;
  /** When true (default), start/end cannot be after today. */
  disallowFutureDates?: boolean;
}

function startOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function clampToToday(date: Date | null, disallowFuture: boolean): Date | null {
  if (!date || !disallowFuture) return date;
  const today = startOfLocalDay(new Date());
  return startOfLocalDay(date) > today ? today : date;
}

export function DateRangePicker({
  value,
  onChange,
  onCompareChange,
  compareEnabled = false,
  disallowFutureDates = true,
}: DateRangePickerProps) {
  const [showPresets, setShowPresets] = useState(false);
  const todayMax = format(new Date(), 'yyyy-MM-dd');

  const presets = [
    { label: 'Today', getRange: () => ({ startDate: new Date(), endDate: new Date() }) },
    {
      label: 'Last 7 Days',
      getRange: () => ({ startDate: subDays(new Date(), 7), endDate: new Date() }),
    },
    {
      label: 'Last 30 Days',
      getRange: () => ({ startDate: subDays(new Date(), 30), endDate: new Date() }),
    },
    {
      label: 'This Month',
      getRange: () => ({ startDate: startOfMonth(new Date()), endDate: new Date() }),
    },
    {
      label: 'Last Month',
      getRange: () => {
        const lastMonth = subMonths(new Date(), 1);
        return {
          startDate: startOfMonth(lastMonth),
          endDate: endOfDay(endOfMonth(lastMonth)),
        };
      },
    },
    {
      label: 'Last 3 Months',
      getRange: () => ({ startDate: subMonths(new Date(), 3), endDate: new Date() }),
    },
    {
      label: 'Last 6 Months',
      getRange: () => ({ startDate: subMonths(new Date(), 6), endDate: new Date() }),
    },
    {
      label: 'This Year',
      getRange: () => ({ startDate: startOfYear(new Date()), endDate: new Date() }),
    },
    {
      label: 'Last Year',
      getRange: () => {
        const lastYear = subYears(new Date(), 1);
        return {
          startDate: startOfYear(lastYear),
          endDate: endOfDay(endOfYear(lastYear)),
        };
      },
    },
  ];

  const applyPreset = (preset: typeof presets[0]) => {
    const range = preset.getRange();
    onChange({
      startDate: clampToToday(range.startDate, disallowFutureDates),
      endDate: clampToToday(range.endDate, disallowFutureDates),
    });
    setShowPresets(false);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-hos-text-secondary">Start Date:</label>
          <input
            type="date"
            max={disallowFutureDates ? todayMax : undefined}
            value={value.startDate ? format(value.startDate, 'yyyy-MM-dd') : ''}
            onChange={(e) => {
              const next = e.target.value ? new Date(e.target.value) : null;
              onChange({ ...value, startDate: clampToToday(next, disallowFutureDates) });
            }}
            className="px-3 py-1.5 border border-hos-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-hos-gold/50"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-hos-text-secondary">End Date:</label>
          <input
            type="date"
            max={disallowFutureDates ? todayMax : undefined}
            value={value.endDate ? format(value.endDate, 'yyyy-MM-dd') : ''}
            onChange={(e) => {
              const next = e.target.value ? new Date(e.target.value) : null;
              onChange({ ...value, endDate: clampToToday(next, disallowFutureDates) });
            }}
            className="px-3 py-1.5 border border-hos-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-hos-gold/50"
          />
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowPresets(!showPresets)}
            className="px-3 py-1.5 text-sm font-medium text-hos-text-secondary bg-hos-bg-secondary border border-hos-border rounded-md hover:bg-hos-bg-tertiary focus:outline-none focus:ring-2 focus:ring-hos-gold/50"
          >
            Presets ▼
          </button>
          {showPresets && (
            <div className="absolute z-10 mt-1 w-48 bg-hos-bg-secondary border border-hos-border rounded-md shadow-lg">
              <div className="py-1">
                {presets.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => applyPreset(preset)}
                    className="w-full text-left px-4 py-2 text-sm text-hos-text-secondary hover:bg-hos-bg-tertiary"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        {onCompareChange && (
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={compareEnabled}
              onChange={(e) => onCompareChange(e.target.checked)}
              className="w-4 h-4 text-hos-gold border-hos-border rounded focus:ring-hos-gold/50"
            />
            <span className="text-sm font-medium text-hos-text-secondary">Compare with Previous Period</span>
          </label>
        )}
      </div>
    </div>
  );
}
