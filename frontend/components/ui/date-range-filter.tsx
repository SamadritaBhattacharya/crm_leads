"use client";

import { useEffect, useState } from "react";
import { CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import {
  format,
  subDays,
  subMonths,
  startOfMonth,
  endOfMonth,
} from "date-fns";
import type { DateRange, MonthCaptionProps } from "react-day-picker";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type Preset = "last7days" | "last30days" | "previousFY" | "currentFY";

const PRESETS: { key: Preset; label: string }[] = [
  { key: "last7days", label: "Last 7 days" },
  { key: "last30days", label: "Last 30 days" },
  { key: "previousFY", label: "Prev. FY" },
  { key: "currentFY", label: "Current FY" },
];

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function getDateRangeForPreset(preset: Preset): DateRange {
  const today = new Date();

  switch (preset) {
    case "last7days":
      return { from: subDays(today, 7), to: today };
    case "last30days":
      return { from: subDays(today, 30), to: today };
    case "previousFY": {
      const year = today.getFullYear();
      const month = today.getMonth(); // 0-based, 6 = July
      return month >= 6
        ? { from: new Date(year - 1, 6, 1), to: new Date(year, 5, 30) }
        : { from: new Date(year - 2, 6, 1), to: new Date(year - 1, 5, 30) };
    }
    case "currentFY": {
      const year = today.getFullYear();
      const month = today.getMonth();
      return month >= 6
        ? { from: new Date(year, 6, 1), to: new Date(year + 1, 5, 30) }
        : { from: new Date(year - 1, 6, 1), to: new Date(year, 5, 30) };
    }
  }
}

function getDateRangeForMonth(month: number, year: number): DateRange {
  const start = new Date(year, month, 1);
  return { from: startOfMonth(start), to: endOfMonth(start) };
}

// Compact media-query hook, local to this component — a two-month calendar
// doesn't fit a phone-width popover, so small screens get a single month.
function useIsNarrowViewport() {
  const [isNarrow, setIsNarrow] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(max-width: 640px)").matches
  );

  useEffect(() => {
    const query = window.matchMedia("(max-width: 640px)");
    const listener = (e: MediaQueryListEvent) => setIsNarrow(e.matches);
    query.addEventListener("change", listener);
    return () => query.removeEventListener("change", listener);
  }, []);

  return isNarrow;
}

export function DateRangeFilter<
  F extends { dateFrom?: string; dateTo?: string }
>({
  filters,
  onFiltersChange,
}: {
  filters: F;
  onFiltersChange: (filters: F) => void;
}) {
  const currentYear = new Date().getFullYear();
  const YEARS = Array.from({ length: 6 }, (_, i) => currentYear - i);
  const isNarrow = useIsNarrowViewport();

  const [open, setOpen] = useState(false);
  const [range, setRange] = useState<DateRange | undefined>(
    filters.dateFrom
      ? {
          from: new Date(filters.dateFrom),
          to: filters.dateTo ? new Date(filters.dateTo) : undefined,
        }
      : undefined
  );
  const [viewMonth, setViewMonth] = useState<Date>(range?.from ?? new Date());
  const [selectedMonth, setSelectedMonth] = useState<number | undefined>();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [showFromNav, setShowFromNav] = useState(false);
  const [showToNav, setShowToNav] = useState(false);

  const handleMonthChange = (value: string) => {
    const month = Number(value);
    setSelectedMonth(month);
    const nextRange = getDateRangeForMonth(month, selectedYear);
    setRange(nextRange);
    if (nextRange.from) setViewMonth(nextRange.from);
  };

  const handleYearChange = (value: string) => {
    const year = Number(value);
    setSelectedYear(year);
    const month = selectedMonth ?? viewMonth.getMonth();
    const nextRange = getDateRangeForMonth(month, year);
    if (selectedMonth !== undefined) setRange(nextRange);
    if (nextRange.from) setViewMonth(nextRange.from);
  };

  const handlePresetClick = (preset: Preset) => {
    const nextRange = getDateRangeForPreset(preset);
    setRange(nextRange);
    if (nextRange.from) setViewMonth(nextRange.from);
  };

  const handleApply = () => {
    onFiltersChange({
      ...filters,
      dateFrom: range?.from ? range.from.toISOString() : undefined,
      dateTo: range?.to ? range.to.toISOString() : undefined,
    } as F);
    setOpen(false);
  };

  const handleClear = () => {
    setRange(undefined);
    setSelectedMonth(undefined);
    onFiltersChange({ ...filters, dateFrom: undefined, dateTo: undefined } as F);
    setOpen(false);
  };

  // Each visible panel gets its own "From"/"To" label + a calendar icon that
  // opens a tiny month/year jump menu — inline in the caption itself, not a
  // separate row, to keep the popover short.
  function PanelCaption({
    calendarMonth: panelMonth,
    displayIndex,
    className,
  }: MonthCaptionProps) {
    const isFrom = displayIndex === 0;
    const label = isFrom ? "From" : "To";
    const navOpen = isFrom ? showFromNav : showToNav;
    const month = panelMonth.date.getMonth();
    const year = panelMonth.date.getFullYear();

    const toggleNav = () => {
      if (isFrom) {
        setShowFromNav((s) => !s);
        setShowToNav(false);
      } else {
        setShowToNav((s) => !s);
        setShowFromNav(false);
      }
    };

    // The second panel is always viewMonth + 1 (react-day-picker's own
    // behavior for numberOfMonths=2), so jumping it back-solves for viewMonth.
    const jumpTo = (nextMonth: number, nextYear: number) => {
      const target = new Date(nextYear, nextMonth, 1);
      setViewMonth(isFrom ? target : subMonths(target, 1));
    };

    return (
      <div className={className}>
        <div className="relative flex items-center justify-center gap-1">
          <span className="text-[10px] font-medium tracking-wide text-zinc-400 uppercase">
            {label}
          </span>
          <span className="text-xs font-medium text-zinc-900">
            {format(panelMonth.date, "MMM yyyy")}
          </span>
          <button
            type="button"
            aria-label={`Jump to a month/year (${label.toLowerCase()})`}
            className={cn(
              "rounded p-0.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700",
              navOpen && "bg-zinc-100 text-zinc-700"
            )}
            onClick={toggleNav}
          >
            <CalendarIcon className="size-3" />
          </button>
          {navOpen && (
            <div
              className={cn(
                "absolute top-full z-10 mt-1 flex gap-1 rounded-lg border border-zinc-200 bg-white p-1.5 shadow-lg",
                isFrom ? "left-0" : "right-0"
              )}
            >
              <Select
                value={String(month)}
                onValueChange={(v) => jumpTo(Number(v), year)}
              >
                <SelectTrigger size="sm" className="w-16 text-[11px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m, i) => (
                    <SelectItem key={m} value={String(i)}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={String(year)}
                onValueChange={(v) => jumpTo(month, Number(v))}
              >
                <SelectTrigger size="sm" className="w-14.5 text-[11px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {YEARS.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setShowFromNav(false);
          setShowToNav(false);
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "h-8 gap-1.5 text-xs font-normal text-zinc-600 cursor-pointer",
            filters.dateFrom && "border-zinc-400 text-zinc-900"
          )}
        >
          <CalendarIcon className="size-3.5" />
          {filters.dateFrom
            ? `${format(new Date(filters.dateFrom), "dd MMM")}${
                filters.dateTo
                  ? ` – ${format(new Date(filters.dateTo), "dd MMM")}`
                  : ""
              }`
            : "Date range"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto max-w-[calc(100vw-2rem)] overflow-x-auto p-2">
        <div className="mb-1.5 px-0.5 text-xs font-semibold text-zinc-900">
          Date Range Picker
        </div>

        <div className="flex items-center gap-1 border-b border-zinc-100 pb-1.5">
          <ChevronLeft className="size-3 shrink-0 text-zinc-300" />
          <div className="flex flex-1 flex-wrap items-center justify-center gap-1">
            {PRESETS.map((preset, i) => (
              <div key={preset.key} className="flex items-center gap-1">
                <button
                  type="button"
                  className="rounded px-1 py-0.5 text-[11px] whitespace-nowrap text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                  onClick={() => handlePresetClick(preset.key)}
                >
                  {preset.label}
                </button>
                {i < PRESETS.length - 1 && (
                  <span className="text-zinc-200">|</span>
                )}
              </div>
            ))}
          </div>
          <ChevronRight className="size-3 shrink-0 text-zinc-300" />
        </div>

        <div className="flex items-center gap-1.5 border-b border-zinc-100 py-1.5">
          <Select
            value={selectedMonth !== undefined ? String(selectedMonth) : undefined}
            onValueChange={handleMonthChange}
          >
            <SelectTrigger size="sm" className="w-20 text-[11px]">
              <SelectValue placeholder="Month" />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((m, i) => (
                <SelectItem key={m} value={String(i)}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={String(selectedYear)} onValueChange={handleYearChange}>
            <SelectTrigger size="sm" className="w-18 text-[11px]">
              <SelectValue placeholder="Year" />
            </SelectTrigger>
            <SelectContent>
              {YEARS.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Calendar
          mode="range"
          selected={range}
          onSelect={setRange}
          month={viewMonth}
          onMonthChange={setViewMonth}
          numberOfMonths={isNarrow ? 1 : 2}
          disabled={{ after: new Date() }}
          className="p-0 pt-1"
          classNames={{
            month_caption: "relative flex h-6 items-center justify-center",
            day: "size-6 p-0 text-center text-[11px] relative [&:has([aria-selected])]:bg-zinc-100 first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
            day_button:
              "size-6 p-0 text-[11px] font-normal rounded-md aria-selected:opacity-100 hover:bg-zinc-100",
            weekday: "text-zinc-400 rounded-md w-6 font-normal text-[0.6rem] uppercase",
          }}
          components={{ MonthCaption: PanelCaption }}
        />
        <div className="flex justify-end gap-1.5 border-t border-zinc-100 pt-1.5">
          <Button variant="ghost" size="sm" className="h-7 px-2 text-[11px]" onClick={handleClear}>
            Clear
          </Button>
          <Button size="sm" className="h-7 px-2.5 text-[11px]" onClick={handleApply}>
            Apply
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
