"use client"

import * as React from "react"
import { Tabs as TabsPrimitive } from "@base-ui/react/tabs"
import { cn } from "@/lib/cn"

// Tabs on Base UI in three looks:
//  - `line` (default): text tabs over a hairline, the active one carried by a 2px ink
//    bar that slides between them (Base UI's Indicator measures the active tab).
//  - `segmented`: a small pill group on a raised track, for a view switch that sits in
//    a toolbar.
//  - `nav`: the section list of a settings dialog. A column of rows from `sm` up (the
//    active row filled, like a selected sidebar row); on a phone the same rows run as a
//    scrolling strip above the content. Pass `orientation="vertical"` to the root.
// Arrow keys move between tabs; the panel keeps focus order (Base UI).

type TabsVariant = "line" | "segmented" | "nav"
const VariantContext = React.createContext<TabsVariant>("line")

function Tabs({
  className,
  variant = "line",
  ...props
}: TabsPrimitive.Root.Props & { variant?: TabsVariant }) {
  return (
    <VariantContext.Provider value={variant}>
      <TabsPrimitive.Root
        data-slot="tabs"
        data-variant={variant}
        className={cn("flex flex-col", variant === "nav" && "min-h-0 flex-1 sm:flex-row", className)}
        {...props}
      />
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
        variant === "line" && "gap-1 shadow-[inset_0_-1px_0_var(--color-line)]",
        variant === "segmented" && "w-fit gap-0.5 rounded-control bg-raised p-0.5 shadow-[inset_0_0_0_1px_var(--color-line)]",
        variant === "nav" &&
          "shrink-0 gap-1 overflow-x-auto border-b border-line px-3 py-2 [scrollbar-width:none] sm:w-52 sm:flex-col sm:items-stretch sm:gap-0.5 sm:overflow-x-visible sm:overflow-y-auto sm:border-r sm:border-b-0 sm:p-3",
        className
      )}
      {...props}
    >
      {children}
      {variant !== "nav" && (
        <TabsPrimitive.Indicator
          className={cn(
            "absolute left-0 transition-[translate,width] duration-200 ease-snappy motion-reduce:transition-none",
            variant === "line"
              ? "bottom-0 h-0.5 w-(--active-tab-width) translate-x-(--active-tab-left) rounded-full bg-fg"
              : "top-0.5 z-0 h-[calc(100%-4px)] w-(--active-tab-width) translate-x-(--active-tab-left) rounded-[calc(var(--radius-control)-2px)] bg-sheet shadow-lift"
          )}
        />
      )}
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
        variant === "line" && "h-9 px-2.5 text-ui",
        variant === "segmented" && "h-7 rounded-[calc(var(--radius-control)-2px)] px-2.5 text-xs",
        variant === "nav" &&
          "h-8 gap-2 rounded-control px-2.5 text-ui hover:bg-hover/60 data-active:bg-hover sm:w-full [&_svg:not([class*='size-'])]:size-3.5",
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
