'use client';

import { useState } from 'react';
import { format, subDays, subMonths, subYears, startOfMonth, startOfYear, endOfDay } from 'date-fns';

export interface DateRange {
  startDate: Date | null;
  endDate: Date | null;
}

interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  onCompareChange?: (enabled: boolean) => void;
  compareEnabled?: boolean;
}

export function DateRangePicker({
  value,
  onChange,
  onCompareChange,
  compareEnabled = false,
}: DateRangePickerProps) {
  const [showPresets, setShowPresets] = useState(false);

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
        const now = new Date();
        const lastMonth = subMonths(now, 1);
        return {
          startDate: startOfMonth(lastMonth),
          endDate: endOfDay(subMonths(startOfMonth(now), 1)),
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
        const now = new Date();
        const lastYear = subYears(now, 1);
        return {
          startDate: startOfYear(lastYear),
          endDate: endOfDay(subYears(startOfYear(now), 1)),
        };
      },
    },
  ];

  const applyPreset = (preset: typeof presets[0]) => {
    const range = preset.getRange();
    onChange(range);
    setShowPresets(false);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Start Date:</label>
          <input
            type="date"
            value={value.startDate ? format(value.startDate, 'yyyy-MM-dd') : ''}
            onChange={(e) => {
              onChange({ ...value, startDate: e.target.value ? new Date(e.target.value) : null });
            }}
            className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">End Date:</label>
          <input
            type="date"
            value={value.endDate ? format(value.endDate, 'yyyy-MM-dd') : ''}
            onChange={(e) => {
              onChange({ ...value, endDate: e.target.value ? new Date(e.target.value) : null });
            }}
            className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowPresets(!showPresets)}
            className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Presets ▼
          </button>
          {showPresets && (
            <div className="absolute z-10 mt-1 w-48 bg-white border border-gray-300 rounded-md shadow-lg">
              <div className="py-1">
                {presets.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => applyPreset(preset)}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
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
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-gray-700">Compare with Previous Period</span>
          </label>
        )}
      </div>
    </div>
  );
}
