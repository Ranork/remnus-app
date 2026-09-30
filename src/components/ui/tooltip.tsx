"use client"

import * as React from "react"
import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip"
import { cn } from "@/lib/cn"

// Tooltip on Base UI. Inverted (foreground-on-background) so it reads against any
// surface in any theme; portals to <body> above everything (z-9999). Hints only — a
// tooltip never holds the only copy of something the user needs to act (WCAG 1.4.13;
// Base UI keeps it hoverable and dismissable with Escape).
//
//   <Tooltip content="Kenar çubuğunu gizle" shortcut="Ctrl \">
//     <button …/>
//   </Tooltip>

function TooltipProvider({ delay = 350, closeDelay = 0, ...props }: TooltipPrimitive.Provider.Props) {
  return <TooltipPrimitive.Provider delay={delay} closeDelay={closeDelay} {...props} />
}

function TooltipRoot(props: TooltipPrimitive.Root.Props) {
  return <TooltipPrimitive.Root data-slot="tooltip" {...props} />
}

function TooltipTrigger(props: TooltipPrimitive.Trigger.Props) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />
}

function TooltipContent({
  className,
  side = "top",
  sideOffset = 6,
  align = "center",
  children,
  ...props
}: TooltipPrimitive.Popup.Props &
  Pick<TooltipPrimitive.Positioner.Props, "side" | "sideOffset" | "align">) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Positioner side={side} sideOffset={sideOffset} align={align} className="isolate z-9999">
        <TooltipPrimitive.Popup
          data-slot="tooltip-content"
          className={cn(
            "flex max-w-72 origin-(--transform-origin) items-center gap-2 rounded-control bg-fg px-2 py-1 text-2xs leading-4 font-medium text-desk shadow-float transition-[transform,opacity] duration-100 data-ending-style:scale-[0.97] data-ending-style:opacity-0 data-instant:transition-none data-starting-style:scale-[0.97] data-starting-style:opacity-0",
            className
          )}
          {...props}
        >
          {children}
        </TooltipPrimitive.Popup>
      </TooltipPrimitive.Positioner>
    </TooltipPrimitive.Portal>
  )
}

/** The one-liner most call sites want: wraps `children` as the trigger. */
function Tooltip({
  content,
  shortcut,
  side,
  children,
  disabled,
}: {
  content: React.ReactNode
  /** A key hint shown after the text, e.g. "Ctrl K". */
  shortcut?: string
  side?: "top" | "bottom" | "left" | "right"
  /** The trigger element; it receives the trigger props through Base UI's `render`. */
  children: React.ReactElement
  disabled?: boolean
}) {
  if (disabled) return children
  return (
    <TooltipRoot>
      <TooltipTrigger delay={350} render={children} />
      <TooltipContent side={side}>
        <span>{content}</span>
        {shortcut && <span className="font-mono text-2xs opacity-60">{shortcut}</span>}
      </TooltipContent>
    </TooltipRoot>
  )
}

export { Tooltip, TooltipContent, TooltipProvider, TooltipRoot, TooltipTrigger }
