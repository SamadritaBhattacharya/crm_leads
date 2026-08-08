"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { motion } from "framer-motion";

import { cn } from "@/lib/utils";

// Radix doesn't hand a trigger's child the active state, and the sliding
// underline needs to know which trigger is active to render the shared
// `layoutId` element there. So we mirror the Root's value into context.
const TabsActiveContext = React.createContext<string | undefined>(undefined);
// A per-instance layoutId keeps two tab bars on one page from sharing one
// underline (which would make it fly across the page between them).
const TabsLayoutIdContext = React.createContext<string>("tabs-underline");

function Tabs({
  value,
  defaultValue,
  onValueChange,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  // Standard controlled/uncontrolled mirror — no effect, so there's no
  // cascading-render lint hit and the underline always tracks the real value.
  const [internal, setInternal] = React.useState<string | undefined>(defaultValue);
  const active = value ?? internal;
  const layoutId = React.useId();

  return (
    <TabsLayoutIdContext.Provider value={layoutId}>
      <TabsActiveContext.Provider value={active}>
        <TabsPrimitive.Root
          value={value}
          defaultValue={defaultValue}
          onValueChange={(next) => {
            if (value === undefined) setInternal(next);
            onValueChange?.(next);
          }}
          {...props}
        />
      </TabsActiveContext.Provider>
    </TabsLayoutIdContext.Provider>
  );
}

function TabsList({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn("inline-flex w-full items-center gap-4 overflow-x-auto", className)}
      {...props}
    />
  );
}

function TabsTrigger({
  className,
  value,
  children,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  const active = React.useContext(TabsActiveContext);
  const layoutId = React.useContext(TabsLayoutIdContext);
  const isActive = active === value;

  return (
    <TabsPrimitive.Trigger
      value={value}
      className={cn(
        "relative -mb-px inline-flex cursor-pointer items-center gap-1.5 px-0.5 py-1.5 text-xs whitespace-nowrap font-medium text-zinc-500 outline-none transition-colors",
        "hover:text-zinc-900 disabled:pointer-events-none disabled:opacity-50",
        "data-[state=active]:font-semibold data-[state=active]:text-zinc-900",
        className
      )}
      {...props}
    >
      {children}
      {isActive && (
        // Shared layoutId: mounting this under the newly-active trigger while
        // it unmounts from the old one makes framer slide the same bar across.
        <motion.span
          layoutId={layoutId}
          className="absolute inset-x-0 -bottom-0.5 h-0.5 rounded-full bg-zinc-900"
          transition={{ type: "spring", stiffness: 500, damping: 40 }}
        />
      )}
    </TabsPrimitive.Trigger>
  );
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content className={cn("outline-none", className)} {...props} />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
