"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  components,
  ...props
}: React.ComponentProps<typeof DayPicker>) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-2", className)}
      classNames={{
        months: "flex flex-col sm:flex-row gap-2",
        month: "flex flex-col gap-3",
        month_caption: "flex justify-center pt-1 relative items-center h-8",
        caption_label: "text-sm font-medium text-zinc-900",
        nav: "flex items-center justify-between absolute inset-x-0 top-0 h-8",
        button_previous: cn(
          buttonVariants({ variant: "ghost", size: "icon-sm" }),
          "text-zinc-500"
        ),
        button_next: cn(
          buttonVariants({ variant: "ghost", size: "icon-sm" }),
          "text-zinc-500"
        ),
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday:
          "text-zinc-400 rounded-md w-8 font-normal text-[0.7rem] uppercase",
        week: "flex w-full mt-1",
        day: "size-8 p-0 text-center text-sm relative [&:has([aria-selected])]:bg-zinc-100 first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
        day_button: cn(
          buttonVariants({ variant: "ghost" }),
          "size-8 p-0 font-normal rounded-md aria-selected:opacity-100 hover:bg-zinc-100"
        ),
        range_start: "rounded-l-md bg-zinc-900! [&>button]:bg-zinc-900! [&>button]:text-white!",
        range_end: "rounded-r-md bg-zinc-900! [&>button]:bg-zinc-900! [&>button]:text-white!",
        range_middle:
          "bg-zinc-100 [&>button]:bg-transparent [&>button]:text-zinc-900",
        selected: "[&>button]:bg-zinc-900! [&>button]:text-white!",
        today: "[&>button]:font-semibold [&>button]:text-zinc-900",
        outside: "text-zinc-300 aria-selected:text-zinc-400",
        disabled: "text-zinc-300 opacity-50",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) =>
          orientation === "left" ? (
            <ChevronLeft className="size-4" />
          ) : (
            <ChevronRight className="size-4" />
          ),
        ...components,
      }}
      {...props}
    />
  );
}

export { Calendar };
