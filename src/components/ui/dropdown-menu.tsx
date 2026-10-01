"use client"

import * as React from "react"
import { Menu as MenuPrimitive } from "@base-ui/react/menu"
import { CheckIcon } from "lucide-react"
import { cn } from "@/lib/cn"

// shadcn/ui DropdownMenu on Base UI, in the R8 language (bg-float surface, shadow-float
// edge, rounded-control rows). Like Select, the popup portals to <body> on z-9999 so it
// opens in front of the z-300 modals and the z-200 mobile sheets. Only the parts the app
// uses are here; add the rest from `npx shadcn add dropdown-menu` when needed and map
// its token classes onto ours (popover → float, accent → hover, muted-foreground → fg-3).

function DropdownMenu({ ...props }: MenuPrimitive.Root.Props) {
  return <MenuPrimitive.Root data-slot="dropdown-menu" {...props} />
}

function DropdownMenuTrigger({ ...props }: MenuPrimitive.Trigger.Props) {
  return <MenuPrimitive.Trigger data-slot="dropdown-menu-trigger" {...props} />
}

function DropdownMenuContent({
  align = "start",
  alignOffset = 0,
  side = "bottom",
  sideOffset = 4,
  anchor,
  className,
  ...props
}: MenuPrimitive.Popup.Props &
  Pick<
    MenuPrimitive.Positioner.Props,
    "align" | "alignOffset" | "side" | "sideOffset" | "anchor"
  >) {
  // `anchor` places a menu that has no Trigger (opened from code, e.g. a click on an
  // already-active tab) against that element instead.
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Positioner
        className="isolate z-9999 outline-none"
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
        anchor={anchor}
      >
        <MenuPrimitive.Popup
          data-slot="dropdown-menu-content"
          className={cn(
            "max-h-(--available-height) min-w-56 origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-surface bg-float p-1 text-fg shadow-float outline-none animate-scale-in",
            className
          )}
          {...props}
        />
      </MenuPrimitive.Positioner>
    </MenuPrimitive.Portal>
  )
}

function DropdownMenuGroup({ ...props }: MenuPrimitive.Group.Props) {
  return <MenuPrimitive.Group data-slot="dropdown-menu-group" {...props} />
}

function DropdownMenuLabel({
  className,
  ...props
}: MenuPrimitive.GroupLabel.Props) {
  return (
    <MenuPrimitive.GroupLabel
      data-slot="dropdown-menu-label"
      className={cn(
        "px-2.5 pt-2 pb-1 text-2xs font-medium text-fg-3",
        className
      )}
      {...props}
    />
  )
}

function DropdownMenuItem({
  className,
  variant = "default",
  ...props
}: MenuPrimitive.Item.Props & {
  variant?: "default" | "destructive"
}) {
  return (
    <MenuPrimitive.Item
      data-slot="dropdown-menu-item"
      data-variant={variant}
      className={cn(
        "relative flex w-full cursor-pointer items-center gap-2.5 rounded-control px-2.5 py-1.5 text-ui text-fg-2 outline-hidden select-none data-highlighted:bg-hover data-highlighted:text-fg data-[variant=destructive]:text-red-400 data-[variant=destructive]:data-highlighted:bg-red-500/12 data-[variant=destructive]:data-highlighted:text-red-400 data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-fg-3",
        className
      )}
      {...props}
    />
  )
}

/**
 * A menu row that toggles (a layer, a column): the ui Checkbox look — signal fill and a
 * `signal-fg` tick when on — and the menu stays open so several can be flipped in a row.
 */
function DropdownMenuCheckboxItem({
  className,
  children,
  closeOnClick = false,
  ...props
}: MenuPrimitive.CheckboxItem.Props) {
  return (
    <MenuPrimitive.CheckboxItem
      data-slot="dropdown-menu-checkbox-item"
      closeOnClick={closeOnClick}
      className={cn(
        "group/check relative flex w-full cursor-pointer items-center gap-2.5 rounded-control px-2.5 py-1.5 text-ui text-fg-2 outline-hidden select-none data-highlighted:bg-hover data-highlighted:text-fg data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
        className
      )}
      {...props}
    >
      <span
        aria-hidden
        className="flex size-4 shrink-0 items-center justify-center rounded-sm border border-line-strong text-signal-fg group-data-checked/check:border-signal group-data-checked/check:bg-signal"
      >
        <MenuPrimitive.CheckboxItemIndicator>
          <CheckIcon className="size-3" strokeWidth={3.5} />
        </MenuPrimitive.CheckboxItemIndicator>
      </span>
      {children}
    </MenuPrimitive.CheckboxItem>
  )
}

function DropdownMenuSeparator({
  className,
  ...props
}: MenuPrimitive.Separator.Props) {
  return (
    <MenuPrimitive.Separator
      data-slot="dropdown-menu-separator"
      className={cn("-mx-1 my-1 h-px bg-line", className)}
      {...props}
    />
  )
}

/** A keyboard hint at the end of a menu row (e.g. "Ctrl K"). */
function DropdownMenuShortcut({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="dropdown-menu-shortcut"
      className={cn("ml-auto pl-4 font-mono text-2xs text-fg-4", className)}
      {...props}
    />
  )
}

export {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuSeparator,
}
