"use client"

import * as React from "react"
import { Tabs as TabsPrimitive } from "@base-ui/react/tabs"
import { cn } from "@/lib/cn"

// Tabs on Base UI in two looks:
//  - `line` (default): text tabs over a hairline, the active one carried by a 2px ink
//    bar that slides between them (Base UI's Indicator measures the active tab).
//  - `segmented`: a small pill group on a raised track, for a view switch that sits in
//    a toolbar.
// Arrow keys move between tabs; the panel keeps focus order (Base UI).

type TabsVariant = "line" | "segmented"
const VariantContext = React.createContext<TabsVariant>("line")

function Tabs({
  className,
  variant = "line",
  ...props
}: TabsPrimitive.Root.Props & { variant?: TabsVariant }) {
  return (
    <VariantContext.Provider value={variant}>
      <TabsPrimitive.Root data-slot="tabs" data-variant={variant} className={cn("flex flex-col", className)} {...props} />
    </VariantContext.Provider>
  )
}

function TabsList({ className, children, ...props }: TabsPrimitive.List.Props) {
  const variant = React.useContext(VariantContext)
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        "relative flex items-center",
        variant === "line"
          ? "gap-1 shadow-[inset_0_-1px_0_var(--color-line)]"
          : "w-fit gap-0.5 rounded-control bg-raised p-0.5 shadow-[inset_0_0_0_1px_var(--color-line)]",
        className
      )}
      {...props}
    >
      {children}
      <TabsPrimitive.Indicator
        className={cn(
          "absolute left-0 transition-[translate,width] duration-200 ease-snappy motion-reduce:transition-none",
          variant === "line"
            ? "bottom-0 h-0.5 w-(--active-tab-width) translate-x-(--active-tab-left) rounded-full bg-fg"
            : "top-0.5 z-0 h-[calc(100%-4px)] w-(--active-tab-width) translate-x-(--active-tab-left) rounded-[calc(var(--radius-control)-2px)] bg-sheet shadow-lift"
        )}
      />
    </TabsPrimitive.List>
  )
}

function TabsTab({ className, ...props }: TabsPrimitive.Tab.Props) {
  const variant = React.useContext(VariantContext)
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-tab"
      className={cn(
        "relative z-1 inline-flex shrink-0 cursor-pointer items-center gap-1.5 font-medium whitespace-nowrap text-fg-3 transition-colors select-none hover:text-fg-2 data-active:text-fg disabled:pointer-events-none disabled:opacity-45 [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        variant === "line" ? "h-9 px-2.5 text-ui" : "h-7 rounded-[calc(var(--radius-control)-2px)] px-2.5 text-xs",
        className
      )}
      {...props}
    />
  )
}

function TabsPanel({ className, ...props }: TabsPrimitive.Panel.Props) {
  return <TabsPrimitive.Panel data-slot="tabs-panel" className={cn("outline-none", className)} {...props} />
}

export { Tabs, TabsList, TabsPanel, TabsTab }
